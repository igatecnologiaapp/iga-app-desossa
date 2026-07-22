import { createFileRoute } from "@tanstack/react-router";
import { assertAnyRole } from "@/lib/route-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatKg, formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/entradas")({
  head: () => ({ meta: [{ title: "Entrada de Produtos — PRO MEAT" }] }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin", "supervisor"]),
  component: Entradas,
});

function Entradas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    supplier_id: string;
    product_id: string;
    peso_bruto: string;
    entry_date: string;
    invoice_number: string;
    purchase_value: string;
    lote: string;
  }>({
    supplier_id: "",
    product_id: "",
    peso_bruto: "",
    entry_date: new Date().toISOString().slice(0, 10),
    invoice_number: "",
    purchase_value: "",
    lote: "",
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, razao_social").order("razao_social");
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

  const { data: entries = [] } = useQuery({
    queryKey: ["stock-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_entries")
        .select(
          "id, peso_bruto, entry_date, invoice_number, purchase_value, lote, suppliers:supplier_id(razao_social), products:product_id(name)",
        )
        .order("entry_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.product_id || !form.supplier_id || !form.peso_bruto) {
        throw new Error("Preencha produto, fornecedor e peso bruto.");
      }
      const { error } = await supabase.from("stock_entries").insert({
        supplier_id: form.supplier_id,
        product_id: form.product_id,
        peso_bruto: Number(form.peso_bruto),
        entry_date: form.entry_date,
        invoice_number: form.invoice_number || null,
        purchase_value: form.purchase_value ? Number(form.purchase_value) : null,
        lote: form.lote || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      setOpen(false);
      toast.success("Entrada registrada");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-entries"] }),
  });

  return (
    <AppShell
      title="Entrada de Produtos"
      subtitle="Registro de recebimento (peso bruto) por fornecedor"
      actions={
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus className="size-4 mr-1" /> Nova Entrada
        </Button>
      }
    >
      <div className="bg-panel border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b">
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Produto</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fornecedor</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lote / Nota</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Peso Bruto</th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Valor</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  Nenhuma entrada registrada.
                </td>
              </tr>
            ) : (
              entries.map((e: any) => (
                <tr key={e.id} className="border-b hover:bg-secondary/40">
                  <td className="px-6 py-3">{formatDate(e.entry_date)}</td>
                  <td className="px-6 py-3 font-semibold">{e.products?.name ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{e.suppliers?.razao_social ?? "—"}</td>
                  <td className="px-6 py-3">
                    <div className="text-xs">
                      {e.lote ? <div>Lote: <span className="font-mono">{e.lote}</span></div> : null}
                      {e.invoice_number ? <div>NF: <span className="font-mono">{e.invoice_number}</span></div> : null}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-mono">{formatKg(e.peso_bruto)} kg</td>
                  <td className="px-6 py-3 text-right font-mono">{e.purchase_value ? formatCurrency(e.purchase_value) : "—"}</td>
                  <td className="px-6 py-3">
                    <Button variant="ghost" size="icon" onClick={() => confirm("Remover?") && delMut.mutate(e.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
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
            <DialogTitle>Nova Entrada</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Fornecedor *</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Produto *</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Peso Bruto (kg) *</Label>
                <Input type="number" step="0.001" required value={form.peso_bruto} onChange={(e) => setForm((f) => ({ ...f, peso_bruto: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Nº da Nota</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Lote</Label>
                <Input value={form.lote} onChange={(e) => setForm((f) => ({ ...f, lote: e.target.value }))} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Valor da Compra (R$)</Label>
                <Input type="number" step="0.01" value={form.purchase_value} onChange={(e) => setForm((f) => ({ ...f, purchase_value: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMut.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
