import { createFileRoute } from "@tanstack/react-router";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores — PRO MEAT" }] }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin"]),
  component: Fornecedores,
});

interface Supplier {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
}

function Fornecedores() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Supplier>) => {
      if (payload.id) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            razao_social: payload.razao_social!,
            nome_fantasia: payload.nome_fantasia ?? null,
            cnpj: payload.cnpj ?? null,
            contato: payload.contato ?? null,
            telefone: payload.telefone ?? null,
            email: payload.email ?? null,
            observacoes: payload.observacoes ?? null,
          })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({
          razao_social: payload.razao_social!,
          nome_fantasia: payload.nome_fantasia ?? null,
          cnpj: payload.cnpj ?? null,
          contato: payload.contato ?? null,
          telefone: payload.telefone ?? null,
          email: payload.email ?? null,
          observacoes: payload.observacoes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false);
      setEditing(null);
      toast.success("Fornecedor salvo");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <AppShell
      title="Fornecedores"
      subtitle="Cadastro de frigoríficos e distribuidores"
      actions={
        <Button
          onClick={() => {
            setEditing({});
            setOpen(true);
          }}
          size="sm"
        >
          <Plus className="size-4 mr-1" /> Novo Fornecedor
        </Button>
      }
    >
      <div className="bg-panel border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b">
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Razão Social
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                CNPJ
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Contato
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Telefone
              </th>
              <th className="px-6 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  Nenhum fornecedor cadastrado.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="border-b hover:bg-secondary/40">
                  <td className="px-6 py-3">
                    <div className="font-semibold">{s.razao_social}</div>
                    {s.nome_fantasia ? (
                      <div className="text-xs text-muted-foreground">
                        {s.nome_fantasia}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs">{s.cnpj ?? "—"}</td>
                  <td className="px-6 py-3">{s.contato ?? "—"}</td>
                  <td className="px-6 py-3">{s.telefone ?? "—"}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(s);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover ${s.razao_social}?`))
                            deleteMut.mutate(s.id);
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
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing?.razao_social) return;
              saveMut.mutate(editing);
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Razão Social *</Label>
                <Input
                  required
                  value={editing?.razao_social ?? ""}
                  onChange={(e) =>
                    setEditing((v) => ({ ...v, razao_social: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input
                  value={editing?.nome_fantasia ?? ""}
                  onChange={(e) =>
                    setEditing((v) => ({ ...v, nome_fantasia: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={editing?.cnpj ?? ""}
                  onChange={(e) => setEditing((v) => ({ ...v, cnpj: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input
                  value={editing?.contato ?? ""}
                  onChange={(e) =>
                    setEditing((v) => ({ ...v, contato: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={editing?.telefone ?? ""}
                  onChange={(e) =>
                    setEditing((v) => ({ ...v, telefone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editing?.email ?? ""}
                  onChange={(e) =>
                    setEditing((v) => ({ ...v, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={editing?.observacoes ?? ""}
                  onChange={(e) =>
                    setEditing((v) => ({ ...v, observacoes: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
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
