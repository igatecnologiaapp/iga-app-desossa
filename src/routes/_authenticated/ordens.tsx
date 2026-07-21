import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatKg, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ordens")({
  head: () => ({ meta: [{ title: "Ordens de Desossa — CarnePro" }] }),
  component: Ordens,
});

function Ordens() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState({
    product_id: "",
    supplier_id: "",
    peso_inicial: "",
    order_date: new Date().toISOString().slice(0, 10),
    assigned_employee_id: "",
    observacoes: "",
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["orders-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deboning_orders")
        .select(
          "id, order_code, peso_inicial, status, order_date, created_at, products:product_id(name), suppliers:supplier_id(razao_social, nome_fantasia), employees:assigned_employee_id(full_name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").order("name");
      return data ?? [];
    },
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, razao_social").order("razao_social");
      return data ?? [];
    },
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name");
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.product_id || !form.peso_inicial) throw new Error("Produto e peso obrigatórios");
      const { data: userRes } = await supabase.auth.getUser();
      const code = `#OD-${Math.floor(Math.random() * 900 + 100)}`;
      const { error } = await supabase.from("deboning_orders").insert({
        product_id: form.product_id,
        supplier_id: form.supplier_id || null,
        peso_inicial: Number(form.peso_inicial),
        order_date: form.order_date,
        assigned_employee_id: form.assigned_employee_id || null,
        observacoes: form.observacoes || null,
        order_code: code,
        created_by: userRes.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard-orders"] });
      setOpen(false);
      setForm({
        product_id: "",
        supplier_id: "",
        peso_inicial: "",
        order_date: new Date().toISOString().slice(0, 10),
        assigned_employee_id: "",
        observacoes: "",
      });
      toast.success("Ordem criada");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const filtered = orders.filter((o: any) => statusFilter === "all" || o.status === statusFilter);

  return (
    <AppShell
      title="Ordens de Desossa"
      subtitle="Fluxo operacional completo — do recebimento à finalização"
      actions={
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="size-4 mr-1" /> Nova Ordem
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {[
          { k: "all", l: "Todas" },
          { k: "pendente", l: "Pendentes" },
          { k: "em_andamento", l: "Em andamento" },
          { k: "finalizada", l: "Finalizadas" },
        ].map((f) => (
          <button
            key={f.k}
            onClick={() => setStatusFilter(f.k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
              statusFilter === f.k ? "bg-primary text-primary-foreground border-primary" : "bg-panel"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="bg-panel border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b">
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Código</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Produto</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fornecedor</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Açougueiro</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Peso Inicial</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  Nenhuma ordem.
                </td>
              </tr>
            ) : (
              filtered.map((o: any) => (
                <tr key={o.id} className="border-b hover:bg-secondary/40">
                  <td className="px-6 py-3">
                    <Link to="/ordens/$id" params={{ id: o.id }} className="font-mono font-semibold hover:text-primary">
                      {o.order_code ?? o.id.slice(0, 6)}
                    </Link>
                  </td>
                  <td className="px-6 py-3 font-semibold">{o.products?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {o.suppliers?.nome_fantasia ?? o.suppliers?.razao_social ?? "—"}
                  </td>
                  <td className="px-6 py-3">{o.employees?.full_name ?? "—"}</td>
                  <td className="px-6 py-3">{formatDate(o.order_date)}</td>
                  <td className="px-6 py-3 text-right font-mono">{formatKg(o.peso_inicial)} kg</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Desossa</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Produto *</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Fornecedor</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Peso Inicial (kg) *</Label>
                <Input type="number" step="0.001" required value={form.peso_inicial} onChange={(e) => setForm((f) => ({ ...f, peso_inicial: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.order_date} onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Açougueiro Responsável</Label>
                <Select value={form.assigned_employee_id} onValueChange={(v) => setForm((f) => ({ ...f, assigned_employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMut.isPending}>Criar Ordem</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-secondary text-muted-foreground" },
    em_andamento: { label: "Em andamento", cls: "bg-warning/15 text-amber-700" },
    finalizada: { label: "Finalizada", cls: "bg-success/15 text-emerald-700" },
  };
  const s = map[status] ?? map.pendente;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.cls}`}>
      {s.label}
    </span>
  );
}
