import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatKg, formatPercent } from "@/lib/format";
import {
  reconcile,
  reconStatus,
  statusColors,
  EMPTY_LOSSES,
  DEFAULT_TOLERANCE,
  type Losses,
} from "@/lib/deboning-calcs";
import { WeightInput } from "@/components/weight-input";
import { ReconciliationPanel } from "@/components/reconciliation-panel";
import { ArrowLeft, Plus, Trash2, CheckCircle2, Play, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTenantSettings } from "@/hooks/use-auth";
import {
  startOrder as startOrderFn,
  addPiece as addPieceFn,
  removePiece as removePieceFn,
  updateLosses as updateLossesFn,
  finalizeOrder as finalizeOrderFn,
} from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/mobile/desossa/$id")({
  head: () => ({
    meta: [
      { title: "Execução — PRO MEAT" },
      { name: "description", content: "Execução da desossa pelo açougueiro." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin", "acougueiro"]),
  component: MobileDesossa,
});

function MobileDesossa() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: settings } = useTenantSettings();

  const [losses, setLosses] = useState<Losses>(EMPTY_LOSSES);
  const [lossObs, setLossObs] = useState("");
  const [obs, setObs] = useState("");
  const [pieceDialogOpen, setPieceDialogOpen] = useState(false);
  const [pieceForm, setPieceForm] = useState<{
    corte_id: string;
    peso: number;
    quantidade: number;
    observacoes: string;
  }>({ corte_id: "", peso: 0, quantidade: 1, observacoes: "" });
  const [divergenceOpen, setDivergenceOpen] = useState(false);
  const lossesHydrated = useRef(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, order_code, peso_inicial, status, order_date, observacoes, peca_entrada_id,
           products:product_id(name),
           pecas_entrada:peca_entrada_id(name, category_id, product_categories:category_id(name)),
           suppliers:supplier_id(razao_social, nome_fantasia),
           employees:assigned_employee_id(id, user_id)`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Peças já persistidas (fonte da verdade = banco)
  const { data: pieces = [] } = useQuery({
    queryKey: ["order-pieces", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_pieces")
        .select("id, corte_id, peso, quantidade, observacoes, created_at, cortes:corte_id(name, code)")
        .eq("order_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Perdas persistidas (hidratar formulário na primeira carga)
  const { data: lossesRow } = useQuery({
    queryKey: ["order-losses", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("deboning_losses")
        .select("ossos, gordura, retalhos, descarte, outros, observacoes")
        .eq("order_id", id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (lossesHydrated.current) return;
    if (lossesRow) {
      setLosses({
        ossos: Number(lossesRow.ossos ?? 0),
        gordura: Number(lossesRow.gordura ?? 0),
        retalhos: Number(lossesRow.retalhos ?? 0),
        descarte: Number(lossesRow.descarte ?? 0),
        outros: Number(lossesRow.outros ?? 0),
      });
      setLossObs(lossesRow.observacoes ?? "");
      lossesHydrated.current = true;
    }
  }, [lossesRow]);

  // Cortes disponíveis para a peça
  const pecaId = (order as any)?.peca_entrada_id as string | undefined;
  const { data: cortesDisponiveis = [] } = useQuery({
    queryKey: ["peca-cortes", pecaId],
    enabled: !!pecaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("peca_cortes")
        .select("cortes:corte_id(id, name, code)")
        .eq("peca_id", pecaId!);
      return ((data ?? []) as any[])
        .map((r) => r.cortes)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });

  const catId = (order as any)?.pecas_entrada?.category_id as string | undefined;
  const { data: cortesFallback = [] } = useQuery({
    queryKey: ["cortes-cat", catId],
    enabled: !!catId && cortesDisponiveis.length === 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("cortes")
        .select("id, name, code")
        .eq("category_id", catId!)
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const cortes = cortesDisponiveis.length > 0 ? cortesDisponiveis : cortesFallback;

  const startOrder = useServerFn(startOrderFn);
  const addPieceRpc = useServerFn(addPieceFn);
  const removePieceRpc = useServerFn(removePieceFn);
  const updateLossesRpc = useServerFn(updateLossesFn);
  const finalizeOrder = useServerFn(finalizeOrderFn);

  const startMut = useMutation({
    mutationFn: async () => startOrder({ data: { order_id: id } }),
    onSuccess: () => {
      toast.success("Desossa iniciada");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const addPieceMut = useMutation({
    mutationFn: async (input: {
      corte_id: string;
      peso: number;
      quantidade: number;
      observacoes: string | null;
    }) =>
      addPieceRpc({
        data: {
          order_id: id,
          corte_id: input.corte_id,
          peso: input.peso,
          quantidade: input.quantidade,
          observacoes: input.observacoes,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-pieces", id] });
      qc.invalidateQueries({ queryKey: ["order-history", id] });
      setPieceForm({ corte_id: "", peso: 0, quantidade: 1, observacoes: "" });
      setPieceDialogOpen(false);
      toast.success("Corte registrado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const removePieceMut = useMutation({
    mutationFn: async (piece_id: string) =>
      removePieceRpc({ data: { order_id: id, piece_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-pieces", id] });
      qc.invalidateQueries({ queryKey: ["order-history", id] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const lossesMut = useMutation({
    mutationFn: async (payload: Losses & { observacoes: string | null }) =>
      updateLossesRpc({
        data: {
          order_id: id,
          ossos: Number(payload.ossos || 0),
          gordura: Number(payload.gordura || 0),
          retalhos: Number(payload.retalhos || 0),
          descarte: Number(payload.descarte || 0),
          outros: Number(payload.outros || 0),
          observacoes: payload.observacoes,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-losses", id] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar perdas", { description: e.message }),
  });

  // Auto-save de perdas (debounced) — apenas quando em_andamento
  useEffect(() => {
    if (!lossesHydrated.current) return;
    if (order?.status !== "em_andamento") return;
    const t = setTimeout(() => {
      lossesMut.mutate({ ...losses, observacoes: lossObs || null });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [losses, lossObs, order?.status]);

  const piecesForCalc = useMemo(
    () =>
      pieces.map((p: any) => ({
        corte_id: p.corte_id,
        peso: Number(p.peso),
        quantidade: Number(p.quantidade || 1),
      })),
    [pieces],
  );

  const rec = useMemo(
    () => reconcile(Number(order?.peso_inicial ?? 0), piecesForCalc as any, losses),
    [order?.peso_inicial, piecesForCalc, losses],
  );

  const tolerance = {
    divergenciaMaximaKg: Number(settings?.divergencia_maxima_kg ?? DEFAULT_TOLERANCE.divergenciaMaximaKg),
    atencaoPct: Number(settings?.atencao_pct ?? DEFAULT_TOLERANCE.atencaoPct),
    criticoPct: Number(settings?.critico_pct ?? DEFAULT_TOLERANCE.criticoPct),
  };
  const status = reconStatus(rec, tolerance);
  const colors = statusColors(status);
  const excedeu = rec.diferencaAbs > tolerance.divergenciaMaximaKg;

  function submitPiece() {
    if (!pieceForm.corte_id) {
      toast.error("Selecione o corte");
      return;
    }
    if (!pieceForm.peso || pieceForm.peso <= 0) {
      toast.error("Informe o peso");
      return;
    }
    addPieceMut.mutate({
      corte_id: pieceForm.corte_id,
      peso: Number(pieceForm.peso),
      quantidade: Number(pieceForm.quantidade || 1),
      observacoes: pieceForm.observacoes || null,
    });
  }

  const finishMut = useMutation({
    mutationFn: async ({ force }: { force: boolean }) => {
      // Garante que perdas pendentes estejam salvas antes de finalizar
      await updateLossesRpc({
        data: {
          order_id: id,
          ossos: Number(losses.ossos || 0),
          gordura: Number(losses.gordura || 0),
          retalhos: Number(losses.retalhos || 0),
          descarte: Number(losses.descarte || 0),
          outros: Number(losses.outros || 0),
          observacoes: lossObs || null,
        },
      });
      return finalizeOrder({
        data: { order_id: id, force, observacoes: obs || null },
      });
    },
    onSuccess: () => {
      toast.success("Desossa finalizada!");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      navigate({ to: "/mobile", replace: true });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  function handleFinishClick() {
    if (pieces.length === 0) {
      toast.error("Adicione ao menos um corte antes de finalizar.");
      return;
    }
    if (excedeu) {
      setDivergenceOpen(true);
      return;
    }
    finishMut.mutate({ force: false });
  }

  if (isLoading || !order) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const isAssigned = order.status === "atribuida" || order.status === "pendente";
  const emAndamento = order.status === "em_andamento";
  const readOnly = !emAndamento;

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-10 bg-panel border-b px-4 py-3 flex items-center gap-3">
        <Link to="/mobile" className="p-2 -ml-2 text-muted-foreground active:bg-secondary rounded">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-muted-foreground">
            {order.order_code ?? id.slice(0, 6)}
          </div>
          <div className="font-bold text-base truncate">
            {(order as any).pecas_entrada?.name ?? (order as any).products?.name ?? "—"}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {(order as any).suppliers?.nome_fantasia ?? (order as any).suppliers?.razao_social ?? "—"}
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-primary to-[oklch(0.4_0.2_15)] text-primary-foreground rounded-lg p-5 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(255,255,255,0.15) 12px, rgba(255,255,255,0.15) 13px)",
          }} />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-widest opacity-80">Peso Inicial</div>
            <div className="font-mono text-5xl font-bold leading-none mt-2">
              {formatKg(order.peso_inicial, 2)}
            </div>
            <div className="text-xs opacity-80 mt-1">kg · {(order as any).pecas_entrada?.product_categories?.name ?? ""}</div>
          </div>
        </div>

        {isAssigned ? (
          <Button
            size="lg"
            className="w-full h-14 text-base"
            onClick={() => startMut.mutate()}
            disabled={startMut.isPending}
          >
            {startMut.isPending ? <Loader2 className="size-5 animate-spin" /> : (
              <>
                <Play className="size-5 mr-2" /> Iniciar Desossa
              </>
            )}
          </Button>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Cortes aproveitados</h2>
            <button
              className="text-xs font-bold text-primary flex items-center gap-1 disabled:opacity-40"
              disabled={readOnly}
              onClick={() => setPieceDialogOpen(true)}
            >
              <Plus className="size-4" /> Adicionar
            </button>
          </div>
          {pieces.length === 0 ? (
            <div className="bg-panel border rounded-lg p-6 text-center text-sm text-muted-foreground">
              {isAssigned ? "Inicie a desossa para lançar cortes." : "Toque em + Adicionar para registrar um corte."}
            </div>
          ) : (
            <div className="space-y-2">
              {pieces.map((p: any, i: number) => (
                <div key={p.id} className="bg-panel border rounded-lg p-3 flex items-center gap-3">
                  <div className="size-8 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.cortes?.name ?? "Corte"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatKg(p.peso)} kg × {p.quantidade}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-sm">
                      {formatKg(Number(p.peso) * Number(p.quantidade || 1), 2)}
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase">kg total</div>
                  </div>
                  <button
                    className="p-2 text-destructive disabled:opacity-40"
                    disabled={readOnly || removePieceMut.isPending}
                    onClick={() => removePieceMut.mutate(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

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
              <div key={k} className="space-y-1">
                <Label className="text-[10px] uppercase">{label}</Label>
                <WeightInput
                  value={losses[k]}
                  onChange={(v) => {
                    lossesHydrated.current = true;
                    setLosses((l) => ({ ...l, [k]: v }));
                  }}
                />
              </div>
            ))}
            <div className="space-y-1 col-span-2">
              <Label className="text-[10px] uppercase">Observações</Label>
              <Textarea
                rows={2}
                value={lossObs}
                onChange={(e) => {
                  lossesHydrated.current = true;
                  setLossObs(e.target.value);
                }}
                placeholder="Opcional"
              />
            </div>
          </div>
        </section>

        {pieces.length > 0 || Object.values(losses).some((v) => v > 0) ? (
          <ReconciliationPanel
            pesoInicial={Number(order.peso_inicial)}
            rec={rec}
            tolerance={tolerance}
            compact
          />
        ) : null}

        <div className="space-y-2">
          <Label>Notas da execução</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-panel border-t p-4 space-y-2 shadow-lg">
        <div className="flex items-center justify-between text-sm">
          <span className={`font-bold ${colors.text}`}>
            Diferença: {formatKg(rec.diferencaAbs, 3)} kg ({formatPercent(rec.divergenciaPct)}%)
          </span>
          <span className="text-xs text-muted-foreground">
            Limite: {formatKg(tolerance.divergenciaMaximaKg, 3)} kg
          </span>
        </div>
        <Button
          size="lg"
          className="w-full h-14 text-base"
          onClick={handleFinishClick}
          disabled={finishMut.isPending || pieces.length === 0 || readOnly}
        >
          {finishMut.isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="size-5 mr-2" /> Finalizar Desossa
            </>
          )}
        </Button>
      </div>

      <Dialog open={pieceDialogOpen} onOpenChange={setPieceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar corte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Corte *</Label>
              <Select
                value={pieceForm.corte_id}
                onValueChange={(v) => setPieceForm((f) => ({ ...f, corte_id: v }))}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cortes.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum corte disponível para esta peça.
                    </div>
                  ) : (
                    cortes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.code ? <span className="text-muted-foreground text-xs ml-2">{c.code}</span> : null}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Peso *</Label>
                <WeightInput
                  value={pieceForm.peso}
                  onChange={(v) => setPieceForm((f) => ({ ...f, peso: v }))}
                  large
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={pieceForm.quantidade || 1}
                  onChange={(e) => setPieceForm((f) => ({ ...f, quantidade: Number(e.target.value) || 1 }))}
                  className="h-14 text-2xl font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={pieceForm.observacoes}
                onChange={(e) => setPieceForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPieceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitPiece} disabled={addPieceMut.isPending}>
              {addPieceMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={divergenceOpen} onOpenChange={setDivergenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Divergência acima do limite
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-destructive/5 border border-destructive/30 rounded-md p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Diferença encontrada</span>
                <span className="font-mono font-bold text-destructive">
                  {formatKg(rec.diferencaAbs, 3)} kg ({formatPercent(rec.divergenciaPct)}%)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Limite permitido</span>
                <span className="font-mono font-bold">
                  {formatKg(tolerance.divergenciaMaximaKg, 3)} kg
                </span>
              </div>
            </div>
            <p className="text-sm">
              A divergência será registrada no histórico da ordem e o administrador será notificado.
              Deseja finalizar mesmo assim?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDivergenceOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDivergenceOpen(false);
                finishMut.mutate({ force: true });
              }}
              disabled={finishMut.isPending}
            >
              Finalizar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
