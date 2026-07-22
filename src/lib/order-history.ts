/**
 * Rótulos e tipos do histórico de ordens.
 *
 * Diretriz 1 (Server Functions como única camada de negócio):
 * a persistência do histórico e das notificações vive exclusivamente em
 * `src/lib/orders.server.ts` (chamadas via `src/lib/orders.functions.ts` e
 * `src/lib/notifications.functions.ts`). Este módulo é apenas de apresentação.
 */

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
