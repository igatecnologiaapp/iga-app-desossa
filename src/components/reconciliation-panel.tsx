import { formatKg, formatPercent } from "@/lib/format";
import {
  reconStatus,
  statusColors,
  type Reconciliation,
  type ToleranceConfig,
} from "@/lib/deboning-calcs";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  pesoInicial: number;
  rec: Reconciliation;
  tolerance: ToleranceConfig;
  compact?: boolean;
}

export function ReconciliationPanel({ pesoInicial, rec, tolerance, compact }: Props) {
  const status = reconStatus(rec, tolerance);
  const c = statusColors(status);
  const Icon = status === "ok" ? CheckCircle2 : status === "atencao" ? AlertTriangle : XCircle;

  return (
    <div className={cn("bg-panel border rounded-lg overflow-hidden", "ring-2", c.ring)}>
      <div className={cn("px-4 py-3 border-b flex items-center gap-2", "bg-panel")}>
        <span className={cn("size-2.5 rounded-full", c.dot)} />
        <Icon className={cn("size-4", c.text)} />
        <span className={cn("text-xs font-bold uppercase tracking-widest", c.text)}>
          {c.label}
        </span>
      </div>

      <div className={cn("p-4 space-y-1", compact && "text-sm")}>
        <Row label="Peso Inicial" value={`${formatKg(pesoInicial)} kg`} />
        <Row label="Peças Aproveitáveis" value={`${formatKg(rec.aproveitado)} kg`} accent="text-emerald-700" />
        <Row label="Perdas Totais" value={`${formatKg(rec.perdas)} kg`} />
        <div className="h-px bg-border my-2" />
        <Row label="Total Informado" value={`${formatKg(rec.totalInformado)} kg`} bold />
        <Row
          label="Diferença"
          value={`${formatKg(rec.diferencaAbs)} kg`}
          accent={c.text}
          bold
        />
        <div className="h-px bg-border my-2" />
        <Row label="Aproveitamento" value={`${formatPercent(rec.rendimento)} %`} accent="text-emerald-700" bold big />
        <Row label="Perda" value={`${formatPercent(rec.perdaPct)} %`} accent="text-amber-700" />
        <Row label="Divergência" value={`${formatPercent(rec.divergenciaPct)} %`} accent={c.text} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  bold,
  big,
}: {
  label: string;
  value: string;
  accent?: string;
  bold?: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono",
          bold ? "font-bold" : "font-semibold",
          big ? "text-lg" : "text-sm",
          accent,
        )}
      >
        {value}
      </span>
    </div>
  );
}
