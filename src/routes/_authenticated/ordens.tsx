import { createFileRoute, Link } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatKg, formatDate } from "@/lib/format";
import { logOrderHistory, notify, notifyAdmins } from "@/lib/order-history";
import { usePermissions } from "@/hooks/use-permissions";
import { WeightInput } from "@/components/weight-input";

export const Route = createFileRoute("/_authenticated/ordens")({
  head: () => ({
    meta: [
      { title: "Ordens de Desossa — CarnePro" },
      { name: "description", content: "Gestão do ciclo completo das ordens de desossa." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin", "supervisor", "visualizacao"]),
  component: Ordens,
});

interface OrderListItem {
  id: string;
  order_code: string | null;
  peso_inicial: number;
  status: string;
  order_date: string;
  created_at: string;
  finalizada_com_divergencia: boolean;
  products: { name: string } | null;
  pecas_entrada: { name: string } | null;
  suppliers: { razao_social: string; nome_fantasia: string | null } | null;
  employees: { id: string; full_name: string; user_id: string | null } | null;
}

const STATUS_TABS = [
  { k: "all", l: "Todas" },
  { k: "pendente", l: "Pendentes" },
  { k: "atribuida", l: "Atribuídas" },
  { k: "em_andamento", l: "Em andamento" },
  { k: "aguardando_conferencia", l: "Aguardando" },
  { k: "finalizada", l: "Finalizadas" },
  { k: "cancelada", l: "Canceladas" },
];

function Ordens() {
  const qc = useQueryClient();
  const perms = usePermissions();
  const [open, setOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState({
    stock_entry_id: "",
    peca_entrada_id: "",
    category_id: "",
    supplier_id: "",
    peso_inicial: 0,
    order_date: new Date().toISOString().slice(0, 10),
    assigned_employee_id: "",
    valor_compra: "",
    observacoes: "",
  });


  const { data: orders = [] } = useQuery({
    queryKey: ["orders-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          `id, order_code, peso_inicial, status, order_date, created_at, finalizada_com_divergencia,
           products:product_id(name),
           pecas_entrada:peca_entrada_id(name),
           suppliers:supplier_id(razao_social, nome_fantasia),
           employees:assigned_employee_id(id, full_name, user_id)`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderListItem[];
    },
  });

  const { data: pecas = [] } = useQuery({
    queryKey: ["pecas-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pecas_entrada")
        .select("id, name, category_id, product_categories:category_id(name)")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, razao_social")
        .order("razao_social");
      return data ?? [];
    },
  });
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

  const { data: stockEntries = [] } = useQuery({
    queryKey: ["stock-entries-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_entries")
        .select(
          `id, entry_date, peso_bruto, purchase_value, lote, invoice_number,
           supplier_id, product_id,
           suppliers:supplier_id(razao_social),
           products:product_id(name)`,
        )
        .order("entry_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });


  const selectedPeca: any = pecas.find((p: any) => p.id === form.peca_entrada_id);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.stock_entry_id) throw new Error("Selecione a Entrada de Mercadoria.");
      if (!form.peca_entrada_id) throw new Error("Selecione a peça de entrada.");
      if (!form.supplier_id) throw new Error("Fornecedor não identificado na entrada.");
      if (form.peso_inicial <= 0) throw new Error("Informe o peso inicial.");
      const { data: userRes } = await supabase.auth.getUser();

      // Server-generated sequential code (OD-000001)
      const { data: codeRes, error: codeErr } = await supabase.rpc("next_order_code", {
        _tenant: "00000000-0000-0000-0000-000000000001",
      });
      if (codeErr) throw codeErr;
      const code = (codeRes as unknown as string) ?? `OD-${Date.now()}`;

      const status = form.assigned_employee_id ? "atribuida" : "pendente";
      const { data: inserted, error } = await supabase
        .from("deboning_orders")
        .insert({
          stock_entry_id: form.stock_entry_id,
          peca_entrada_id: form.peca_entrada_id,
          supplier_id: form.supplier_id,
          peso_inicial: Number(form.peso_inicial),
          order_date: form.order_date,
          assigned_employee_id: form.assigned_employee_id || null,
          valor_compra: form.valor_compra ? Number(form.valor_compra) : null,
          observacoes: form.observacoes || null,
          order_code: code,
          status,
          created_by: userRes.user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;


      const orderId = inserted.id;
      await logOrderHistory({ orderId, action: "ordem_criada", toStatus: status });

      const emp = employees.find((e: any) => e.id === form.assigned_employee_id);
      if (form.assigned_employee_id) {
        await logOrderHistory({
          orderId,
          action: "ordem_atribuida",
          toStatus: "atribuida",
          notes: emp ? `Atribuída para ${emp.full_name}` : null,
        });
        if (emp?.user_id) {
          await notify({
            userId: emp.user_id,
            type: "ordem_atribuida",
            title: "Nova ordem atribuída",
            body: `${selectedPeca?.name ?? "Ordem"} · ${formatKg(form.peso_inicial, 2)} kg`,
            orderId,
          });
        }
      }
      await notifyAdmins({
        type: "desossa_criada",
        title: "Nova ordem de desossa",
        body: `${code} — ${selectedPeca?.name ?? "—"}`,
        orderId,
      });
      return orderId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      setOpen(false);
      setForm({
        stock_entry_id: "",
        peca_entrada_id: "",
        category_id: "",
        supplier_id: "",
        peso_inicial: 0,
        order_date: new Date().toISOString().slice(0, 10),
        assigned_employee_id: "",
        valor_compra: "",
        observacoes: "",
      });

      toast.success("Ordem criada com sucesso");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!cancelId) return;
      const from = orders.find((o) => o.id === cancelId)?.status ?? null;
      const { error } = await supabase
        .from("deboning_orders")
        .update({ status: "cancelada", cancellation_reason: cancelReason || null })
        .eq("id", cancelId);
      if (error) throw error;
      await logOrderHistory({
        orderId: cancelId,
        action: "ordem_cancelada",
        fromStatus: from,
        toStatus: "cancelada",
        notes: cancelReason || null,
      });
      await notifyAdmins({
        type: "cancelamento",
        title: "Ordem cancelada",
        body: cancelReason ? `Motivo: ${cancelReason}` : null,
        orderId: cancelId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      setCancelId(null);
      setCancelReason("");
      toast.success("Ordem cancelada");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const filtered = orders.filter((o) => statusFilter === "all" || o.status === statusFilter);

  return (
    <AppShell
      title="Ordens de Desossa"
      subtitle="Ciclo completo — pendente → atribuída → em andamento → finalizada"
      actions={
        perms.canCreateOrders ? (
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="size-4 mr-1" /> Nova Ordem
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((f) => {
          const count = f.k === "all" ? orders.length : orders.filter((o) => o.status === f.k).length;
          return (
            <button
              key={f.k}
              onClick={() => setStatusFilter(f.k)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
                statusFilter === f.k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-panel hover:bg-secondary"
              }`}
            >
              {f.l} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="bg-panel border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/50 border-b">
                <Th>Código</Th>
                <Th>Peça de Entrada</Th>
                <Th>Fornecedor</Th>
                <Th>Açougueiro</Th>
                <Th>Data</Th>
                <Th className="text-right">Peso Inicial</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhuma ordem neste filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-secondary/40 transition-colors">
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
                    <td className="px-6 py-3">{formatDate(o.order_date)}</td>
                    <td className="px-6 py-3 text-right font-mono">{formatKg(o.peso_inicial, 2)} kg</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        {o.finalizada_com_divergencia ? (
                          <span className="text-[9px] font-bold uppercase text-destructive">divergência</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {perms.canCancelOrders && o.status !== "finalizada" && o.status !== "cancelada" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCancelId(o.id);
                            setCancelReason("");
                          }}
                          title="Cancelar ordem"
                        >
                          <XCircle className="size-4 text-destructive" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nova ordem */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Desossa</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Entrada de Mercadoria *</Label>
                <Select
                  value={form.stock_entry_id}
                  onValueChange={(v) => {
                    const entry: any = stockEntries.find((e: any) => e.id === v);
                    setForm((f) => ({
                      ...f,
                      stock_entry_id: v,
                      supplier_id: entry?.supplier_id ?? "",
                      peso_inicial: entry?.peso_bruto ? Number(entry.peso_bruto) : f.peso_inicial,
                      valor_compra:
                        entry?.purchase_value != null ? String(entry.purchase_value) : f.valor_compra,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a entrada que originou esta ordem" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockEntries.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhuma entrada cadastrada. Registre em Entradas antes.
                      </div>
                    ) : (
                      stockEntries.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {formatDate(e.entry_date)} · {e.suppliers?.razao_social ?? "—"} ·{" "}
                          {formatKg(e.peso_bruto, 2)} kg
                          {e.lote ? ` · Lote ${e.lote}` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.supplier_id ? (
                  <p className="text-[11px] text-muted-foreground">
                    Fornecedor:{" "}
                    {suppliers.find((s: any) => s.id === form.supplier_id)?.razao_social ?? "—"}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Peça de Entrada *</Label>
                <Select
                  value={form.peca_entrada_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, peca_entrada_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a peça" />
                  </SelectTrigger>
                  <SelectContent>
                    {pecas.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.product_categories?.name ? (
                          <span className="text-muted-foreground"> · {p.product_categories.name}</span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPeca?.product_categories?.name ? (
                  <p className="text-[11px] text-muted-foreground">
                    Categoria: {selectedPeca.product_categories.name}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Peso Inicial *</Label>
                <WeightInput
                  value={form.peso_inicial}
                  onChange={(v) => setForm((f) => ({ ...f, peso_inicial: v }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.order_date}
                  onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Açougueiro Responsável</Label>
                <Select
                  value={form.assigned_employee_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, assigned_employee_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Atribuir depois se preferir" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name}
                        {!e.user_id ? (
                          <span className="text-muted-foreground text-xs"> · sem login</span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Valor de compra (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Opcional — usado na precificação"
                  value={form.valor_compra}
                  onChange={(e) => setForm((f) => ({ ...f, valor_compra: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Criar Ordem"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={!!cancelId} onOpenChange={(v) => !v && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar ordem?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta ação registra o cancelamento no histórico e notifica o administrador.
            </p>
            <div className="space-y-2">
              <Label>Motivo do cancelamento</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Descreva rapidamente o motivo"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              {cancelMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Cancelar Ordem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.cls}`}>
      {s.label}
    </span>
  );
}
