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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/pecas")({
  head: () => ({
    meta: [
      { title: "Peças de Entrada — CarnePro" },
      { name: "description", content: "Cadastro das peças recebidas do fornecedor." },
    ],
  }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin"]),
  component: PecasEntrada,
});

interface Peca {
  id: string;
  name: string;
  code: string | null;
  category_id: string | null;
  active: boolean;
  observacoes: string | null;
}

function PecasEntrada() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Peca> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("product_categories").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: pecas = [] } = useQuery({
    queryKey: ["pecas-entrada-list"],
    queryFn: async () => {
      const { data } = await supabase.from("pecas_entrada").select("*").order("name");
      return (data ?? []) as Peca[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (p: Partial<Peca>) => {
      const payload = {
        name: p.name!,
        code: p.code ?? null,
        category_id: p.category_id ?? null,
        active: p.active ?? true,
        observacoes: p.observacoes ?? null,
      };
      if (p.id) {
        const { error } = await supabase.from("pecas_entrada").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pecas_entrada").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pecas-entrada-list"] });
      qc.invalidateQueries({ queryKey: ["pecas-list"] });
      setOpen(false);
      setEditing(null);
      toast.success("Peça salva");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pecas_entrada").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pecas-entrada-list"] });
      toast.success("Removido");
    },
  });

  return (
    <AppShell
      title="Peças de Entrada"
      subtitle="Catálogo das peças que chegam do fornecedor"
      actions={
        <Button
          onClick={() => {
            setEditing({ active: true });
            setOpen(true);
          }}
          size="sm"
        >
          <Plus className="size-4 mr-1" /> Nova Peça
        </Button>
      }
    >
      <div className="bg-panel border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/50 border-b">
                <Th>Peça</Th>
                <Th>Categoria</Th>
                <Th>Código</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {pecas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    Nenhuma peça cadastrada.
                  </td>
                </tr>
              ) : (
                pecas.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-secondary/40">
                    <td className="px-6 py-3 font-semibold flex items-center gap-2">
                      <Layers className="size-3.5 text-muted-foreground" />
                      {p.name}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {(cats as any[]).find((c) => c.id === p.category_id)?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{p.code ?? "—"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.active ? "bg-success/15 text-emerald-700" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
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
                          onClick={() => confirm(`Remover ${p.name}?`) && delMut.mutate(p.id)}
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
            <DialogTitle>{editing?.id ? "Editar Peça" : "Nova Peça de Entrada"}</DialogTitle>
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
                    {(cats as any[]).map((c) => (
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
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editing?.observacoes ?? ""}
                onChange={(ev) => setEditing((v) => ({ ...v, observacoes: ev.target.value }))}
              />
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
