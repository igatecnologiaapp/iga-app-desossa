import { supabase } from "@/integrations/supabase/client";

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
  | "status_alterado"
  | "observacao_adicionada";

interface LogArgs {
  orderId: string;
  action: HistoryAction;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logOrderHistory({ orderId, action, fromStatus, toStatus, notes, metadata }: LogArgs) {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id ?? null;
  let userName: string | null = null;
  if (uid) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", uid)
      .maybeSingle();
    userName = p?.full_name ?? p?.email ?? null;
  }
  await supabase.from("deboning_order_history").insert({
    order_id: orderId,
    user_id: uid,
    user_name: userName,
    action,
    from_status: fromStatus ?? null,
    to_status: toStatus ?? null,
    notes: notes ?? null,
    metadata: (metadata ?? null) as never,
  });
}

export const HISTORY_ACTION_LABEL: Record<HistoryAction, string> = {
  ordem_criada: "Ordem criada",
  ordem_atribuida: "Ordem atribuída",
  desossa_iniciada: "Desossa iniciada",
  corte_adicionado: "Corte adicionado",
  corte_removido: "Corte removido",
  perdas_alteradas: "Perdas atualizadas",
  ordem_finalizada: "Ordem finalizada",
  ordem_finalizada_divergencia: "Finalizada com divergência",
  ordem_cancelada: "Ordem cancelada",
  status_alterado: "Status alterado",
  observacao_adicionada: "Observação adicionada",
};

/** Cria notificação in-app. Só grava se destinatário existir. */
export async function notify(args: {
  userId: string | null | undefined;
  type: string;
  title: string;
  body?: string | null;
  orderId?: string | null;
}) {
  if (!args.userId) return;
  await supabase.from("notifications").insert({
    user_id: args.userId,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
    order_id: args.orderId ?? null,
  });
}

/** Notifica todos os administradores do tenant */
export async function notifyAdmins(args: {
  type: string;
  title: string;
  body?: string | null;
  orderId?: string | null;
}) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin"] as any);
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return;
  const rows = ids.map((uid) => ({
    user_id: uid,
    type: args.type,
    title: args.title,
    body: args.body ?? null,
    order_id: args.orderId ?? null,
  }));
  await supabase.from("notifications").insert(rows);
}
