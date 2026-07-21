import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatKg, formatPercent } from "@/lib/format";
import { reconcile, type Piece, type Losses } from "@/lib/deboning-calcs";
import { ArrowLeft, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mobile/desossa/$id")({
  head: () => ({ meta: [{ title: "Execução — CarnePro" }] }),
  component: MobileDesossa,
});

function MobileDesossa() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [losses, setLosses] = useState<Losses>({
    ossos: 0,
    gordura: 0,
    retalhos: 0,
    descarte: 0,
    outros: 0,
  });
  const [obs, setObs] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          "id, order_code, peso_inicial, status, order_date, observacoes, products:product_id(name), suppliers:supplier_id(razao_social, nome_fantasia)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const startMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("deboning_orders")
        .update({ status: "em_andamento", started_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", id] }),
  });

  const rec = useMemo(
    () => reconcile(Number(order?.peso_inicial ?? 0), pieces, losses),
    [order, pieces, losses],
  );

  const finishMut = useMutation({
    mutationFn: async () => {
      if (pieces.length === 0) throw new Error("Adicione ao menos uma peça");
      if (rec.divergenciaPct > 2) {
        if (!confirm(`Divergência de ${formatPercent(rec.divergenciaPct)}%. Confirmar mesmo assim?`)) {
          throw new Error("Cancelado");
        }
      }
      const now = new Date().toISOString();
      // Ensure started
      if (order?.status === "pendente") {
        await supabase
          .from("deboning_orders")
          .update({ status: "em_andamento", started_at: now })
          .eq("id", id);
      }

      // Insert pieces
      const piecesPayload = pieces.map((p) => ({
        order_id: id,
        peso: p.peso,
        quantidade: p.quantidade || 1,
      }));
      const { error: pErr } = await supabase.from("deboning_pieces").insert(piecesPayload);
      if (pErr) throw pErr;

      // Upsert losses
      const { error: lErr } = await supabase.from("deboning_losses").upsert(
        {
          order_id: id,
          ossos: losses.ossos,
          gordura: losses.gordura,
          retalhos: losses.retalhos,
          descarte: losses.descarte,
          outros: losses.outros,
        },
        { onConflict: "order_id" },
      );
      if (lErr) throw lErr;

      const { error: oErr } = await supabase
        .from("deboning_orders")
        .update({
          status: "finalizada",
          finished_at: now,
          peso_aproveitado: rec.aproveitado,
          rendimento_pct: rec.rendimento,
          observacoes_finalizacao: obs || null,
        })
        .eq("id", id);
      if (oErr) throw oErr;
    },
    onSuccess: () => {
      toast.success("Desossa finalizada!");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      navigate({ to: "/mobile", replace: true });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (isLoading || !order) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 bg-panel border-b px-4 py-3 flex items-center gap-3">
        <Link
          to="/mobile"
          className="p-2 -ml-2 text-muted-foreground active:bg-secondary rounded"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-muted-foreground">
            {order.order_code ?? id.slice(0, 6)}
          </div>
          <div className="font-bold text-base truncate">{(order as any).products?.name ?? "—"}</div>
        </div>
      </header>

      <div className="p-4 space-y-5">
        {/* Peso inicial destaque */}
        <div className="bg-primary text-primary-foreground rounded-lg p-5 text-center">
          <div className="text-[10px] uppercase tracking-widest opacity-80">Peso Inicial</div>
          <div className="font-mono text-5xl font-bold leading-none mt-2">
            {formatKg(order.peso_inicial)}
          </div>
          <div className="text-xs opacity-80 mt-1">kg</div>
        </div>

        {order.status === "pendente" ? (
          <Button
            size="lg"
            className="w-full h-14 text-base"
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
          >
            Iniciar Desossa
          </Button>
        ) : null}

        {/* Peças */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Peças aproveitadas</h2>
            <button
              className="text-xs font-bold text-primary flex items-center gap-1"
              onClick={() => setPieces((p) => [...p, { peso: 0, quantidade: 1 }])}
            >
              <Plus className="size-4" /> Adicionar
            </button>
          </div>
          {pieces.length === 0 ? (
            <div className="bg-panel border rounded-lg p-6 text-center text-sm text-muted-foreground">
              Toque em "+ Adicionar" para registrar peças.
            </div>
          ) : (
            <div className="space-y-2">
              {pieces.map((p, i) => (
                <div key={i} className="bg-panel border rounded-lg p-3 flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] uppercase">Peso (kg)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        inputMode="decimal"
                        value={p.peso || ""}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setPieces((arr) => arr.map((x, idx) => (idx === i ? { ...x, peso: v } : x)));
                        }}
                        className="h-11 text-base font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={p.quantidade}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 1;
                          setPieces((arr) => arr.map((x, idx) => (idx === i ? { ...x, quantidade: v } : x)));
                        }}
                        className="h-11 text-base font-mono"
                      />
                    </div>
                  </div>
                  <button
                    className="p-2 text-destructive"
                    onClick={() => setPieces((arr) => arr.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Perdas */}
        <section className="space-y-3">
          <h2 className="font-bold">Perdas (kg)</h2>
          <div className="bg-panel border rounded-lg p-3 grid grid-cols-2 gap-3">
            {(
              [
                ["ossos", "Ossos"],
                ["gordura", "Gordura"],
                ["retalhos", "Retalhos"],
                ["descarte", "Descarte"],
                ["outros", "Outros"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <Label className="text-[10px] uppercase">{label}</Label>
                <Input
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  value={losses[k] || ""}
                  onChange={(e) =>
                    setLosses((l) => ({ ...l, [k]: Number(e.target.value) || 0 }))
                  }
                  className="h-11 text-base font-mono"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Reconciliação */}
        <section className="bg-panel border rounded-lg p-4 space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Reconciliação
          </h3>
          <ReconRow label="Aproveitado" value={`${formatKg(rec.aproveitado)} kg`} />
          <ReconRow label="Perdas" value={`${formatKg(rec.perdas)} kg`} />
          <ReconRow
            label="Diferença"
            value={`${formatKg(rec.saldo)} kg`}
            warn={rec.divergenciaPct > 2}
          />
          <div className="h-px bg-border my-1" />
          <ReconRow
            label="Rendimento"
            value={`${formatPercent(rec.rendimento)}%`}
            emphasize
          />
        </section>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-panel border-t p-4">
        <Button
          size="lg"
          className="w-full h-14 text-base"
          onClick={() => finishMut.mutate()}
          disabled={finishMut.isPending || pieces.length === 0}
        >
          <CheckCircle2 className="size-5 mr-2" /> Finalizar Desossa
        </Button>
      </div>
    </div>
  );
}

function ReconRow({
  label,
  value,
  warn,
  emphasize,
}: {
  label: string;
  value: string;
  warn?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`font-mono font-bold ${emphasize ? "text-lg text-primary" : "text-sm"} ${warn ? "text-destructive" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
