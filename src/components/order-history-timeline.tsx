import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { HISTORY_ACTION_LABEL, type HistoryAction } from "@/lib/order-history";
import {
  Circle,
  Play,
  UserCheck,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";

interface Row {
  id: string;
  action: HistoryAction;
  from_status: string | null;
  to_status: string | null;
  user_name: string | null;
  notes: string | null;
  created_at: string;
}

const ICONS: Partial<Record<HistoryAction, React.ComponentType<{ className?: string }>>> = {
  ordem_criada: Circle,
  ordem_atribuida: UserCheck,
  desossa_iniciada: Play,
  corte_adicionado: Plus,
  corte_removido: Minus,
  perdas_alteradas: Info,
  ordem_finalizada: CheckCircle2,
  ordem_finalizada_divergencia: AlertTriangle,
  ordem_cancelada: XCircle,
  status_alterado: Info,
  observacao_adicionada: Info,
};

export function OrderHistoryTimeline({ orderId }: { orderId: string }) {
  const { data: history = [] } = useQuery({
    queryKey: ["order-history", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deboning_order_history")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      return (data ?? []) as Row[];
    },
  });

  if (history.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground text-center">
        Sem histórico ainda.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
        {history.map((h) => {
          const Icon = ICONS[h.action] ?? Info;
          const isCritical = h.action === "ordem_finalizada_divergencia" || h.action === "ordem_cancelada";
          return (
            <div key={h.id} className="relative">
              <div
                className={`absolute -left-6 top-0.5 size-4 rounded-full flex items-center justify-center border-2 border-panel ${
                  isCritical ? "bg-destructive" : "bg-primary"
                }`}
              >
                <Icon className="size-2 text-white" />
              </div>
              <div className="text-sm">
                <div className="font-semibold">{HISTORY_ACTION_LABEL[h.action] ?? h.action}</div>
                {h.notes ? (
                  <div className="text-xs text-muted-foreground mt-0.5">{h.notes}</div>
                ) : null}
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                  {h.user_name ?? "Sistema"} · {formatDateTime(h.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
