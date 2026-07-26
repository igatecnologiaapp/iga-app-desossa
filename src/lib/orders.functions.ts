import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ensureRole,
  ensureStatus,
  fetchOrderStrict,
  fetchRoles,
  logHistory,
  notifyAdmins,
  notifyUser,
  reconcileServer,
  tenantDivergenceLimit,
  TENANT_ID,
  type OrderStatus,
} from "./orders.server";

// ------------------------------------------------------------
// createOrder
// ------------------------------------------------------------
interface CreateOrderInput {
  stock_entry_id: string;
  peca_entrada_id: string;
  supplier_id: string;
  peso_inicial: number;
  order_date: string;
  assigned_employee_id?: string | null;
  valor_compra?: number | null;
  observacoes?: string | null;
}

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateOrderInput) => {
    if (!data.stock_entry_id) throw new Error("Selecione a Entrada de Mercadoria.");
    if (!data.peca_entrada_id) throw new Error("Selecione a peça de entrada.");
    if (!data.supplier_id) throw new Error("Fornecedor obrigatório.");
    if (!data.peso_inicial || data.peso_inicial <= 0) throw new Error("Informe o peso inicial.");
    if (!data.order_date) throw new Error("Informe a data.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: codeRes, error: codeErr } = await supabaseAdmin.rpc("next_order_code", {
      _tenant: TENANT_ID,
    });
    if (codeErr) throw new Error(codeErr.message);
    const code = (codeRes as unknown as string) ?? `OD-${Date.now()}`;

    const status: OrderStatus = data.assigned_employee_id ? "atribuida" : "pendente";
    const { data: inserted, error } = await supabase
      .from("deboning_orders")
      .insert({
        stock_entry_id: data.stock_entry_id,
        peca_entrada_id: data.peca_entrada_id,
        supplier_id: data.supplier_id,
        peso_inicial: data.peso_inicial,
        order_date: data.order_date,
        assigned_employee_id: data.assigned_employee_id || null,
        valor_compra: data.valor_compra ?? null,
        observacoes: data.observacoes ?? null,
        order_code: code,
        status,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const orderId = inserted.id;

    await logHistory(supabase, userId, {
      orderId,
      action: "ordem_criada",
      toStatus: status,
      notes: `Ordem ${code} criada`,
    });
    if (data.assigned_employee_id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("full_name, user_id")
        .eq("id", data.assigned_employee_id)
        .maybeSingle();
      await logHistory(supabase, userId, {
        orderId,
        action: "ordem_atribuida",
        toStatus: "atribuida",
        notes: emp ? `Atribuída para ${emp.full_name}` : null,
      });
      if (emp?.user_id) {
        await notifyUser(supabase, {
          userId: emp.user_id,
          type: "ordem_atribuida",
          title: "Nova ordem atribuída",
          body: `${code}`,
          orderId,
        });
      }
    }
    await notifyAdmins(supabase, {
      type: "desossa_criada",
      title: "Nova ordem de desossa",
      body: code,
      orderId,
    });

    return { id: orderId, order_code: code };
  });

// ------------------------------------------------------------
// assignOrder
// ------------------------------------------------------------
export const assignOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { order_id: string; employee_id: string | null }) => {
    if (!data.order_id) throw new Error("Ordem inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    ensureStatus(order.status, ["pendente", "atribuida"]);

    const nextStatus: OrderStatus = data.employee_id ? "atribuida" : "pendente";
    const { error } = await supabase
      .from("deboning_orders")
      .update({ assigned_employee_id: data.employee_id, status: nextStatus })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    let empName: string | null = null;
    let empUserId: string | null = null;
    if (data.employee_id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("full_name, user_id")
        .eq("id", data.employee_id)
        .maybeSingle();
      empName = emp?.full_name ?? null;
      empUserId = emp?.user_id ?? null;
    }

    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "ordem_atribuida",
      fromStatus: order.status,
      toStatus: nextStatus,
      notes: empName ? `Atribuída para ${empName}` : "Atribuição removida",
    });
    if (empUserId) {
      await notifyUser(supabase, {
        userId: empUserId,
        type: "ordem_atribuida",
        title: "Nova ordem atribuída",
        body: order.order_code ?? undefined,
        orderId: data.order_id,
      });
    }
    return { ok: true };
  });

// ------------------------------------------------------------
// startOrder
// ------------------------------------------------------------
export const startOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { order_id: string }) => {
    if (!data.order_id) throw new Error("Ordem inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor", "acougueiro"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    ensureStatus(order.status, ["atribuida", "pendente"]);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("deboning_orders")
      .update({ status: "em_andamento", started_at: now })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "desossa_iniciada",
      fromStatus: order.status,
      toStatus: "em_andamento",
    });
    await notifyAdmins(supabase, {
      type: "desossa_iniciada",
      title: "Desossa iniciada",
      body: order.order_code ?? undefined,
      orderId: data.order_id,
    });
    return { ok: true };
  });

