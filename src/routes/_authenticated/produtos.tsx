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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — PRO MEAT" }] }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin"]),
  component: Produtos,
});

interface Category {
  id: string;
  name: string;
  slug: string;
}
interface Product {
  id: string;
  name: string;
  code: string | null;
  category_id: string | null;
  unit: string;
  peso_medio: number | null;
  observacoes: string | null;
}

function Produtos() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const shown = products.filter((p) => filter === "all" || p.category_id === filter);

  const saveMut = useMutation({
    mutationFn: async (p: Partial<Product>) => {
      const payload = {
        name: p.name!,
        code: p.code ?? null,
        category_id: p.category_id ?? null,
        unit: p.unit ?? "kg",
        peso_medio: p.peso_medio ? Number(p.peso_medio) : null,
        observacoes: p.observacoes ?? null,
      };
      if (p.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setEditing(null);
      toast.success("Produto salvo");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <AppShell
      title="Produtos"
      subtitle={`${products.length} produtos em ${cats.length} categorias`}
      actions={
        <Button
          onClick={() => {
            setEditing({ unit: "kg" });
            setOpen(true);
          }}
          size="sm"
        >
          <Plus className="size-4 mr-1" /> Novo Produto
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${filter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-panel"}`}
        >
          Todas ({products.length})
        </button>
        {cats.map((c) => {
          const count = products.filter((p) => p.category_id === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${filter === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-panel"}`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-panel border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b">
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Produto
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Categoria
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Código
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Unidade
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                Peso Médio
              </th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  Nenhum produto nesta categoria.
                </td>
              </tr>
            ) : (
              shown.map((p) => (
                <tr key={p.id} className="border-b hover:bg-secondary/40">
                  <td className="px-6 py-3 font-semibold">{p.name}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {cats.find((c) => c.id === p.category_id)?.name ?? "—"}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs">{p.code ?? "—"}</td>
                  <td className="px-6 py-3">{p.unit}</td>
                  <td className="px-6 py-3 text-right font-mono">
                    {p.peso_medio ? `${p.peso_medio} ${p.unit}` : "—"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover ${p.name}?`)) deleteMut.mutate(p.id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing?.name) return;
              saveMut.mutate(editing);
            }}
          >
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                required
                value={editing?.name ?? ""}
                onChange={(ev) => setEditing((v) => ({ ...v, name: ev.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={editing?.category_id ?? ""}
                onValueChange={(v) => setEditing((s) => ({ ...s, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={editing?.code ?? ""}
                  onChange={(ev) =>
                    setEditing((v) => ({ ...v, code: ev.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Peso Médio</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={editing?.peso_medio ?? ""}
                  onChange={(ev) =>
                    setEditing((v) => ({
                      ...v,
                      peso_medio: ev.target.value
                        ? Number(ev.target.value)
                        : null,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
