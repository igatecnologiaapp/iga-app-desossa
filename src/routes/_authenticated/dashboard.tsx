import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useUserContext } from "@/hooks/use-auth";
import { formatKg, formatPercent, formatDate } from "@/lib/format";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Package, TrendingUp, TrendingDown, Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CarnePro" }] }),
  component: Dashboard,
});

interface OrderRow {
  id: string;
  order_code: string | null;
  peso_inicial: number;
  status: "pendente" | "em_andamento" | "finalizada";
  order_date: string;
  created_at: string;
  finished_at: string | null;
  products: { name: string } | null;
  suppliers: { razao_social: string; nome_fantasia: string | null } | null;
  employees: { full_name: string } | null;
  deboning_pieces: { peso: number; quantidade: number }[];
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

function Dashboard() {
  const navigate = useNavigate();
  const { context, isLoading: userLoading } = useUserContext();

  useEffect(() => {
    if (!userLoading && context && !context.isAdmin) {
      navigate({ to: "/mobile", replace: true });
    }
  }, [context, userLoading, navigate]);

  const { data: orders = [] } = useQuery({
    queryKey: ["dashboard-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, order_code, peso_inicial, status, order_date, created_at, finished_at,
           products:product_id(name),
           suppliers:supplier_id(razao_social, nome_fantasia),
           employees:assigned_employee_id(full_name),
           deboning_pieces(peso, quantidade),
           deboning_losses(ossos, gordura, retalhos, descarte, outros)`,
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  // KPIs de hoje
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.order_date === today);
  const pesoRecebido = todayOrders.reduce((s, o) => s + Number(o.peso_inicial), 0);
  const desossasHoje = todayOrders.length;
  const pesoAproveitadoHoje = todayOrders.reduce((s, o) => {
    return (
      s +
      o.deboning_pieces.reduce(
        (a, p) => a + Number(p.peso) * Number(p.quantidade || 1),
        0,
      )
    );
  }, 0);
  const rendimentoMedio =
    pesoRecebido > 0 ? (pesoAproveitadoHoje / pesoRecebido) * 100 : 0;

  const emAndamento = orders.filter((o) => o.status !== "finalizada").slice(0, 6);

  // Histórico 7 dias
  const dias: { date: string; label: string; rendimento: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayOrders = orders.filter((o) => o.order_date === key && o.status === "finalizada");
    const inicial = dayOrders.reduce((s, o) => s + Number(o.peso_inicial), 0);
    const aprov = dayOrders.reduce(
      (s, o) =>
        s +
        o.deboning_pieces.reduce(
          (a, p) => a + Number(p.peso) * Number(p.quantidade || 1),
          0,
        ),
      0,
    );
    dias.push({
      date: key,
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      rendimento: inicial > 0 ? Number(((aprov / inicial) * 100).toFixed(1)) : 0,
    });
  }

  // Rankings
  const supplierAgg = new Map<
    string,
    { name: string; peso: number; aprov: number; count: number }
  >();
  const empAgg = new Map<
    string,
    { name: string; peso: number; aprov: number; count: number }
  >();
  for (const o of orders.filter((o) => o.status === "finalizada")) {
    const supKey = o.suppliers?.razao_social ?? "—";
    const cur = supplierAgg.get(supKey) ?? {
      name: supKey,
      peso: 0,
      aprov: 0,
      count: 0,
    };
    cur.peso += Number(o.peso_inicial);
    cur.aprov += o.deboning_pieces.reduce(
      (a, p) => a + Number(p.peso) * Number(p.quantidade || 1),
      0,
    );
    cur.count += 1;
    supplierAgg.set(supKey, cur);

    const empKey = o.employees?.full_name ?? "—";
    const ec = empAgg.get(empKey) ?? { name: empKey, peso: 0, aprov: 0, count: 0 };
    ec.peso += Number(o.peso_inicial);
    ec.aprov += o.deboning_pieces.reduce(
      (a, p) => a + Number(p.peso) * Number(p.quantidade || 1),
      0,
    );
    ec.count += 1;
    empAgg.set(empKey, ec);
  }
  const topSuppliers = [...supplierAgg.values()]
    .map((s) => ({ ...s, rend: s.peso > 0 ? (s.aprov / s.peso) * 100 : 0 }))
    .sort((a, b) => b.rend - a.rend)
    .slice(0, 5);
  const topEmployees = [...empAgg.values()]
    .map((s) => ({ ...s, rend: s.peso > 0 ? (s.aprov / s.peso) * 100 : 0 }))
    .sort((a, b) => b.rend - a.rend)
    .slice(0, 5);

  return (
    <AppShell
      title="Painel de Controle"
      subtitle="Visão consolidada da operação de desossa"
      actions={
        <Link
          to="/ordens"
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold"
        >
          + Nova Ordem
        </Link>
      }
    >
      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Desossas Hoje"
          value={String(desossasHoje)}
          icon={Package}
          animDelay={0}
        />
        <KpiCard
          label="Peso Recebido"
          value={formatKg(pesoRecebido)}
          unit="kg"
          icon={Scale}
          animDelay={60}
        />
        <KpiCard
          label="Peso Aproveitado"
          value={formatKg(pesoAproveitadoHoje)}
          unit="kg"
          icon={TrendingUp}
          animDelay={120}
        />
        <KpiCard
          label="Rendimento Médio"
          value={formatPercent(rendimentoMedio)}
          unit="%"
          icon={TrendingDown}
          highlight
          animDelay={180}
        />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Ordens em andamento */}
          <div className="bg-panel border rounded-lg overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold">Ordens em Andamento</h2>
              <Link
                to="/ordens"
                className="text-xs font-bold text-primary uppercase tracking-widest"
              >
                Ver todas
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-secondary/50 border-b">
                    <Th>Lote / Produto</Th>
                    <Th>Fornecedor</Th>
                    <Th>Açougueiro</Th>
                    <Th className="text-right">Peso Inicial</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {emAndamento.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        Nenhuma ordem em andamento. Crie a primeira em{" "}
                        <Link to="/ordens" className="text-primary font-semibold">
                          Ordens de Desossa
                        </Link>
                        .
                      </td>
                    </tr>
                  ) : (
                    emAndamento.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b hover:bg-secondary/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            to="/ordens/$id"
                            params={{ id: o.id }}
                            className="font-semibold hover:text-primary"
                          >
                            {o.order_code ?? `#${o.id.slice(0, 6)}`} —{" "}
                            {o.products?.name ?? "—"}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(o.order_date)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {o.suppliers?.nome_fantasia ??
                            o.suppliers?.razao_social ??
                            "—"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {o.employees?.full_name ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          {formatKg(o.peso_inicial)} kg
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico */}
          <div className="bg-panel border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Rendimento Semanal</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Últimos 7 dias
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dias} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-panel)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v}%`, "Rendimento"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="rendimento"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#rendGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Rankings */}
        <div className="space-y-6">
          <RankingCard
            title="Top Fornecedores"
            items={topSuppliers.map((s) => ({
              name: s.name,
              detail: `${s.count} ordens · ${formatKg(s.peso)} kg`,
              value: `${formatPercent(s.rend)}%`,
            }))}
          />
          <RankingCard
            title="Top Açougueiros"
            items={topEmployees.map((s) => ({
              name: s.name,
              detail: `${s.count} desossas`,
              value: `${formatPercent(s.rend)}%`,
            }))}
          />
        </div>
      </div>
    </AppShell>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${className}`}
    >
      {children}
    </th>
  );
}

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  highlight,
  animDelay = 0,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  animDelay?: number;
}) {
  return (
    <div
      className={`bg-panel p-5 rounded-lg border shadow-sm animate-fade-in ${highlight ? "border-l-2 border-l-primary" : ""}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold tracking-tight">{value}</span>
        {unit ? (
          <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderRow["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: {
      label: "Pendente",
      cls: "bg-secondary text-muted-foreground",
    },
    em_andamento: {
      label: "Em desossa",
      cls: "bg-warning/15 text-amber-700",
    },
    finalizada: {
      label: "Finalizada",
      cls: "bg-success/15 text-emerald-700",
    },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: { name: string; detail: string; value: string }[];
}) {
  return (
    <div className="bg-panel border rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Sem dados ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={it.name + i} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{it.name}</div>
                <div className="text-[10px] text-muted-foreground">{it.detail}</div>
              </div>
              <div
                className={`font-mono font-bold text-sm shrink-0 ${i === 0 ? "text-success" : ""}`}
              >
                {it.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