// ------------------------------------------------------------
// addPiece
// ------------------------------------------------------------
export const addPiece = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      order_id: string;
      corte_id: string;
      peso: number;
      quantidade: number;
      observacoes?: string | null;
    }) => {
      if (!data.order_id) throw new Error("Ordem inválida.");
      if (!data.corte_id) throw new Error("Selecione o corte.");
      if (!data.peso || data.peso <= 0) throw new Error("Informe o peso.");
      if (!data.quantidade || data.quantidade <= 0) data.quantidade = 1;
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor", "acougueiro"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    ensureStatus(order.status, ["em_andamento"]);

    const { data: inserted, error } = await supabase
      .from("deboning_pieces")
      .insert({
        order_id: data.order_id,
        corte_id: data.corte_id,
        peso: data.peso,
        quantidade: data.quantidade,
        observacoes: data.observacoes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: corte } = await supabase
      .from("cortes")
      .select("name")
      .eq("id", data.corte_id)
      .maybeSingle();
    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "corte_adicionado",
      notes: `${corte?.name ?? "Corte"} — ${data.peso} kg (x${data.quantidade})`,
      field: "pieces",
      newValue: `+${data.peso}kg`,
    });
    return { id: inserted.id };
  });

// ------------------------------------------------------------
// removePiece
// ------------------------------------------------------------
export const removePiece = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { order_id: string; piece_id: string }) => {
    if (!data.order_id || !data.piece_id) throw new Error("Parâmetros inválidos.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor", "acougueiro"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    ensureStatus(order.status, ["em_andamento"]);

    const { data: piece } = await supabase
      .from("deboning_pieces")
      .select("peso, quantidade, cortes:corte_id(name)")
      .eq("id", data.piece_id)
      .maybeSingle();
    const { error } = await supabase.from("deboning_pieces").delete().eq("id", data.piece_id);
    if (error) throw new Error(error.message);

    const corteName = (piece as any)?.cortes?.name ?? "Corte";
    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "corte_removido",
      notes: `${corteName} — ${(piece as any)?.peso ?? "?"} kg`,
      field: "pieces",
      oldValue: `-${(piece as any)?.peso ?? "?"}kg`,
    });
    return { ok: true };
  });

// ------------------------------------------------------------
// updateLosses
// ------------------------------------------------------------
export const updateLosses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      order_id: string;
      ossos: number;
      gordura: number;
      retalhos: number;
      descarte: number;
      outros: number;
      observacoes?: string | null;
    }) => {
      if (!data.order_id) throw new Error("Ordem inválida.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor", "acougueiro"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    ensureStatus(order.status, ["em_andamento"]);

    const { error } = await supabase.from("deboning_losses").upsert(
      {
        order_id: data.order_id,
        ossos: data.ossos,
        gordura: data.gordura,
        retalhos: data.retalhos,
        descarte: data.descarte,
        outros: data.outros,
        observacoes: data.observacoes ?? null,
      },
      { onConflict: "order_id" },
    );
    if (error) throw new Error(error.message);

    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "perdas_alteradas",
      notes: `Ossos ${data.ossos} · Gordura ${data.gordura} · Retalhos ${data.retalhos} · Descarte ${data.descarte} · Outros ${data.outros}`,
      field: "losses",
    });
    return { ok: true };
  });

