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
import { Plus, Pencil, Trash2, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/cortes")({
  head: () => ({
    meta: [
      { title: "Cortes — PRO MEAT" },
      { name: "description", content: "Cadastro estruturado de cortes." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin"]),
  component: Cortes,
});

interface Corte {
  id: string;
  name: string;
  code: string | null;
  category_id: string | null;
  active: boolean;
}
interface Cat {
  id: string;
  name: string;
}

function Cortes() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Corte> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("product_categories").select("id, name").order("name");
      return (data ?? []) as Cat[];
    },
  });

  const { data: cortes = [] } = useQuery({
    queryKey: ["cortes"],
    queryFn: async () => {
      const { data } = await supabase.from("cortes").select("*").order("name");
      return (data ?? []) as Corte[];
    },
  });

  const filtered = cortes.filter((c) => filter === "all" || c.category_id === filter);

  const saveMut = useMutation({
    mutationFn: async (c: Partial<Corte>) => {
      const payload = {
        name: c.name!,
        code: c.code ?? null,
        category_id: c.category_id ?? null,
        active: c.active ?? true,
      };
      if (c.id) {
        const { error } = await supabase.from("cortes").update(payload).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cortes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cortes"] });
      setOpen(false);
      setEditing(null);
      toast.success("Corte salvo");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cortes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cortes"] });
      toast.success("Corte removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <AppShell
      title="Cortes"
      subtitle={`${cortes.length} cortes cadastrados`}
      actions={
        <Button
          onClick={() => {
            setEditing({ active: true });
            setOpen(true);
          }}
          size="sm"
        >
          <Plus className="size-4 mr-1" /> Novo Corte
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Todas ({cortes.length})
        </FilterChip>
        {cats.map((c) => {
          const count = cortes.filter((x) => x.category_id === c.id).length;
          return (
            <FilterChip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.name} ({count})
            </FilterChip>
          );
        })}
      </div>

      <div className="bg-panel border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/50 border-b">
                <Th>Corte</Th>
                <Th>Categoria</Th>
                <Th>Código</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhum corte cadastrado.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-secondary/40">
                    <td className="px-6 py-3 font-semibold flex items-center gap-2">
                      <Scissors className="size-3.5 text-muted-foreground" />
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {cats.find((x) => x.id === c.category_id)?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{c.code ?? "—"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.active ? "bg-success/15 text-emerald-700" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {c.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirm(`Remover ${c.name}?`) && delMut.mutate(c.id)}
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Corte" : "Novo Corte"}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={editing?.code ?? ""}
                  onChange={(ev) => setEditing((v) => ({ ...v, code: ev.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={editing?.active ?? true}
                onCheckedChange={(v) => setEditing((s) => ({ ...s, active: v }))}
              />
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

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest ${className}`}>
      {children}
    </th>
  );
}
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-panel hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}
