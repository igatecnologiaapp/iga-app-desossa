import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { usePermissions } from "@/hooks/use-permissions";
import { formatKg, formatPercent } from "@/lib/format";
import {
  getOperationalKPIs,
  getExecutiveKPIs,
  getProductionTimeline,
  getSupplierPerformance,
  getEmployeePerformance,
  getYieldAnalysis,
  getLossAnalysis,
} from "@/lib/dashboard.functions";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  Package,
  TrendingUp,
  Scale,
  ClipboardCheck,
  Clock,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PRO MEAT" },
      { name: "description", content: "Painel gerencial da desossa: rendimento, ordens, fornecedores e produtividade." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin", "supervisor", "visualizacao"]),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const perms = usePermissions();

  useEffect(() => {
    if (!perms.isLoading && perms.context && perms.isAcougueiro && !perms.isAdmin && !perms.isSupervisor) {
      navigate({ to: "/mobile", replace: true });
    }
  }, [perms.isLoading, perms.context, perms.isAcougueiro, perms.isAdmin, perms.isSupervisor, navigate]);

  const opFn = useServerFn(getOperationalKPIs);
  const exFn = useServerFn(getExecutiveKPIs);
  const tlFn = useServerFn(getProductionTimeline);
  const supFn = useServerFn(getSupplierPerformance);
  const empFn = useServerFn(getEmployeePerformance);
  const yldFn = useServerFn(getYieldAnalysis);
  const lossFn = useServerFn(getLossAnalysis);

  const { data: op } = useQuery({ queryKey: ["kpi-op"], queryFn: () => opFn({ data: {} }) });
  const { data: ex } = useQuery({ queryKey: ["kpi-ex"], queryFn: () => exFn({ data: {} }) });
  const { data: timeline = [] } = useQuery({
    queryKey: ["kpi-timeline", 7],
    queryFn: () => tlFn({ data: { days: 7 } }),
  });
  const { data: supRend = [] } = useQuery({
    queryKey: ["kpi-suppliers"],
    queryFn: () => supFn({ data: { limit: 5 } }),
  });
  const { data: emps = [] } = useQuery({
    queryKey: ["kpi-employees"],
    queryFn: () => empFn({ data: { limit: 5 } }),
  });
  const { data: topCortes = [] } = useQuery({
    queryKey: ["kpi-yield-cortes"],
    queryFn: () => yldFn({ data: { dimension: "corte", limit: 8 } }),
  });
  const { data: losses = [] } = useQuery({
    queryKey: ["kpi-losses"],
    queryFn: () => lossFn({ data: {} }),
  });

  const topSuppliersVol = [...supRend].sort((a, b) => b.peso_recebido - a.peso_recebido).slice(0, 5);
  const topSuppliersRend = [...supRend].sort((a, b) => b.rendimento_pct - a.rendimento_pct).slice(0, 5);

  return (
    <AppShell
      title="Painel de Controle"
      subtitle="Visão consolidada da operação"
      actions={
        perms.canCreateOrders ? (
          <Link
            to="/ordens"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold hover:opacity-90"
          >
            + Nova Ordem
          </Link>
        ) : null
      }
    >
      {/* KPIs de fluxo */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatusPill label="Pendentes" value={op?.pendentes ?? 0} color="secondary" icon={ClipboardList} to="/ordens" search={{ status: "pendente" }} />
        <StatusPill label="Atribuídas" value={op?.atribuidas ?? 0} color="blue" icon={ClipboardCheck} to="/ordens" search={{ status: "atribuida" }} />
        <StatusPill label="Em Andamento" value={op?.em_andamento ?? 0} color="warning" icon={Clock} to="/ordens" search={{ status: "em_andamento" }} />
        <StatusPill label="Finalizadas" value={op?.finalizadas ?? 0} color="success" icon={ClipboardCheck} to="/ordens" search={{ status: "finalizada" }} />
        <StatusPill label="Canceladas" value={op?.canceladas ?? 0} color="muted" icon={ClipboardList} to="/ordens" search={{ status: "cancelada" }} />
        <StatusPill label="Divergências" value={op?.divergencias ?? 0} color="destructive" icon={AlertTriangle} to="/ordens" search={{ divergencia: "1" }} />
      </section>

      {/* KPIs numéricos */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Peso Total Recebido" value={formatKg(ex?.peso_recebido ?? 0, 2)} unit="kg" icon={Scale} />
        <KpiCard label="Peso Aproveitado" value={formatKg(ex?.peso_aproveitado ?? 0, 2)} unit="kg" icon={TrendingUp} />
        <KpiCard label="Peso Perdido" value={formatKg(ex?.peso_perdido ?? 0, 2)} unit="kg" icon={Package} />
        <KpiCard label="Rendimento Médio" value={formatPercent(ex?.rendimento_medio_pct ?? 0)} unit="%" icon={TrendingUp} highlight />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Rendimento diário */}
          <div className="bg-panel border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Rendimento (últimos 7 dias)</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Média por dia</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} unit="%" />
                  <Tooltip
                    contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, "Rendimento"]}
                  />
                  <Area type="monotone" dataKey="rendimento_pct" stroke="var(--color-primary)" strokeWidth={2} fill="url(#rendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cortes mais produzidos */}
          <div className="bg-panel border rounded-lg p-6">
            <h2 className="font-bold mb-4">Cortes mais produzidos</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCortes} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} angle={-25} textAnchor="end" height={60} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} unit=" kg" />
                  <Tooltip
                    contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                    formatter={(v: number) => [`${formatKg(v, 2)} kg`, "Total"]}
                  />
                  <Bar dataKey="peso_aproveitado" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Perdas por categoria */}
          <div className="bg-panel border rounded-lg p-6">
            <h2 className="font-bold mb-4">Ranking de perdas por categoria</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={losses} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} unit=" kg" />
                  <YAxis type="category" dataKey="label" stroke="var(--color-muted-foreground)" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                    formatter={(v: number) => [`${formatKg(v, 2)} kg`, "Perda"]}
                  />
                  <Bar dataKey="peso" radius={[0, 4, 4, 0]}>
                    {losses.map((_, i) => (
                      <Cell key={i} fill="var(--color-warning)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Rankings laterais */}
        <div className="space-y-6">
          <RankingCard
            title="Top Fornecedores — Rendimento"
            items={topSuppliersRend.map((s) => ({
              name: s.name,
              detail: `${s.ordens} desossas · ${formatKg(s.peso_aproveitado, 2)} kg aprov.`,
              value: `${formatPercent(s.rendimento_pct)}%`,
              to: "/ordens",
              search: { supplier_id: (s as any).id },
            }))}
          />
          <RankingCard
            title="Top Fornecedores — Volume"
            items={topSuppliersVol.map((s) => ({
              name: s.name,
              detail: `${s.ordens} desossas`,
              value: `${formatKg(s.peso_recebido, 2)} kg`,
              to: "/ordens",
              search: { supplier_id: (s as any).id },
            }))}
          />
          <RankingCard
            title="Top Açougueiros"
            items={emps.map((s) => ({
              name: s.name,
              detail: `${s.ordens} desossas · ${formatKg(s.peso_aproveitado, 2)} kg${
                s.tempo_medio_min ? ` · ${Math.round(s.tempo_medio_min)}min` : ""
              }`,
              value: `${formatPercent(s.rendimento_pct)}%`,
              to: "/ordens",
              search: { employee_id: (s as any).id },
            }))}
          />
        </div>
      </div>
    </AppShell>
  );
}

function StatusPill({
  label,
  value,
  color,
  icon: Icon,
  to,
  search,
}: {
  label: string;
  value: number;
  color: "secondary" | "blue" | "warning" | "success" | "destructive" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  search?: Record<string, string>;
}) {
  const cls: Record<string, string> = {
    secondary: "bg-secondary text-foreground",
    blue: "bg-chart-4/10 text-blue-700",
    warning: "bg-warning/15 text-amber-700",
    success: "bg-success/15 text-emerald-700",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-secondary text-muted-foreground",
  };
  const inner = (
    <>
      <Icon className="size-5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest opacity-80 truncate">{label}</div>
        <div className="font-mono font-bold text-xl leading-none">{value}</div>
      </div>
    </>
  );
  const className = `rounded-md p-3 flex items-center gap-3 animate-fade-in ${cls[color]} ${to ? "hover:opacity-90 cursor-pointer transition-opacity" : ""}`;
  if (to) {
    return (
      <Link to={to} search={search as any} className={className} aria-label={`Ver ${label}`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-panel p-5 rounded-lg border shadow-sm animate-fade-in ${
        highlight ? "border-l-2 border-l-primary" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold tracking-tight">{value}</span>
        {unit ? <span className="text-sm font-medium text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: { name: string; detail: string; value: string; to?: string; search?: Record<string, string | undefined> }[];
}) {
  return (
    <div className="bg-panel border rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{title}</h3>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sem dados no período.</div>
      ) : (
        <ol className="space-y-3">
          {items.map((it, i) => {
            const row = (
              <>
                <span className="size-6 rounded bg-secondary text-[11px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{it.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{it.detail}</div>
                </div>
                <span className="font-mono text-sm font-bold">{it.value}</span>
              </>
            );
            return (
              <li key={`${it.name}-${i}`}>
                {it.to && it.search ? (
                  <Link
                    to={it.to}
                    search={it.search as any}
                    className="flex items-center gap-3 -mx-2 px-2 py-1 rounded-md hover:bg-secondary/60 transition-colors"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">{row}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
