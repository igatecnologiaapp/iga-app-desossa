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

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — PRO MEAT" }] }),
  beforeLoad: ({ context }) => assertAnyRole((context as any).roles ?? [], ["admin"]),
  component: Funcionarios,
});

interface Employee {
  id: string;
  full_name: string;
  cpf: string | null;
  cargo: string | null;
  email: string | null;
  status: string;
  user_id: string | null;
}

function Funcionarios() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (p: Partial<Employee>) => {
      const payload = {
        full_name: p.full_name!,
        cpf: p.cpf ?? null,
        cargo: p.cargo ?? null,
        email: p.email ?? null,
        status: p.status ?? "ativo",
      };
      if (p.id) {
        const { error } = await supabase.from("employees").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        // Tenta vincular a user existente por email
        let userId: string | null = null;
        if (p.email) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", p.email)
            .maybeSingle();
          userId = prof?.id ?? null;
        }
        const { error } = await supabase
          .from("employees")
          .insert({ ...payload, user_id: userId });
        if (error) throw error;
        if (userId) {
          // Garante role acougueiro
          await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: "acougueiro" })
            .then(() => null);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setEditing(null);
      toast.success("Funcionário salvo");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <AppShell
      title="Funcionários"
      subtitle="Administradores e açougueiros da operação"
      actions={
        <Button
          onClick={() => {
            setEditing({ status: "ativo", cargo: "Açougueiro" });
            setOpen(true);
          }}
          size="sm"
        >
          <Plus className="size-4 mr-1" /> Novo
        </Button>
      }
    >
      <div className="bg-panel border rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-secondary/50 border-b">
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Nome
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                CPF
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Cargo
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Vinculado
              </th>
              <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Status
              </th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  Nenhum funcionário cadastrado.
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id} className="border-b hover:bg-secondary/40">
                  <td className="px-6 py-3">
                    <div className="font-semibold">{e.full_name}</div>
                    {e.email ? (
                      <div className="text-xs text-muted-foreground">{e.email}</div>
                    ) : null}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs">{e.cpf ?? "—"}</td>
                  <td className="px-6 py-3">{e.cargo ?? "—"}</td>
                  <td className="px-6 py-3">
                    {e.user_id ? (
                      <span className="text-xs text-success font-semibold">
                        Login ativo
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Aguardando cadastro
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        e.status === "ativo"
                          ? "bg-success/15 text-emerald-700"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(e);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remover ${e.full_name}?`)) deleteMut.mutate(e.id);
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
            <DialogTitle>
              {editing?.id ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing?.full_name) return;
              saveMut.mutate(editing);
            }}
          >
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input
                required
                value={editing?.full_name ?? ""}
                onChange={(ev) =>
                  setEditing((v) => ({ ...v, full_name: ev.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={editing?.cpf ?? ""}
                  onChange={(ev) => setEditing((v) => ({ ...v, cpf: ev.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={editing?.cargo ?? ""}
                  onChange={(ev) =>
                    setEditing((v) => ({ ...v, cargo: ev.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail (para vincular login)</Label>
              <Input
                type="email"
                value={editing?.email ?? ""}
                onChange={(ev) => setEditing((v) => ({ ...v, email: ev.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Se o e-mail corresponder a um usuário já cadastrado, o vínculo é feito
                automaticamente.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editing?.status ?? "ativo"}
                onValueChange={(v) => setEditing((s) => ({ ...s, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
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
