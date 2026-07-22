// Server-only helpers for the deboning order lifecycle.
// Do NOT import from client code — the `.server.ts` extension enforces it.

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

export type OrderStatus =
  | "pendente"
  | "atribuida"
  | "em_andamento"
  | "aguardando_conferencia"
  | "finalizada"
  | "cancelada";

export type HistoryAction =
  | "ordem_criada"
  | "ordem_atribuida"
  | "desossa_iniciada"
  | "corte_adicionado"
  | "corte_removido"
  | "perdas_alteradas"
  | "ordem_finalizada"
  | "ordem_finalizada_divergencia"
  | "ordem_cancelada"
  | "ordem_reaberta"
  | "ordem_excluida"
  | "status_alterado";

export async function fetchRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => String(r.role));
}

export function ensureRole(roles: string[], allowed: string[]): void {
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error("Você não tem permissão para executar esta ação.");
  }
}

export async function fetchOrderStrict(supabase: any, orderId: string) {
  const { data, error } = await supabase
    .from("deboning_orders")
    .select(
      "id, status, peso_inicial, assigned_employee_id, peca_entrada_id, order_code, created_by",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ordem não encontrada.");
  return data as {
    id: string;
    status: OrderStatus;
    peso_inicial: number;
    assigned_employee_id: string | null;
    peca_entrada_id: string | null;
    order_code: string | null;
    created_by: string | null;
  };
}

export function ensureStatus(current: OrderStatus, allowed: OrderStatus[]): void {
  if (!allowed.includes(current)) {
    throw new Error(
      `Transição inválida a partir do status atual (${current}). Permitido: ${allowed.join(", ")}.`,
    );
  }
}

async function displayName(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? data?.email ?? null;
}

export async function logHistory(
  supabase: any,
  userId: string,
  args: {
    orderId: string;
    action: HistoryAction;
    fromStatus?: OrderStatus | null;
    toStatus?: OrderStatus | null;
    notes?: string | null;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const userName = await displayName(supabase, userId);
  await supabase.from("deboning_order_history").insert({
    order_id: args.orderId,
    user_id: userId,
    user_name: userName,
    action: args.action,
    from_status: args.fromStatus ?? null,
    to_status: args.toStatus ?? null,
    notes: args.notes ?? null,
    field: args.field ?? null,
    old_value: args.oldValue ?? null,
    new_value: args.newValue ?? null,
    metadata: (args.metadata ?? null) as never,
  });
}

export async function notifyUser(
  supabase: any,
  args: {
    userId: string | null | undefined;
    type: string;
    title: string;
    body?: string | null;
    orderId?: string | null;
  },
) {
  if (!args.userId) return;
  await supabase.from("notifications").insert({
    user_id: args.userId,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
    order_id: args.orderId ?? null,
  });
}

export async function notifyAdmins(
  supabase: any,
  args: { type: string; title: string; body?: string | null; orderId?: string | null },
) {
  // Uses service-role client to guarantee visibility across role boundaries
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin"] as any);
  const ids = (roles ?? []).map((r: any) => r.user_id);
  if (ids.length === 0) return;
  await supabaseAdmin.from("notifications").insert(
    ids.map((uid: string) => ({
      user_id: uid,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      order_id: args.orderId ?? null,
    })),
  );
}

export function reconcileServer(pesoInicial: number, pieces: Array<{ peso: number; quantidade: number }>, losses: {
  ossos: number; gordura: number; retalhos: number; descarte: number; outros: number;
}) {
  const inicial = Number(pesoInicial || 0);
  const aproveitado = pieces.reduce((s, p) => s + Number(p.peso || 0) * Number(p.quantidade || 1), 0);
  const perdas =
    Number(losses.ossos || 0) +
    Number(losses.gordura || 0) +
    Number(losses.retalhos || 0) +
    Number(losses.descarte || 0) +
    Number(losses.outros || 0);
  const totalInformado = aproveitado + perdas;
  const diferenca = inicial - totalInformado;
  const diferencaAbs = Math.abs(diferenca);
  const rendimento = inicial > 0 ? (aproveitado / inicial) * 100 : 0;
  const divergenciaPct = inicial > 0 ? (diferencaAbs / inicial) * 100 : 0;
  return { aproveitado, perdas, diferencaAbs, rendimento, divergenciaPct };
}

export async function tenantDivergenceLimit(supabase: any): Promise<number> {
  const { data } = await supabase
    .from("tenant_settings")
    .select("divergencia_maxima_kg")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();
  return Number(data?.divergencia_maxima_kg ?? 0.5);
}

export { TENANT_ID };
