import { createFileRoute } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { formatKg, formatPercent } from "@/lib/format";
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
  const { data: orders = [] } = useQuery({
    queryKey: ["reports-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, peso_inicial, status, order_date,
           products:product_id(name),
           suppliers:supplier_id(razao_social),
           employees:assigned_employee_id(full_name),
           deboning_pieces(peso, quantidade),
           deboning_losses(ossos, gordura, retalhos, descarte, outros)`,
        )
        .eq("status", "finalizada")
        .order("order_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Agregação por produto
  const productAgg = new Map<string, { name: string; inicial: number; aprov: number; count: number }>();
  for (const o of orders as any[]) {
    const key = o.products?.name ?? "—";
    const cur = productAgg.get(key) ?? { name: key, inicial: 0, aprov: 0, count: 0 };
    cur.inicial += Number(o.peso_inicial);
    cur.aprov += o.deboning_pieces.reduce(
      (a: number, p: any) => a + Number(p.peso) * Number(p.quantidade || 1),
      0,
    );
    cur.count += 1;
    productAgg.set(key, cur);
  }
  const byProduct = [...productAgg.values()]
    .map((p) => ({
      name: p.name.length > 20 ? p.name.slice(0, 18) + "…" : p.name,
      fullName: p.name,
      rendimento: p.inicial > 0 ? Number(((p.aprov / p.inicial) * 100).toFixed(1)) : 0,
      count: p.count,
      inicial: p.inicial,
      aprov: p.aprov,
    }))
    .sort((a, b) => b.rendimento - a.rendimento)
    .slice(0, 12);

  // Perdas por categoria
  const lossAgg = { ossos: 0, gordura: 0, retalhos: 0, descarte: 0, outros: 0 };
  for (const o of orders as any[]) {
    const l = o.deboning_losses?.[0];
    if (!l) continue;
    lossAgg.ossos += Number(l.ossos);
    lossAgg.gordura += Number(l.gordura);
    lossAgg.retalhos += Number(l.retalhos);
    lossAgg.descarte += Number(l.descarte);
    lossAgg.outros += Number(l.outros);
  }
  const lossData = [
    { name: "Ossos", value: lossAgg.ossos },
    { name: "Gordura", value: lossAgg.gordura },
    { name: "Retalhos", value: lossAgg.retalhos },
    { name: "Descarte", value: lossAgg.descarte },
    { name: "Outros", value: lossAgg.outros },
  ];

  const totalInicial = (orders as any[]).reduce((s, o) => s + Number(o.peso_inicial), 0);
  const totalAprov = (orders as any[]).reduce(
    (s, o) =>
      s +
      o.deboning_pieces.reduce(
        (a: number, p: any) => a + Number(p.peso) * Number(p.quantidade || 1),
        0,
      ),
    0,
  );
  const rendMedio = totalInicial > 0 ? (totalAprov / totalInicial) * 100 : 0;

  return (
    <AppShell title="Relatórios" subtitle={`${orders.length} desossas finalizadas`}>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Peso Total Recebido" value={`${formatKg(totalInicial)} kg`} />
        <KpiCard label="Peso Total Aproveitado" value={`${formatKg(totalAprov)} kg`} />
        <KpiCard label="Rendimento Médio" value={`${formatPercent(rendMedio)}%`} highlight />
      </section>

      <div className="bg-panel border rounded-lg p-6">
        <h2 className="font-bold mb-4">Rendimento por Produto</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byProduct} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                angle={-25}
                textAnchor="end"
              />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
                formatter={(v: number) => [`${v}%`, "Rendimento"]}
                labelFormatter={(_, p) => (p?.[0]?.payload as any)?.fullName ?? ""}
              />
              <Bar dataKey="rendimento" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-panel border rounded-lg p-6">
        <h2 className="font-bold mb-4">Perdas por Categoria (kg)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lossData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} unit=" kg" />
              <Tooltip
                contentStyle={{
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                }}
                formatter={(v: number) => [`${formatKg(v)} kg`, "Total"]}
              />
              <Legend />
              <Bar dataKey="value" name="Perda" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-panel p-5 rounded-lg border ${highlight ? "border-l-2 border-l-primary" : ""}`}>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="font-mono text-3xl font-bold tracking-tight mt-2">{value}</div>
    </div>
  );
}
