// Analytics layer — single entry point for dashboards, reports, KPIs, exports and future APIs.
// Never queries tables directly from screens. All calculations centralised here.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fetchFinalizedOrders,
  fetchStatusCounts,
  orderAprov,
  orderDurationMs,
  orderPerdas,
  orderRendimento,
  todayISO,
  daysAgoISO,
  type FinalizedOrderRow,
  type Period,
} from "./analytics.server";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface OperationalKPIs {
  pendentes: number;
  atribuidas: number;
  em_andamento: number;
  aguardando_conferencia: number;
  finalizadas: number;
  canceladas: number;
  finalizadas_hoje: number;
  divergencias: number;
}

export interface ExecutiveKPIs {
  ordens: number;
  peso_recebido: number;
  peso_aproveitado: number;
  peso_perdido: number;
  rendimento_medio_pct: number;
  perda_media_pct: number;
  divergencia_media_pct: number;
  custo_total: number;
  custo_medio_por_kg: number;
  tempo_medio_min: number;
  divergencias: number;
}

export interface RankingItem {
  key: string;
  name: string;
  ordens: number;
  peso_recebido: number;
  peso_aproveitado: number;
  rendimento_pct: number;
  tempo_medio_min?: number;
}

export interface TimelinePoint {
  date: string;
  label: string;
  ordens: number;
  peso_recebido: number;
  peso_aproveitado: number;
  peso_perdido: number;
  rendimento_pct: number;
}

export interface YieldByGroup {
  key: string;
  name: string;
  ordens: number;
  peso_recebido: number;
  peso_aproveitado: number;
  rendimento_pct: number;
}

export interface LossBreakdown {
  category: "ossos" | "gordura" | "retalhos" | "descarte" | "outros";
  label: string;
  peso: number;
  pct_do_total: number;
}

export interface FinancialSimulation {
  ordens: number;
  peso_aproveitado: number;
  custo_total: number;
  custo_medio_por_kg: number;
  margem_pct: number;
  preco_sugerido_por_kg: number;
  receita_estimada: number;
  lucro_estimado: number;
}

// -----------------------------------------------------------------------------
// Input helpers
// -----------------------------------------------------------------------------

function normalizePeriod(input: Period | undefined | null): Period {
  return {
    from: input?.from ?? null,
    to: input?.to ?? null,
  };
}

// -----------------------------------------------------------------------------
// 1. Operational KPIs — pipeline snapshot (all statuses)
// -----------------------------------------------------------------------------

export const getOperationalKPIs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { period?: Period } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<OperationalKPIs> => {
    const period = normalizePeriod(data.period);
    const rows = await fetchStatusCounts(context.supabase, period);
    const today = todayISO();
    const count = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      pendentes: count("pendente"),
      atribuidas: count("atribuida"),
      em_andamento: count("em_andamento"),
      aguardando_conferencia: count("aguardando_conferencia"),
      finalizadas: count("finalizada"),
      canceladas: count("cancelada"),
      finalizadas_hoje: rows.filter(
        (r) => r.status === "finalizada" && r.order_date === today,
      ).length,
      divergencias: rows.filter((r) => r.finalizada_com_divergencia).length,
    };
  });

// -----------------------------------------------------------------------------
// 2. Executive KPIs — value view over finalized orders
// -----------------------------------------------------------------------------

function computeExecutiveKPIs(rows: FinalizedOrderRow[]): ExecutiveKPIs {
  let recebido = 0;
  let aprov = 0;
  let perdido = 0;
  let custo = 0;
  let divPctSum = 0;
  let divPctCount = 0;
  let durSum = 0;
  let durCount = 0;
  let divergencias = 0;
  for (const o of rows) {
    const ini = Number(o.peso_inicial || 0);
    const a = orderAprov(o);
    const p = orderPerdas(o);
    recebido += ini;
    aprov += a;
    perdido += p;
    if (o.valor_compra != null) custo += Number(o.valor_compra);
    if (o.finalizada_com_divergencia) divergencias += 1;
    if (ini > 0 && o.divergencia_kg != null) {
      divPctSum += (Math.abs(Number(o.divergencia_kg)) / ini) * 100;
      divPctCount += 1;
    }
    const dur = orderDurationMs(o);
    if (dur > 0) {
      durSum += dur;
      durCount += 1;
    }
  }
  return {
    ordens: rows.length,
    peso_recebido: recebido,
    peso_aproveitado: aprov,
    peso_perdido: perdido,
    rendimento_medio_pct: recebido > 0 ? (aprov / recebido) * 100 : 0,
    perda_media_pct: recebido > 0 ? (perdido / recebido) * 100 : 0,
    divergencia_media_pct: divPctCount > 0 ? divPctSum / divPctCount : 0,
    custo_total: custo,
    custo_medio_por_kg: aprov > 0 ? custo / aprov : 0,
    tempo_medio_min: durCount > 0 ? durSum / durCount / 1000 / 60 : 0,
    divergencias,
  };
}

