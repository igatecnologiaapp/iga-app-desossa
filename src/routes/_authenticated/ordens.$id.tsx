import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { formatKg, formatPercent, formatDate, formatDateTime } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ordens/$id")({
  head: () => ({ meta: [{ title: "Ordem — CarnePro" }] }),
  component: OrdemDetalhe,
});

function OrdemDetalhe() {
  const { id } = Route.useParams();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, order_code, peso_inicial, peso_aproveitado, rendimento_pct, status,
           order_date, started_at, finished_at, observacoes, observacoes_finalizacao,
           products:product_id(name),
           suppliers:supplier_id(razao_social, nome_fantasia),
           employees:assigned_employee_id(full_name),
           deboning_pieces(id, peso, quantidade),
           deboning_losses(ossos, gordura, retalhos, descarte, outros)`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      title={order?.order_code ?? "Ordem"}
      subtitle={(order as any)?.products?.name ?? ""}
      actions={
        <Link
          to="/ordens"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      }
    >
      {isLoading || !order ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-panel border rounded-lg p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <KV label="Peso Inicial" value={`${formatKg(order.peso_inicial)} kg`} />
              <KV
                label="Aproveitado"
                value={order.peso_aproveitado ? `${formatKg(order.peso_aproveitado)} kg` : "—"}
              />
              <KV
                label="Rendimento"
                value={order.rendimento_pct ? `${formatPercent(order.rendimento_pct)}%` : "—"}
              />
              <KV label="Status" value={order.status} />
            </div>

            <div className="bg-panel border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b font-bold">Peças aproveitadas</div>
              {order.deboning_pieces.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  Nenhuma peça registrada.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-secondary/50 border-b">
                      <th className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">#</th>
                      <th className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Peso</th>
                      <th className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Qtd</th>
                      <th className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.deboning_pieces.map((p: any, i: number) => (
                      <tr key={p.id} className="border-b">
                        <td className="px-6 py-2">{i + 1}</td>
                        <td className="px-6 py-2 text-right font-mono">{formatKg(p.peso)} kg</td>
                        <td className="px-6 py-2 text-right font-mono">{p.quantidade}</td>
                        <td className="px-6 py-2 text-right font-mono font-semibold">
                          {formatKg(Number(p.peso) * Number(p.quantidade))} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {(() => {
              const raw = (order as any).deboning_losses;
              const losses = Array.isArray(raw) ? raw[0] : raw;
              if (!losses) return null;
              return (
                <div className="bg-panel border rounded-lg p-6">
                  <div className="font-bold mb-4">Perdas</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    {(
                      [
                        ["ossos", "Ossos"],
                        ["gordura", "Gordura"],
                        ["retalhos", "Retalhos"],
                        ["descarte", "Descarte"],
                        ["outros", "Outros"],
                      ] as const
                    ).map(([k, l]) => (
                      <KV key={k} label={l} value={`${formatKg(losses[k])} kg`} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-4">
            <div className="bg-panel border rounded-lg p-6 space-y-3 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Dados
              </div>
              <KVBlock label="Fornecedor" value={(order as any).suppliers?.razao_social ?? "—"} />
              <KVBlock label="Açougueiro" value={(order as any).employees?.full_name ?? "—"} />
              <KVBlock label="Data" value={formatDate(order.order_date)} />
              <KVBlock label="Iniciada" value={order.started_at ? formatDateTime(order.started_at) : "—"} />
              <KVBlock label="Finalizada" value={order.finished_at ? formatDateTime(order.finished_at) : "—"} />
            </div>
            {order.observacoes || order.observacoes_finalizacao ? (
              <div className="bg-panel border rounded-lg p-6 text-sm space-y-3">
                {order.observacoes ? (
                  <KVBlock label="Observações" value={order.observacoes} />
                ) : null}
                {order.observacoes_finalizacao ? (
                  <KVBlock label="Notas da execução" value={order.observacoes_finalizacao} />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="font-mono font-bold text-lg mt-1">{value}</div>
    </div>
  );
}
function KVBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
