import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
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
  type Losses,
  EMPTY_LOSSES,
  DEFAULT_TOLERANCE,
} from "@/lib/deboning-calcs";
import { useTenantSettings } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  reopenOrder as reopenOrderFn,
  deleteOrder as deleteOrderFn,
  addPiece as addPieceFn,
  removePiece as removePieceFn,
  updateLosses as updateLossesFn,
  finalizeOrder as finalizeOrderFn,
  updateOrderMetadata as updateOrderMetadataFn,
} from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeightInput } from "@/components/weight-input";
import {
  ArrowLeft,
  Clock,
  Calculator,
  RotateCcw,
  Trash2,
  Pencil,
  Plus,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ordens/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da Ordem — PRO MEAT" },
      { name: "description", content: "Detalhe, conciliação e precificação da ordem de desossa." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin", "supervisor", "visualizacao"]),
  component: OrdemDetalhe,
});

function OrdemDetalhe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = usePermissions();
  const { data: settings } = useTenantSettings();
  const [margem, setMargem] = useState<string>("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    assigned_employee_id: "",
    valor_compra: "",
    observacoes: "",
  });
  const [pieceOpen, setPieceOpen] = useState(false);
  const [pieceForm, setPieceForm] = useState<{
    corte_id: string;
    peso: number;
    quantidade: number;
    observacoes: string;
  }>({ corte_id: "", peso: 0, quantidade: 1, observacoes: "" });
  const [lossesLocal, setLossesLocal] = useState<Losses>(EMPTY_LOSSES);
  const [lossesObs, setLossesObs] = useState("");
  const lossesHydrated = useRef(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeObs, setFinalizeObs] = useState("");
  const [forceFinalize, setForceFinalize] = useState(false);

  const reopenSrv = useServerFn(reopenOrderFn);
  const deleteSrv = useServerFn(deleteOrderFn);
  const addPieceSrv = useServerFn(addPieceFn);
  const removePieceSrv = useServerFn(removePieceFn);
  const updateLossesSrv = useServerFn(updateLossesFn);
  const finalizeSrv = useServerFn(finalizeOrderFn);
  const updateMetaSrv = useServerFn(updateOrderMetadataFn);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["order-detail", id] });
    qc.invalidateQueries({ queryKey: ["orders-list"] });
    qc.invalidateQueries({ queryKey: ["order-history", id] });
    qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
  };

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, order_code, peso_inicial, peso_aproveitado, rendimento_pct, divergencia_kg, divergencia_pct,
           finalizada_com_divergencia, valor_compra, margem_pct, status, order_date, started_at,
           finished_at, observacoes, observacoes_finalizacao, cancellation_reason,
           peca_entrada_id, assigned_employee_id,
           products:product_id(name),
           pecas_entrada:peca_entrada_id(name, category_id, product_categories:category_id(name)),
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

  const pecaId = (order as any)?.peca_entrada_id as string | undefined;
  const catId = (order as any)?.pecas_entrada?.category_id as string | undefined;

  const { data: cortesPeca = [] } = useQuery({
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
  const { data: cortesCat = [] } = useQuery({
    queryKey: ["cortes-cat", catId],
    enabled: !!catId && cortesPeca.length === 0,
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
  const cortes = cortesPeca.length > 0 ? cortesPeca : cortesCat;

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, user_id, status")
        .eq("status", "ativo")
        .order("full_name");
      return data ?? [];
    },
  });

  // Hidratar perdas editáveis a partir do banco
  const rawLosses = (order as any)?.deboning_losses;
  const lossesRow = (Array.isArray(rawLosses) ? rawLosses[0] : rawLosses) ?? null;
  useEffect(() => {
    if (lossesHydrated.current) return;
    if (!order) return;
    if (lossesRow) {
      setLossesLocal({
        ossos: Number(lossesRow.ossos ?? 0),
        gordura: Number(lossesRow.gordura ?? 0),
        retalhos: Number(lossesRow.retalhos ?? 0),
        descarte: Number(lossesRow.descarte ?? 0),
        outros: Number(lossesRow.outros ?? 0),
      });
      setLossesObs(lossesRow.observacoes ?? "");
    }
    lossesHydrated.current = true;
  }, [order, lossesRow]);

  const addPieceMut = useMutation({
    mutationFn: async () =>
      addPieceSrv({
        data: {
          order_id: id,
          corte_id: pieceForm.corte_id,
          peso: Number(pieceForm.peso),
          quantidade: Number(pieceForm.quantidade || 1),
          observacoes: pieceForm.observacoes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Corte registrado");
      setPieceOpen(false);
      setPieceForm({ corte_id: "", peso: 0, quantidade: 1, observacoes: "" });
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const removePieceMut = useMutation({
    mutationFn: async (piece_id: string) =>
      removePieceSrv({ data: { order_id: id, piece_id } }),
    onSuccess: () => {
      toast.success("Corte removido");
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const saveLossesMut = useMutation({
    mutationFn: async () =>
      updateLossesSrv({
        data: {
          order_id: id,
          ossos: Number(lossesLocal.ossos || 0),
          gordura: Number(lossesLocal.gordura || 0),
          retalhos: Number(lossesLocal.retalhos || 0),
          descarte: Number(lossesLocal.descarte || 0),
          outros: Number(lossesLocal.outros || 0),
          observacoes: lossesObs || null,
        },
      }),
    onSuccess: () => {
      toast.success("Perdas atualizadas");
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updateMetaMut = useMutation({
    mutationFn: async () =>
      updateMetaSrv({
        data: {
          order_id: id,
          assigned_employee_id: editForm.assigned_employee_id || null,
          valor_compra: editForm.valor_compra !== "" ? Number(editForm.valor_compra) : null,
          observacoes: editForm.observacoes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dados da ordem atualizados");
      setEditOpen(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const finalizeMut = useMutation({
    mutationFn: async () =>
      finalizeSrv({
        data: { order_id: id, force: forceFinalize, observacoes: finalizeObs || null },
      }),
    onSuccess: () => {
      toast.success("Ordem finalizada");
      setFinalizeOpen(false);
      setFinalizeObs("");
      setForceFinalize(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const reopenMut = useMutation({
    mutationFn: () => reopenSrv({ data: { order_id: id, reason: reopenReason.trim() } }),
    onSuccess: () => {
      toast.success("Ordem reaberta");
      setReopenOpen(false);
      setReopenReason("");
      invalidateAll();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteSrv({ data: { order_id: id, reason: deleteReason.trim() } }),
    onSuccess: () => {
      toast.success("Ordem excluída");
      navigate({ to: "/ordens" });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  if (isLoading || !order) {
    return (
      <AppShell title="Ordem">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </AppShell>
    );
  }

  const losses = lossesRow ?? { ossos: 0, gordura: 0, retalhos: 0, descarte: 0, outros: 0 };
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

  // Regras de edição
  const editableStatuses = new Set(["pendente", "atribuida", "em_andamento", "aguardando_conferencia"]);
  const isEditableStatus = editableStatuses.has(order.status);
  const canEditMetadata = perms.canEditOrders && isEditableStatus;
  const canEditProduction = perms.canEditOrders && order.status === "em_andamento";
  const canFinalize = perms.canEditOrders && order.status === "em_andamento" && pieces.length > 0;

  const excedeu = rec.diferencaAbs > tolerance.divergenciaMaximaKg;

  function openEdit() {
    setEditForm({
      assigned_employee_id: (order as any).assigned_employee_id ?? "",
      valor_compra: order.valor_compra != null ? String(order.valor_compra) : "",
      observacoes: order.observacoes ?? "",
    });
    setEditOpen(true);
  }

  return (
    <AppShell
      title={order.order_code ?? "Ordem"}
      subtitle={(order as any).pecas_entrada?.name ?? (order as any).products?.name ?? ""}
      actions={
        <div className="flex items-center gap-2">
          {canEditMetadata ? (
            <Button size="sm" variant="outline" onClick={openEdit}>
              <Pencil className="size-4 mr-1" /> Editar dados
            </Button>
          ) : null}
          {perms.canReopenOrders && order.status === "finalizada" ? (
            <Button size="sm" variant="outline" onClick={() => setReopenOpen(true)}>
              <RotateCcw className="size-4 mr-1" /> Reabrir
            </Button>
          ) : null}
          {perms.canDeleteOrders ? (
            <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
              <Trash2 className="size-4 mr-1" /> Excluir
            </Button>
          ) : null}
          <Link
            to="/ordens"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Aviso modo edição */}
          {canEditProduction ? (
            <div className="rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs flex items-center justify-between gap-3">
              <span>
                <b>Modo edição:</b> ordem em andamento. Cortes, perdas e finalização podem ser corrigidos aqui.
              </span>
              {canFinalize ? (
                <Button size="sm" onClick={() => setFinalizeOpen(true)}>
                  <CheckCircle2 className="size-4 mr-1" /> Finalizar
                </Button>
              ) : null}
            </div>
          ) : null}

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
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-normal">
                  {pieces.length} lançamento{pieces.length === 1 ? "" : "s"}
                </span>
                {canEditProduction ? (
                  <Button size="sm" variant="outline" onClick={() => setPieceOpen(true)}>
                    <Plus className="size-4 mr-1" /> Adicionar
                  </Button>
                ) : null}
              </div>
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
                      {canEditProduction ? <Th className="text-right">{""}</Th> : null}
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
                        {canEditProduction ? (
                          <td className="px-6 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={removePieceMut.isPending}
                              onClick={() => removePieceMut.mutate(p.id)}
                              title="Remover corte"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Perdas */}
          <div className="bg-panel border rounded-lg p-6">
            <div className="font-bold mb-4 flex items-center justify-between">
              <span>Perdas registradas</span>
              {canEditProduction ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveLossesMut.mutate()}
                  disabled={saveLossesMut.isPending}
                >
                  {saveLossesMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar perdas"}
                </Button>
              ) : null}
            </div>
            {canEditProduction ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(
                  [
                    ["ossos", "Ossos"],
                    ["gordura", "Gordura"],
                    ["retalhos", "Retalhos"],
                    ["descarte", "Descarte"],
                    ["outros", "Outros"],
                  ] as const
                ).map(([k, l]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</Label>
                    <WeightInput
                      value={lossesLocal[k]}
                      onChange={(v) => setLossesLocal((s) => ({ ...s, [k]: v }))}
                    />
                  </div>
                ))}
                <div className="col-span-2 md:col-span-5 space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Observações das perdas
                  </Label>
                  <Textarea rows={2} value={lossesObs} onChange={(e) => setLossesObs(e.target.value)} />
                </div>
              </div>
            ) : (
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
                  <KV key={k} label={l} value={`${formatKg((losses as any)[k] ?? 0, 2)} kg`} />
                ))}
              </div>
            )}
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
            <KVBlock label="Valor de compra" value={order.valor_compra != null ? formatCurrency(Number(order.valor_compra)) : "—"} />
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

      {/* Editar dados */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar dados da ordem</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Açougueiro responsável</Label>
              <Select
                value={editForm.assigned_employee_id}
                onValueChange={(v) => setEditForm((f) => ({ ...f, assigned_employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                      {!e.user_id ? <span className="text-muted-foreground text-xs"> · sem login</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor de compra (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.valor_compra}
                onChange={(e) => setEditForm((f) => ({ ...f, valor_compra: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={editForm.observacoes}
                onChange={(e) => setEditForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cada alteração é registrada no histórico com usuário, data e valores anteriores.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateMetaMut.mutate()} disabled={updateMetaMut.isPending}>
              {updateMetaMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adicionar corte */}
      <Dialog open={pieceOpen} onOpenChange={setPieceOpen}>
        <DialogContent>
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
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o corte" />
                </SelectTrigger>
                <SelectContent>
                  {cortes.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum corte disponível para esta peça.
                    </div>
                  ) : (
                    cortes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.code ? <span className="text-muted-foreground"> · {c.code}</span> : null}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Peso (kg) *</Label>
                <WeightInput
                  value={pieceForm.peso}
                  onChange={(v) => setPieceForm((f) => ({ ...f, peso: v }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={pieceForm.quantidade}
                  onChange={(e) =>
                    setPieceForm((f) => ({ ...f, quantidade: Number(e.target.value || 1) }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={pieceForm.observacoes}
                onChange={(e) => setPieceForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPieceOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => addPieceMut.mutate()}
              disabled={!pieceForm.corte_id || !pieceForm.peso || addPieceMut.isPending}
            >
              {addPieceMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalizar */}
      <Dialog
        open={finalizeOpen}
        onOpenChange={(v) => {
          setFinalizeOpen(v);
          if (!v) setForceFinalize(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar ordem</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <div>Rendimento: <b>{formatPercent(rec.rendimento)}%</b></div>
              <div>Aproveitado: <b>{formatKg(rec.aproveitado, 2)} kg</b></div>
              <div>
                Diferença: <b className={excedeu ? "text-destructive" : ""}>
                  {formatKg(rec.diferencaAbs, 3)} kg
                </b>
                {excedeu ? (
                  <span className="text-destructive text-xs ml-2">
                    excede o limite ({tolerance.divergenciaMaximaKg} kg)
                  </span>
                ) : null}
              </div>
            </div>
            {excedeu ? (
              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={forceFinalize}
                  onChange={(e) => setForceFinalize(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Confirmo a finalização mesmo com divergência acima do limite. A ordem será marcada como
                  <b> finalizada com divergência</b>.
                </span>
              </label>
            ) : null}
            <div className="space-y-2">
              <Label>Observações da finalização</Label>
              <Textarea
                rows={3}
                value={finalizeObs}
                onChange={(e) => setFinalizeObs(e.target.value)}
                placeholder="Opcional — anotações sobre esta correção/finalização"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => finalizeMut.mutate()}
              disabled={finalizeMut.isPending || (excedeu && !forceFinalize)}
            >
              {finalizeMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Finalizar ordem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir ordem</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da reabertura *</Label>
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              rows={3}
              placeholder="Descreva por que esta ordem precisa ser reaberta"
            />
            <p className="text-xs text-muted-foreground">
              A ordem retornará para <b>em andamento</b> mantendo o mesmo açougueiro. O histórico é preservado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => reopenMut.mutate()}
              disabled={reopenReason.trim().length < 3 || reopenMut.isPending}
            >
              Reabrir ordem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ordem</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da exclusão *</Label>
            <Textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              placeholder="Descreva por que esta ordem deve ser excluída"
            />
            <p className="text-xs text-destructive">
              A exclusão é lógica: a ordem deixa de aparecer nas listas, mas o histórico permanece para auditoria.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMut.mutate()}
              disabled={deleteReason.trim().length < 3 || deleteMut.isPending}
            >
              Excluir ordem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