export const getExecutiveKPIs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { period?: Period } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<ExecutiveKPIs> => {
    const rows = await fetchFinalizedOrders(context.supabase, normalizePeriod(data.period));
    return computeExecutiveKPIs(rows);
  });

// -----------------------------------------------------------------------------
// 3. Supplier performance
// -----------------------------------------------------------------------------

export const getSupplierPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { period?: Period; limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<RankingItem[]> => {
    const rows = await fetchFinalizedOrders(context.supabase, normalizePeriod(data.period));
    const map = new Map<string, RankingItem>();
    for (const o of rows) {
      const name =
        o.suppliers?.nome_fantasia ?? o.suppliers?.razao_social ?? "Sem fornecedor";
      const cur =
        map.get(name) ??
        ({
          key: name,
          name,
          ordens: 0,
          peso_recebido: 0,
          peso_aproveitado: 0,
          rendimento_pct: 0,
        } as RankingItem);
      cur.ordens += 1;
      cur.peso_recebido += Number(o.peso_inicial || 0);
      cur.peso_aproveitado += orderAprov(o);
      map.set(name, cur);
    }
    const list = [...map.values()].map((r) => ({
      ...r,
      rendimento_pct: r.peso_recebido > 0 ? (r.peso_aproveitado / r.peso_recebido) * 100 : 0,
    }));
    list.sort((a, b) => b.peso_recebido - a.peso_recebido);
    return list.slice(0, data.limit ?? 20);
  });

// -----------------------------------------------------------------------------
// 4. Employee performance
// -----------------------------------------------------------------------------

export const getEmployeePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { period?: Period; limit?: number } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<RankingItem[]> => {
    const rows = await fetchFinalizedOrders(context.supabase, normalizePeriod(data.period));
    const map = new Map<
      string,
      RankingItem & { _durMs: number; _durCount: number }
    >();
    for (const o of rows) {
      const name = o.employees?.full_name ?? "Sem responsável";
      const cur =
        map.get(name) ??
        ({
          key: name,
          name,
          ordens: 0,
          peso_recebido: 0,
          peso_aproveitado: 0,
          rendimento_pct: 0,
          _durMs: 0,
          _durCount: 0,
        } as any);
      cur.ordens += 1;
      cur.peso_recebido += Number(o.peso_inicial || 0);
      cur.peso_aproveitado += orderAprov(o);
      const dur = orderDurationMs(o);
      if (dur > 0) {
        cur._durMs += dur;
        cur._durCount += 1;
      }
      map.set(name, cur);
    }
    const list = [...map.values()].map((r) => ({
      key: r.key,
      name: r.name,
      ordens: r.ordens,
      peso_recebido: r.peso_recebido,
      peso_aproveitado: r.peso_aproveitado,
      rendimento_pct:
        r.peso_recebido > 0 ? (r.peso_aproveitado / r.peso_recebido) * 100 : 0,
      tempo_medio_min: r._durCount > 0 ? r._durMs / r._durCount / 1000 / 60 : 0,
    }));
    list.sort((a, b) => b.rendimento_pct - a.rendimento_pct);
    return list.slice(0, data.limit ?? 20);
  });

// -----------------------------------------------------------------------------
// 5. Yield analysis — by input piece / product / category
// -----------------------------------------------------------------------------

type YieldDim = "peca" | "produto" | "categoria" | "corte";

export const getYieldAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { period?: Period; dimension?: YieldDim; limit?: number } | undefined) =>
      data ?? {},
  )
  .handler(async ({ data, context }): Promise<YieldByGroup[]> => {
    const rows = await fetchFinalizedOrders(context.supabase, normalizePeriod(data.period));
    const dim: YieldDim = data.dimension ?? "peca";
    const map = new Map<string, YieldByGroup>();

    if (dim === "corte") {
      // yield of a cut is not on order-basis; return peso produced per cut
      for (const o of rows) {
        for (const p of o.deboning_pieces) {
          const name = p.cortes?.name ?? "Sem corte";
          const cur =
            map.get(name) ??
            ({
              key: name,
              name,
              ordens: 0,
              peso_recebido: 0,
              peso_aproveitado: 0,
              rendimento_pct: 0,
            } as YieldByGroup);
          cur.ordens += 1;
          cur.peso_aproveitado += Number(p.peso || 0) * Number(p.quantidade || 1);
          map.set(name, cur);
        }
      }
    } else {
      for (const o of rows) {
        const name =
          dim === "produto"
            ? o.products?.name ?? "—"
            : dim === "categoria"
              ? o.pecas_entrada?.product_categories?.name ?? "—"
              : o.pecas_entrada?.name ?? "—";
        const cur =
          map.get(name) ??
          ({
            key: name,
            name,
            ordens: 0,
            peso_recebido: 0,
            peso_aproveitado: 0,
            rendimento_pct: 0,
          } as YieldByGroup);
        cur.ordens += 1;
        cur.peso_recebido += Number(o.peso_inicial || 0);
        cur.peso_aproveitado += orderAprov(o);
        map.set(name, cur);
      }
    }

    const list = [...map.values()].map((r) => ({
      ...r,
      rendimento_pct:
        r.peso_recebido > 0 ? (r.peso_aproveitado / r.peso_recebido) * 100 : 0,
    }));
    list.sort((a, b) =>
      dim === "corte" ? b.peso_aproveitado - a.peso_aproveitado : b.rendimento_pct - a.rendimento_pct,
    );
    return list.slice(0, data.limit ?? 20);
  });

