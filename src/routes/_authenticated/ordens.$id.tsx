import { createFileRoute, Link } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  formatKg,
  formatPercent,
  formatDate,
  formatDateTime,
  formatDuration,
  formatCurrency,
} from "@/lib/format";
import { OrderHistoryTimeline } from "@/components/order-history-timeline";
import { ReconciliationPanel } from "@/components/reconciliation-panel";
import {
  reconcile,
  custoPorKg,
  precoSugerido,
  type Reconciliation,
  DEFAULT_TOLERANCE,
} from "@/lib/deboning-calcs";
import { useTenantSettings } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, DollarSign, Clock, Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ordens/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da Ordem — CarnePro" },
      { name: "description", content: "Detalhe, conciliação e precificação da ordem de desossa." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin", "supervisor", "visualizacao"]),
  component: OrdemDetalhe,
});

function OrdemDetalhe() {
  const { id } = Route.useParams();
  const { data: settings } = useTenantSettings();
  const [margem, setMargem] = useState<string>("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, order_code, peso_inicial, peso_aproveitado, rendimento_pct, divergencia_kg, divergencia_pct,
           finalizada_com_divergencia, valor_compra, margem_pct, status, order_date, started_at,
           finished_at, observacoes, observacoes_finalizacao, cancellation_reason,
           products:product_id(name),
           pecas_entrada:peca_entrada_id(name, product_categories:category_id(name)),
           suppliers:supplier_id(razao_social, nome_fantasia),
           employees:assigned_employee_id(full_name),
           deboning_pieces(id, peso, quantidade, observacoes, cortes:corte_id(name, code)),
           deboning_losses(ossos, gordura, retalhos, descarte, outros, observacoes)`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !order) {
    return (
      <AppShell title="Ordem">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </AppShell>
    );
  }

  const rawLosses = (order as any).deboning_losses;
  const losses = (Array.isArray(rawLosses) ? rawLosses[0] : rawLosses) ?? {
    ossos: 0,
    gordura: 0,
    retalhos: 0,
    descarte: 0,
    outros: 0,
  };
  const pieces = (order as any).deboning_pieces ?? [];

  const rec: Reconciliation = reconcile(
    Number(order.peso_inicial),
    pieces.map((p: any) => ({ peso: Number(p.peso), quantidade: Number(p.quantidade || 1) })),
    {
      ossos: Number(losses.ossos || 0),
      gordura: Number(losses.gordura || 0),
      retalhos: Number(losses.retalhos || 0),
      descarte: Number(losses.descarte || 0),
      outros: Number(losses.outros || 0),
    },
  );

  const tolerance = {
    divergenciaMaximaKg: Number(settings?.divergencia_maxima_kg ?? DEFAULT_TOLERANCE.divergenciaMaximaKg),
    atencaoPct: Number(settings?.atencao_pct ?? DEFAULT_TOLERANCE.atencaoPct),
    criticoPct: Number(settings?.critico_pct ?? DEFAULT_TOLERANCE.criticoPct),
  };

  const margemUsada = margem !== "" ? Number(margem) : Number(order.margem_pct ?? settings?.margem_padrao_pct ?? 30);
  const valorCompra = Number(order.valor_compra ?? 0);
  const custo = custoPorKg(valorCompra, rec.aproveitado);
  const precoSug = precoSugerido(custo, margemUsada);

  return (
    <AppShell
      title={order.order_code ?? "Ordem"}
      subtitle={(order as any).pecas_entrada?.name ?? (order as any).products?.name ?? ""}
      actions={
        <Link
          to="/ordens"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header numérico */}
          <div className="bg-panel border rounded-lg p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
            <KV label="Peso Inicial" value={`${formatKg(order.peso_inicial, 2)} kg`} />
            <KV label="Aproveitado" value={`${formatKg(rec.aproveitado, 2)} kg`} accent="text-emerald-700" />
            <KV label="Rendimento" value={`${formatPercent(rec.rendimento)} %`} accent="text-primary" big />
            <KV label="Duração" value={formatDuration(order.started_at, order.finished_at)} />
            <KV label="Status" value={order.status.replace(/_/g, " ")} />
          </div>

          {/* Conciliação visual */}
          {(order.status === "finalizada" || pieces.length > 0) && (
            <ReconciliationPanel pesoInicial={Number(order.peso_inicial)} rec={rec} tolerance={tolerance} />
          )}

          {/* Peças */}
          <div className="bg-panel border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b font-bold flex items-center justify-between">
              <span>Cortes produzidos</span>
              <span className="text-xs text-muted-foreground font-normal">
                {pieces.length} lançamento{pieces.length === 1 ? "" : "s"}
              </span>
            </div>
            {pieces.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Nenhum corte registrado ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-secondary/50 border-b">
                      <Th>#</Th>
                      <Th>Corte</Th>
                      <Th className="text-right">Peso</Th>
                      <Th className="text-right">Qtd</Th>
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieces.map((p: any, i: number) => (
                      <tr key={p.id} className="border-b">
                        <td className="px-6 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-6 py-2 font-semibold">{p.cortes?.name ?? "—"}</td>
                        <td className="px-6 py-2 text-right font-mono">{formatKg(p.peso)} kg</td>
                        <td className="px-6 py-2 text-right font-mono">{p.quantidade}</td>
                        <td className="px-6 py-2 text-right font-mono font-semibold">
                          {formatKg(Number(p.peso) * Number(p.quantidade), 2)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Perdas */}
          <div className="bg-panel border rounded-lg p-6">
            <div className="font-bold mb-4">Perdas registradas</div>
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
                <KV key={k} label={l} value={`${formatKg(losses[k] ?? 0, 2)} kg`} />
              ))}
            </div>
          </div>

          {/* Precificação */}
          {order.status === "finalizada" && rec.aproveitado > 0 && (
            <div className="bg-panel border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="size-4 text-primary" />
                  <span className="font-bold">Simulação de Precificação</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase">Valor de compra</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="font-mono"
                    value={order.valor_compra ?? ""}
                    disabled
                  />
                </div>
                <KV label="Peso Aproveitado" value={`${formatKg(rec.aproveitado, 2)} kg`} />
                <KV
                  label="Custo por kg"
                  value={valorCompra > 0 ? formatCurrency(custo) : "—"}
                  accent="text-primary"
                />
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase">Margem desejada (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    className="font-mono"
                    value={margem !== "" ? margem : String(margemUsada)}
                    onChange={(e) => setMargem(e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>
              {valorCompra > 0 ? (
                <div className="bg-primary/5 border border-primary/20 rounded-md p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-primary">Preço Sugerido</div>
                    <div className="text-xs text-muted-foreground">
                      Custo × (1 + margem)
                    </div>
                  </div>
                  <div className="font-mono font-bold text-2xl text-primary">
                    {formatCurrency(precoSug)}<span className="text-sm">/kg</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Informe o valor de compra na criação da ordem para calcular o preço sugerido.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lateral */}
        <div className="space-y-6">
          <div className="bg-panel border rounded-lg p-6 space-y-3 text-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dados</div>
            <KVBlock label="Categoria" value={(order as any).pecas_entrada?.product_categories?.name ?? "—"} />
            <KVBlock label="Peça de Entrada" value={(order as any).pecas_entrada?.name ?? (order as any).products?.name ?? "—"} />
            <KVBlock label="Fornecedor" value={(order as any).suppliers?.razao_social ?? "—"} />
            <KVBlock label="Açougueiro" value={(order as any).employees?.full_name ?? "—"} />
            <KVBlock label="Data" value={formatDate(order.order_date)} />
            <KVBlock label="Iniciada" value={order.started_at ? formatDateTime(order.started_at) : "—"} />
            <KVBlock label="Finalizada" value={order.finished_at ? formatDateTime(order.finished_at) : "—"} />
          </div>

          {order.observacoes || order.observacoes_finalizacao || order.cancellation_reason ? (
            <div className="bg-panel border rounded-lg p-6 text-sm space-y-3">
              {order.observacoes ? <KVBlock label="Observações da ordem" value={order.observacoes} /> : null}
              {order.observacoes_finalizacao ? (
                <KVBlock label="Notas da execução" value={order.observacoes_finalizacao} />
              ) : null}
              {order.cancellation_reason ? (
                <KVBlock label="Motivo do cancelamento" value={order.cancellation_reason} />
              ) : null}
            </div>
          ) : null}

          <div className="bg-panel border rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b font-bold flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              Histórico completo
            </div>
            <OrderHistoryTimeline orderId={id} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function KV({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-mono font-bold mt-1 ${big ? "text-xl" : "text-lg"} ${accent ?? ""}`}>{value}</div>
    </div>
  );
}
function KVBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words">{value}</div>
    </div>
  );
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}