// ------------------------------------------------------------
// finalizeOrder
// ------------------------------------------------------------
export const finalizeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { order_id: string; force?: boolean; observacoes?: string | null }) => {
      if (!data.order_id) throw new Error("Ordem inválida.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor", "acougueiro"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    ensureStatus(order.status, ["em_andamento", "aguardando_conferencia"]);

    const [{ data: pieces }, { data: losses }] = await Promise.all([
      supabase.from("deboning_pieces").select("peso, quantidade").eq("order_id", data.order_id),
      supabase.from("deboning_losses").select("*").eq("order_id", data.order_id).maybeSingle(),
    ]);
    if (!pieces || pieces.length === 0) {
      throw new Error("Adicione ao menos um corte antes de finalizar.");
    }
    const l = losses ?? { ossos: 0, gordura: 0, retalhos: 0, descarte: 0, outros: 0 };
    const rec = reconcileServer(order.peso_inicial, pieces as any, l as any);

    const divLimit = await tenantDivergenceLimit(supabase);
    const excedeu = rec.diferencaAbs > divLimit;
    if (excedeu && !data.force) {
      throw new Error(
        `Divergência ${rec.diferencaAbs.toFixed(3)} kg excede o limite (${divLimit} kg). Confirme para finalizar assim mesmo.`,
      );
    }

    const finalizadaComDivergencia = excedeu;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("deboning_orders")
      .update({
        status: "finalizada",
        finished_at: now,
        peso_aproveitado: rec.aproveitado,
        rendimento_pct: rec.rendimento,
        divergencia_kg: rec.diferencaAbs,
        divergencia_pct: rec.divergenciaPct,
        finalizada_com_divergencia: finalizadaComDivergencia,
        observacoes_finalizacao: data.observacoes ?? null,
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: finalizadaComDivergencia ? "ordem_finalizada_divergencia" : "ordem_finalizada",
      fromStatus: order.status,
      toStatus: "finalizada",
      notes: finalizadaComDivergencia
        ? `Divergência ${rec.diferencaAbs.toFixed(3)} kg (${rec.divergenciaPct.toFixed(2)}%). Rendimento ${rec.rendimento.toFixed(2)}%.`
        : `Rendimento ${rec.rendimento.toFixed(2)}%. Diferença ${rec.diferencaAbs.toFixed(3)} kg.`,
    });
    await notifyAdmins(supabase, {
      type: finalizadaComDivergencia ? "divergencia" : "desossa_finalizada",
      title: finalizadaComDivergencia
        ? "Desossa finalizada com divergência"
        : "Desossa finalizada",
      body: `Rendimento ${rec.rendimento.toFixed(1)}% · ${rec.aproveitado.toFixed(2)} kg`,
      orderId: data.order_id,
    });
    return {
      ok: true,
      rendimento: rec.rendimento,
      diferencaAbs: rec.diferencaAbs,
      finalizadaComDivergencia,
    };
  });

// ------------------------------------------------------------
// cancelOrder
// ------------------------------------------------------------
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { order_id: string; reason?: string | null }) => {
    if (!data.order_id) throw new Error("Ordem inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    if (order.status === "finalizada" || order.status === "cancelada") {
      throw new Error("Não é possível cancelar uma ordem finalizada ou já cancelada.");
    }

    const { error } = await supabase
      .from("deboning_orders")
      .update({ status: "cancelada", cancellation_reason: data.reason ?? null })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "ordem_cancelada",
      fromStatus: order.status,
      toStatus: "cancelada",
      notes: data.reason ?? null,
    });
    await notifyAdmins(supabase, {
      type: "cancelamento",
      title: "Ordem cancelada",
      body: data.reason ?? undefined,
      orderId: data.order_id,
    });
    return { ok: true };
  });

// ------------------------------------------------------------
// reopenOrder — admin/supervisor. Volta finalizada → em_andamento,
// preserva histórico, mantém o mesmo açougueiro atribuído.
// ------------------------------------------------------------
export const reopenOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { order_id: string; reason: string }) => {
    if (!data.order_id) throw new Error("Ordem inválida.");
    if (!data.reason || data.reason.trim().length < 3)
      throw new Error("Informe o motivo da reabertura (mín. 3 caracteres).");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    if (order.status !== "finalizada") {
      throw new Error("Somente ordens finalizadas podem ser reabertas.");
    }

    const now = new Date().toISOString();
    const { data: cur } = await supabase
      .from("deboning_orders")
      .select("reopen_count")
      .eq("id", data.order_id)
      .maybeSingle();
    const nextCount = Number((cur as any)?.reopen_count ?? 0) + 1;

    const { error } = await supabase
      .from("deboning_orders")
      .update({
        status: "em_andamento",
        finished_at: null,
        reopened_at: now,
        reopened_by: userId,
        reopen_reason: data.reason,
        reopen_count: nextCount,
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "ordem_reaberta",
      fromStatus: "finalizada",
      toStatus: "em_andamento",
      notes: `Reabertura #${nextCount}. Motivo: ${data.reason}`,
    });
    if (order.assigned_employee_id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", order.assigned_employee_id)
        .maybeSingle();
      if (emp?.user_id) {
        await notifyUser(supabase, {
          userId: emp.user_id,
          type: "ordem_reaberta",
          title: "Ordem reaberta",
          body: `${order.order_code ?? ""} · ${data.reason}`,
          orderId: data.order_id,
        });
      }
    }
    await notifyAdmins(supabase, {
      type: "ordem_reaberta",
      title: "Ordem reaberta",
      body: `${order.order_code ?? ""} · ${data.reason}`,
      orderId: data.order_id,
    });
    return { ok: true };
  });

