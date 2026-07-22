// Server-only analytics helpers.
// Single source of truth for all dashboards, reports, KPIs and future integrations.
// Read-only aggregations over deboning_orders + related tables.

import { TENANT_ID } from "./orders.server";

export interface Period {
  from?: string | null; // ISO date (YYYY-MM-DD)
  to?: string | null;
}

export interface FinalizedOrderRow {
  id: string;
  order_code: string | null;
  peso_inicial: number;
  peso_aproveitado: number | null;
  rendimento_pct: number | null;
  divergencia_kg: number | null;
  finalizada_com_divergencia: boolean;
  valor_compra: number | null;
  order_date: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  suppliers: { razao_social: string | null; nome_fantasia: string | null } | null;
  employees: { full_name: string | null } | null;
  products: { name: string | null } | null;
  pecas_entrada:
    | {
        name: string | null;
        category_id: string | null;
        product_categories: { name: string | null } | null;
      }
    | null;
  deboning_pieces: {
    peso: number;
    quantidade: number;
    corte_id: string | null;
    cortes: { name: string | null; category_id: string | null } | null;
  }[];
  deboning_losses:
    | {
        ossos: number;
        gordura: number;
        retalhos: number;
        descarte: number;
        outros: number;
      }[]
    | null;
}

const ORDER_SELECT = `
  id, order_code, peso_inicial, peso_aproveitado, rendimento_pct, divergencia_kg,
  finalizada_com_divergencia, valor_compra, order_date, started_at, finished_at, status,
  suppliers:supplier_id(razao_social, nome_fantasia),
  employees:assigned_employee_id(full_name),
  products:product_id(name),
  pecas_entrada:peca_entrada_id(name, category_id, product_categories:category_id(name)),
  deboning_pieces(peso, quantidade, corte_id, cortes:corte_id(name, category_id)),
  deboning_losses(ossos, gordura, retalhos, descarte, outros)
`;

export async function fetchFinalizedOrders(
  supabase: any,
  period: Period,
): Promise<FinalizedOrderRow[]> {
  let q = supabase
    .from("deboning_orders")
    .select(ORDER_SELECT)
    .eq("tenant_id", TENANT_ID)
    .eq("status", "finalizada")
    .is("deleted_at", null)
    .order("order_date", { ascending: false })
    .limit(1000);
  if (period.from) q = q.gte("order_date", period.from);
  if (period.to) q = q.lte("order_date", period.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FinalizedOrderRow[];
}

export async function fetchStatusCounts(supabase: any, period: Period) {
  let q = supabase
    .from("deboning_orders")
    .select("id, status, order_date, finalizada_com_divergencia")
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .limit(5000);
  if (period.from) q = q.gte("order_date", period.from);
  if (period.to) q = q.lte("order_date", period.to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    status: string;
    order_date: string;
    finalizada_com_divergencia: boolean;
  }[];
}

// ---------- shared aggregation primitives ----------

export function orderAprov(o: FinalizedOrderRow): number {
  if (o.peso_aproveitado != null) return Number(o.peso_aproveitado);
  return o.deboning_pieces.reduce(
    (a, p) => a + Number(p.peso || 0) * Number(p.quantidade || 1),
    0,
  );
}

export function orderPerdas(o: FinalizedOrderRow): number {
  const l = o.deboning_losses?.[0];
  if (!l) return 0;
  return (
    Number(l.ossos || 0) +
    Number(l.gordura || 0) +
    Number(l.retalhos || 0) +
    Number(l.descarte || 0) +
    Number(l.outros || 0)
  );
}

export function orderRendimento(o: FinalizedOrderRow): number {
  if (o.rendimento_pct != null) return Number(o.rendimento_pct);
  const ini = Number(o.peso_inicial || 0);
  return ini > 0 ? (orderAprov(o) / ini) * 100 : 0;
}

export function orderDurationMs(o: FinalizedOrderRow): number {
  if (!o.started_at || !o.finished_at) return 0;
  return new Date(o.finished_at).getTime() - new Date(o.started_at).getTime();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
