import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { usePermissions } from "@/hooks/use-permissions";
import { formatKg, formatPercent, formatDate, formatDuration } from "@/lib/format";
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
      { title: "Dashboard — CarnePro" },
      { name: "description", content: "Painel gerencial da desossa: rendimento, ordens, fornecedores e produtividade." },
    ],
  }),
  component: Dashboard,
});

interface OrderRow {
  id: string;
  order_code: string | null;
  peso_inicial: number;
  peso_aproveitado: number | null;
  rendimento_pct: number | null;
  divergencia_kg: number | null;
  finalizada_com_divergencia: boolean;
  status: string;
  order_date: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  products: { name: string } | null;
  pecas_entrada: { name: string } | null;
  suppliers: { razao_social: string; nome_fantasia: string | null } | null;
  employees: { full_name: string } | null;
  deboning_pieces: { peso: number; quantidade: number; corte_id: string | null; cortes?: { name: string; category_id: string | null } | null }[];
  deboning_losses:
    | { ossos: number; gordura: number; retalhos: number; descarte: number; outros: number }[]
    | null;
  product_categories?: { name: string } | null;
}

function Dashboard() {
  const navigate = useNavigate();
  const perms = usePermissions();

  useEffect(() => {
    if (!perms.isLoading && perms.context && perms.isAcougueiro && !perms.isAdmin && !perms.isSupervisor) {
      navigate({ to: "/mobile", replace: true });
    }
  }, [perms.isLoading, perms.context, perms.isAcougueiro, perms.isAdmin, perms.isSupervisor, navigate]);

  const { data: orders = [] } = useQuery({
    queryKey: ["dashboard-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, order_code, peso_inicial, peso_aproveitado, rendimento_pct, divergencia_kg,
           finalizada_com_divergencia, status, order_date, created_at, started_at, finished_at,
           products:product_id(name),
           pecas_entrada:peca_entrada_id(name, category_id, product_categories:category_id(name)),
           suppliers:supplier_id(razao_social, nome_fantasia),
           employees:assigned_employee_id(full_name),
           deboning_pieces(peso, quantidade, corte_id, cortes:corte_id(name, category_id)),
           deboning_losses(ossos, gordura, retalhos, descarte, outros)`,
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const finalizadas = orders.filter((o) => o.status === "finalizada");
  const pendentes = orders.filter((o) => o.status === "pendente");
  const atribuidas = orders.filter((o) => o.status === "atribuida");
  const emAndamento = orders.filter((o) => o.status === "em_andamento");
  const canceladas = orders.filter((o) => o.status === "cancelada");
  const comDivergencia = orders.filter((o) => o.finalizada_com_divergencia);

  const totalRecebido = orders.reduce((s, o) => s + Number(o.peso_inicial || 0), 0);
  const totalAprov = finalizadas.reduce(
    (s, o) =>
      s +
      (o.peso_aproveitado ??
        o.deboning_pieces.reduce((a, p) => a + Number(p.peso) * Number(p.quantidade || 1), 0)),
    0,
  );
  const totalPerdido = finalizadas.reduce((s, o) => {
    const l = o.deboning_losses?.[0];
    if (!l) return s;
    return s + Number(l.ossos) + Number(l.gordura) + Number(l.retalhos) + Number(l.descarte) + Number(l.outros);
  }, 0);
  const rendMedio = totalRecebido > 0 ? (totalAprov / totalRecebido) * 100 : 0;

  // Últimos 7 dias — rendimento por dia
  const dias: { label: string; rendimento: number; aprov: number; perda: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayOrders = finalizadas.filter((o) => o.order_date === key);
    const inicial = dayOrders.reduce((s, o) => s + Number(o.peso_inicial), 0);
    const aprov = dayOrders.reduce(
      (s, o) =>
        s + o.deboning_pieces.reduce((a, p) => a + Number(p.peso) * Number(p.quantidade || 1), 0),
      0,
    );
    const perda = dayOrders.reduce((s, o) => {
      const l = o.deboning_losses?.[0];
      if (!l) return s;
      return s + Number(l.ossos) + Number(l.gordura) + Number(l.retalhos) + Number(l.descarte) + Number(l.outros);
    }, 0);
    dias.push({
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      rendimento: inicial > 0 ? Number(((aprov / inicial) * 100).toFixed(1)) : 0,
      aprov,
      perda,
    });
  }

  // Fornecedores
  const supAgg = new Map<string, { name: string; peso: number; aprov: number; count: number }>();
  const empAgg = new Map<string, { name: string; peso: number; aprov: number; count: number; timeMs: number; timeCount: number }>();
  const corteAgg = new Map<string, { name: string; peso: number }>();
  const perdaCatAgg = new Map<string, { name: string; peso: number }>();
  const catTimeAgg = new Map<string, { name: string; timeMs: number; count: number }>();

  for (const o of finalizadas) {
    const supKey = o.suppliers?.nome_fantasia ?? o.suppliers?.razao_social ?? "—";
    const cur = supAgg.get(supKey) ?? { name: supKey, peso: 0, aprov: 0, count: 0 };
    cur.peso += Number(o.peso_inicial);
    const orderAprov = o.deboning_pieces.reduce((a, p) => a + Number(p.peso) * Number(p.quantidade || 1), 0);
    cur.aprov += orderAprov;
    cur.count += 1;
    supAgg.set(supKey, cur);

    const empKey = o.employees?.full_name ?? "—";
    const dur = o.started_at && o.finished_at ? new Date(o.finished_at).getTime() - new Date(o.started_at).getTime() : 0;
    const ec = empAgg.get(empKey) ?? { name: empKey, peso: 0, aprov: 0, count: 0, timeMs: 0, timeCount: 0 };
    ec.peso += Number(o.peso_inicial);
    ec.aprov += orderAprov;
    ec.count += 1;
    if (dur > 0) {
      ec.timeMs += dur;
      ec.timeCount += 1;
    }
    empAgg.set(empKey, ec);

    // Cortes produzidos
    for (const p of o.deboning_pieces) {
      const cname = p.cortes?.name ?? "Sem corte";
      const c = corteAgg.get(cname) ?? { name: cname, peso: 0 };
      c.peso += Number(p.peso) * Number(p.quantidade || 1);
      corteAgg.set(cname, c);
    }

    // Perdas por categoria
    const l = o.deboning_losses?.[0];
    if (l) {
      const cats: Array<[string, number]> = [
        ["Ossos", Number(l.ossos)],
        ["Gordura", Number(l.gordura)],
        ["Retalhos", Number(l.retalhos)],
        ["Descarte", Number(l.descarte)],
        ["Outros", Number(l.outros)],
      ];
      for (const [n, v] of cats) {
        const cur = perdaCatAgg.get(n) ?? { name: n, peso: 0 };
        cur.peso += v;
        perdaCatAgg.set(n, cur);
      }
    }

    // Tempo por categoria (via peça de entrada)
    const catName = (o.pecas_entrada as any)?.product_categories?.name ?? o.products?.name ?? "Outros";
    if (dur > 0) {
      const cur = catTimeAgg.get(catName) ?? { name: catName, timeMs: 0, count: 0 };
      cur.timeMs += dur;
      cur.count += 1;
      catTimeAgg.set(catName, cur);
    }
  }

  const topSuppliersRend = [...supAgg.values()]
    .map((s) => ({ ...s, rend: s.peso > 0 ? (s.aprov / s.peso) * 100 : 0 }))
    .sort((a, b) => b.rend - a.rend)
    .slice(0, 5);
  const topSuppliersVol = [...supAgg.values()].sort((a, b) => b.peso - a.peso).slice(0, 5);

  const topEmployees = [...empAgg.values()]
    .map((s) => ({ ...s, rend: s.peso > 0 ? (s.aprov / s.peso) * 100 : 0 }))
    .sort((a, b) => b.rend - a.rend)
    .slice(0, 5);

  const topCortes = [...corteAgg.values()].sort((a, b) => b.peso - a.peso).slice(0, 8);
  const topPerdas = [...perdaCatAgg.values()].sort((a, b) => b.peso - a.peso);
  const tempoPorCategoria = [...catTimeAgg.values()].map((c) => ({
    name: c.name,
    minutos: Math.round(c.timeMs / 1000 / 60 / (c.count || 1)),
  }));

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
        <StatusPill label="Pendentes" value={pendentes.length} color="secondary" icon={ClipboardList} />
        <StatusPill label="Atribuídas" value={atribuidas.length} color="blue" icon={ClipboardCheck} />
        <StatusPill label="Em Andamento" value={emAndamento.length} color="warning" icon={Clock} />
        <StatusPill label="Finalizadas" value={finalizadas.length} color="success" icon={ClipboardCheck} />
        <StatusPill label="Canceladas" value={canceladas.length} color="muted" icon={ClipboardList} />
        <StatusPill label="Divergências" value={comDivergencia.length} color="destructive" icon={AlertTriangle} />
      </section>

      {/* KPIs numéricos */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Peso Total Recebido" value={formatKg(totalRecebido, 2)} unit="kg" icon={Scale} />
        <KpiCard label="Peso Aproveitado" value={formatKg(totalAprov, 2)} unit="kg" icon={TrendingUp} />
        <KpiCard label="Peso Perdido" value={formatKg(totalPerdido, 2)} unit="kg" icon={Package} />
        <KpiCard label="Rendimento Médio" value={formatPercent(rendMedio)} unit="%" icon={TrendingUp} highlight />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Gráfico rendimento */}
          <div className="bg-panel border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Rendimento (últimos 7 dias)</h2>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Média por dia
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dias} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  <Bar dataKey="peso" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Perdas por categoria */}
          <div className="bg-panel border rounded-lg p-6">
            <h2 className="font-bold mb-4">Ranking de perdas por categoria</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topPerdas} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} unit=" kg" />
                  <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} width={80} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                    formatter={(v: number) => [`${formatKg(v, 2)} kg`, "Perda"]}
                  />
                  <Bar dataKey="peso" radius={[0, 4, 4, 0]}>
                    {topPerdas.map((_, i) => (
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
              detail: `${s.count} desossas · ${formatKg(s.aprov, 2)} kg aprov.`,
              value: `${formatPercent(s.rend)}%`,
            }))}
          />
          <RankingCard
            title="Top Fornecedores — Volume"
            items={topSuppliersVol.map((s) => ({
              name: s.name,
              detail: `${s.count} desossas`,
              value: `${formatKg(s.peso, 2)} kg`,
            }))}
          />
          <RankingCard
            title="Top Açougueiros"
            items={topEmployees.map((s) => ({
              name: s.name,
              detail: `${s.count} desossas · ${formatKg(s.aprov, 2)} kg`,
              value: `${formatPercent(s.rend)}%`,
            }))}
          />
          {tempoPorCategoria.length > 0 ? (
            <div className="bg-panel border rounded-lg p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Tempo médio por categoria
              </h3>
              <div className="space-y-2">
                {tempoPorCategoria.map((t) => (
                  <div key={t.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.name}</span>
                    <span className="font-mono font-bold">{t.minutos}min</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Ordens em andamento */}
      {(atribuidas.length > 0 || emAndamento.length > 0) && (
        <div className="bg-panel border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-bold">Ordens ativas</h2>
            <Link to="/ordens" className="text-xs font-bold text-primary uppercase tracking-widest">
              Ver todas
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary/50 border-b">
                  <Th>Código</Th>
                  <Th>Peça / Produto</Th>
                  <Th>Fornecedor</Th>
                  <Th>Açougueiro</Th>
                  <Th className="text-right">Peso Inicial</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[...atribuidas, ...emAndamento].slice(0, 8).map((o) => (
                  <tr key={o.id} className="border-b hover:bg-secondary/40">
                    <td className="px-6 py-3">
                      <Link to="/ordens/$id" params={{ id: o.id }} className="font-mono font-semibold hover:text-primary">
                        {o.order_code ?? o.id.slice(0, 6)}
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-semibold">
                      {o.pecas_entrada?.name ?? o.products?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {o.suppliers?.nome_fantasia ?? o.suppliers?.razao_social ?? "—"}
                    </td>
                    <td className="px-6 py-3">{o.employees?.full_name ?? "—"}</td>
                    <td className="px-6 py-3 text-right font-mono">{formatKg(o.peso_inicial, 2)} kg</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${className}`}>
      {children}
    </th>
  );
}

function StatusPill({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: "secondary" | "blue" | "warning" | "success" | "destructive" | "muted";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const cls: Record<string, string> = {
    secondary: "bg-secondary text-foreground",
    blue: "bg-chart-4/10 text-blue-700",
    warning: "bg-warning/15 text-amber-700",
    success: "bg-success/15 text-emerald-700",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-secondary text-muted-foreground",
  };
  return (
    <div className={`rounded-md p-3 flex items-center gap-3 animate-fade-in ${cls[color]}`}>
      <Icon className="size-5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest opacity-80 truncate">{label}</div>
        <div className="font-mono font-bold text-xl leading-none">{value}</div>
      </div>
    </div>
  );
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-secondary text-muted-foreground" },
    atribuida: { label: "Atribuída", cls: "bg-chart-4/10 text-blue-700" },
    em_andamento: { label: "Em desossa", cls: "bg-warning/15 text-amber-700" },
    aguardando_conferencia: { label: "Aguardando", cls: "bg-warning/15 text-amber-700" },
    finalizada: { label: "Finalizada", cls: "bg-success/15 text-emerald-700" },
    cancelada: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
  };
  const s = map[status] ?? map.pendente;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${s.cls}`}>
      {s.label}
    </span>
  );
}

function RankingCard({ title, items }: { title: string; items: { name: string; detail: string; value: string }[] }) {
  return (
    <div className="bg-panel border rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Sem dados ainda.</p>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={it.name + i} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{it.name}</div>
                <div className="text-[10px] text-muted-foreground">{it.detail}</div>
              </div>
              <div className={`font-mono font-bold text-sm shrink-0 ${i === 0 ? "text-success" : ""}`}>{it.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