// -----------------------------------------------------------------------------
// 6. Loss analysis
// -----------------------------------------------------------------------------

export const getLossAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { period?: Period } | undefined) => data ?? {})
  .handler(async ({ data, context }): Promise<LossBreakdown[]> => {
    const rows = await fetchFinalizedOrders(context.supabase, normalizePeriod(data.period));
    const totals = { ossos: 0, gordura: 0, retalhos: 0, descarte: 0, outros: 0 };
    for (const o of rows) {
      const l = o.deboning_losses?.[0];
      if (!l) continue;
      totals.ossos += Number(l.ossos || 0);
      totals.gordura += Number(l.gordura || 0);
      totals.retalhos += Number(l.retalhos || 0);
      totals.descarte += Number(l.descarte || 0);
      totals.outros += Number(l.outros || 0);
    }
    const soma =
      totals.ossos + totals.gordura + totals.retalhos + totals.descarte + totals.outros;
    const labels: Record<LossBreakdown["category"], string> = {
      ossos: "Ossos",
      gordura: "Gordura",
      retalhos: "Retalhos",
      descarte: "Descarte",
      outros: "Outros",
    };
    const out: LossBreakdown[] = (
      Object.keys(labels) as LossBreakdown["category"][]
    ).map((k) => ({
      category: k,
      label: labels[k],
      peso: totals[k],
      pct_do_total: soma > 0 ? (totals[k] / soma) * 100 : 0,
    }));
    out.sort((a, b) => b.peso - a.peso);
    return out;
  });

// -----------------------------------------------------------------------------
// 7. Production timeline — daily series
// -----------------------------------------------------------------------------

export const getProductionTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { period?: Period; days?: number } | undefined) => data ?? {},
  )
  .handler(async ({ data, context }): Promise<TimelinePoint[]> => {
    const days = Math.max(1, Math.min(90, data.days ?? 7));
    const period: Period = data.period ?? {
      from: daysAgoISO(days - 1),
      to: todayISO(),
    };
    const rows = await fetchFinalizedOrders(context.supabase, normalizePeriod(period));
    const byDate = new Map<string, TimelinePoint>();
    // Seed all days so gaps render as zero
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDate.set(key, {
        date: key,
        label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }).replace(".", ""),
        ordens: 0,
        peso_recebido: 0,
        peso_aproveitado: 0,
        peso_perdido: 0,
        rendimento_pct: 0,
      });
    }
    for (const o of rows) {
      const key = o.order_date;
      const cur = byDate.get(key);
      if (!cur) continue;
      cur.ordens += 1;
      cur.peso_recebido += Number(o.peso_inicial || 0);
      cur.peso_aproveitado += orderAprov(o);
      cur.peso_perdido += orderPerdas(o);
    }
    return [...byDate.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        ...p,
        rendimento_pct:
          p.peso_recebido > 0 ? Number(((p.peso_aproveitado / p.peso_recebido) * 100).toFixed(1)) : 0,
      }));
  });

// -----------------------------------------------------------------------------
// 8. Financial simulation
// -----------------------------------------------------------------------------

export const getFinancialSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { period?: Period; margem_pct?: number } | undefined) => data ?? {},
  )
  .handler(async ({ data, context }): Promise<FinancialSimulation> => {
    const margem = Number(data.margem_pct ?? 30);
    const rows = await fetchFinalizedOrders(context.supabase, normalizePeriod(data.period));
    let aprov = 0;
    let custo = 0;
    for (const o of rows) {
      aprov += orderAprov(o);
      if (o.valor_compra != null) custo += Number(o.valor_compra);
    }
    const custoKg = aprov > 0 ? custo / aprov : 0;
    const precoKg = custoKg * (1 + margem / 100);
    const receita = precoKg * aprov;
    return {
      ordens: rows.length,
      peso_aproveitado: aprov,
      custo_total: custo,
      custo_medio_por_kg: custoKg,
      margem_pct: margem,
      preco_sugerido_por_kg: precoKg,
      receita_estimada: receita,
      lucro_estimado: receita - custo,
    };
  });