// ------------------------------------------------------------
// deleteOrder — exclusão lógica (soft delete). Somente admin.
// Preserva histórico para auditoria.
// ------------------------------------------------------------
export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { order_id: string; reason: string }) => {
    if (!data.order_id) throw new Error("Ordem inválida.");
    if (!data.reason || data.reason.trim().length < 3)
      throw new Error("Informe o motivo da exclusão (mín. 3 caracteres).");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin"]);

    const order = await fetchOrderStrict(supabase, data.order_id);

    const { error } = await supabase
      .from("deboning_orders")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_reason: data.reason,
      })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    await logHistory(supabase, userId, {
      orderId: data.order_id,
      action: "ordem_excluida",
      fromStatus: order.status,
      toStatus: order.status,
      notes: `Exclusão lógica. Motivo: ${data.reason}`,
    });
    await notifyAdmins(supabase, {
      type: "ordem_excluida",
      title: "Ordem excluída",
      body: `${order.order_code ?? ""} · ${data.reason}`,
      orderId: data.order_id,
    });
    return { ok: true };
  });

// ------------------------------------------------------------
// updateOrderMetadata — admin/supervisor. Corrige açougueiro,
// valor de compra e observações em ordens não finalizadas.
// ------------------------------------------------------------
export const updateOrderMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      order_id: string;
      assigned_employee_id?: string | null;
      valor_compra?: number | null;
      observacoes?: string | null;
    }) => {
      if (!data.order_id) throw new Error("Ordem inválida.");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await fetchRoles(supabase, userId);
    ensureRole(roles, ["admin", "supervisor"]);

    const order = await fetchOrderStrict(supabase, data.order_id);
    ensureStatus(order.status, [
      "pendente",
      "atribuida",
      "em_andamento",
      "aguardando_conferencia",
    ]);

    const { data: cur } = await supabase
      .from("deboning_orders")
      .select("valor_compra, observacoes")
      .eq("id", data.order_id)
      .maybeSingle();

    const updates: {
      assigned_employee_id?: string | null;
      valor_compra?: number | null;
      observacoes?: string | null;
    } = {};
    const changes: Array<{ field: string; oldValue: string; newValue: string; notes: string }> = [];

    if (data.assigned_employee_id !== undefined) {
      const newEmp = data.assigned_employee_id || null;
      if (newEmp !== order.assigned_employee_id) {
        updates.assigned_employee_id = newEmp;
        let oldName: string | null = null;
        let newName: string | null = null;
        if (order.assigned_employee_id) {
          const { data: e } = await supabase
            .from("employees")
            .select("full_name")
            .eq("id", order.assigned_employee_id)
            .maybeSingle();
          oldName = e?.full_name ?? null;
        }
        if (newEmp) {
          const { data: e } = await supabase
            .from("employees")
            .select("full_name, user_id")
            .eq("id", newEmp)
            .maybeSingle();
          newName = e?.full_name ?? null;
          if (e?.user_id) {
            await notifyUser(supabase, {
              userId: e.user_id,
              type: "ordem_atribuida",
              title: "Ordem atribuída para você",
              body: order.order_code ?? undefined,
              orderId: data.order_id,
            });
          }
        }
        changes.push({
          field: "assigned_employee_id",
          oldValue: oldName ?? "—",
          newValue: newName ?? "—",
          notes: `Açougueiro alterado: ${oldName ?? "—"} → ${newName ?? "—"}`,
        });
      }
    }

    if (data.valor_compra !== undefined) {
      const old = (cur as any)?.valor_compra ?? null;
      if (Number(old ?? 0) !== Number(data.valor_compra ?? 0)) {
        updates.valor_compra = data.valor_compra;
        changes.push({
          field: "valor_compra",
          oldValue: old != null ? String(old) : "—",
          newValue: data.valor_compra != null ? String(data.valor_compra) : "—",
          notes: `Valor de compra atualizado`,
        });
      }
    }

    if (data.observacoes !== undefined) {
      const old = ((cur as any)?.observacoes ?? "") as string;
      const next = (data.observacoes ?? "") as string;
      if (old !== next) {
        updates.observacoes = data.observacoes;
        changes.push({
          field: "observacoes",
          oldValue: old || "—",
          newValue: next || "—",
          notes: `Observações atualizadas`,
        });
      }
    }

    if (Object.keys(updates).length === 0) return { ok: true, changed: false };

    const { error } = await supabase
      .from("deboning_orders")
      .update(updates)
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);

    for (const c of changes) {
      await logHistory(supabase, userId, {
        orderId: data.order_id,
        action: "status_alterado",
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        notes: c.notes,
      });
    }
    return { ok: true, changed: true };
  });
