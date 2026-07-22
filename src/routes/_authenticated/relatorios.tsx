import { createFileRoute } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatKg, formatPercent } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getExecutiveKPIs,
  getYieldAnalysis,
  getLossAnalysis,
  getFinancialSimulation,
} from "@/lib/dashboard.functions";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — CarnePro" }] }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin", "supervisor", "visualizacao"]),
  component: Relatorios,
});

function Relatorios() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [margem, setMargem] = useState<number>(30);

  const period = { from: from || null, to: to || null };

  const exFn = useServerFn(getExecutiveKPIs);
  const yldFn = useServerFn(getYieldAnalysis);
  const lossFn = useServerFn(getLossAnalysis);
  const finFn = useServerFn(getFinancialSimulation);

  const { data: ex } = useQuery({
    queryKey: ["rep-ex", from, to],
    queryFn: () => exFn({ data: { period } }),
  });
  const { data: byProduct = [] } = useQuery({
    queryKey: ["rep-yield-produto", from, to],
    queryFn: () => yldFn({ data: { period, dimension: "produto", limit: 12 } }),
  });
  const { data: byPeca = [] } = useQuery({
    queryKey: ["rep-yield-peca", from, to],
    queryFn: () => yldFn({ data: { period, dimension: "peca", limit: 12 } }),
  });
  const { data: losses = [] } = useQuery({
    queryKey: ["rep-losses", from, to],
    queryFn: () => lossFn({ data: { period } }),
  });
  const { data: fin } = useQuery({
    queryKey: ["rep-fin", from, to, margem],
    queryFn: () => finFn({ data: { period, margem_pct: margem } }),
  });

  return (
    <AppShell title="Relatórios" subtitle={`${ex?.ordens ?? 0} desossas finalizadas`}>
      {/* Filtros */}
      <div className="bg-panel border rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Margem (%)</Label>
          <Input
            type="number"
            value={margem}
            step="1"
            onChange={(e) => setMargem(Number(e.target.value) || 0)}
            className="w-24"
          />
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Peso Recebido" value={`${formatKg(ex?.peso_recebido ?? 0)} kg`} />
        <KpiCard label="Peso Aproveitado" value={`${formatKg(ex?.peso_aproveitado ?? 0)} kg`} />
        <KpiCard label="Rendimento Médio" value={`${formatPercent(ex?.rendimento_medio_pct ?? 0)}%`} highlight />
        <KpiCard label="Perda Média" value={`${formatPercent(ex?.perda_media_pct ?? 0)}%`} />
      </section>

      {/* Simulação financeira */}
      {fin ? (
        <div className="bg-panel border rounded-lg p-6">
          <h2 className="font-bold mb-4">Simulação financeira</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniKpi label="Custo total" value={`R$ ${formatKg(fin.custo_total)}`} />
            <MiniKpi label="Custo médio/kg" value={`R$ ${formatKg(fin.custo_medio_por_kg, 2)}`} />
            <MiniKpi label="Preço sugerido/kg" value={`R$ ${formatKg(fin.preco_sugerido_por_kg, 2)}`} highlight />
            <MiniKpi label="Lucro estimado" value={`R$ ${formatKg(fin.lucro_estimado)}`} />
          </div>
        </div>
      ) : null}

      <div className="bg-panel border rounded-lg p-6">
        <h2 className="font-bold mb-4">Rendimento por Produto</h2>
        <YieldChart data={byProduct} />
      </div>

      <div className="bg-panel border rounded-lg p-6">
        <h2 className="font-bold mb-4">Rendimento por Peça de Entrada</h2>
        <YieldChart data={byPeca} />
      </div>

      <div className="bg-panel border rounded-lg p-6">
        <h2 className="font-bold mb-4">Perdas por Categoria (kg)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={losses} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} unit=" kg" />
              <Tooltip
                contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                formatter={(v: number) => [`${formatKg(v)} kg`, "Total"]}
              />
              <Legend />
              <Bar dataKey="peso" name="Perda" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}

function YieldChart({ data }: { data: { name: string; rendimento_pct: number }[] }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} angle={-25} textAnchor="end" />
          <YAxis stroke="var(--color-muted-foreground)" fontSize={11} unit="%" />
          <Tooltip
            contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8 }}
            formatter={(v: number) => [`${formatPercent(v)}%`, "Rendimento"]}
          />
          <Bar dataKey="rendimento_pct" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-panel p-5 rounded-lg border ${highlight ? "border-l-2 border-l-primary" : ""}`}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-mono text-3xl font-bold tracking-tight mt-2">{value}</div>
    </div>
  );
}

function MiniKpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-md ${highlight ? "bg-primary/10" : "bg-secondary/40"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono font-bold text-lg mt-1 ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
