import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2, ShieldCheck, KeyRound, Loader2, Ban, CheckCircle2, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { adminCreateUser, adminUpdateUser, adminResetPassword, adminDeleteUser } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — CarnePro" },
      { name: "description", content: "Gestão de usuários e perfis do sistema." },
    ],
  }),
  component: UsuariosPage,
});

type Role = "admin" | "supervisor" | "acougueiro" | "visualizacao";

interface Row {
  user_id: string;
  full_name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  roles: Role[];
  active: boolean;
  employee_id: string | null;
  cargo: string | null;
}

function UsuariosPage() {
  const perms = usePermissions();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    id: "" as string | "",
    full_name: "",
    email: "",
    cpf: "",
    phone: "",
    cargo: "",
    role: "acougueiro" as Role,
    password: "",
    confirm: "",
    active: true,
  });
  const [newPassword, setNewPassword] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users-list"],
    enabled: perms.isAdmin,
    queryFn: async () => {
      const [profilesRes, rolesRes, employeesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, cpf, phone"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("employees").select("id, user_id, cargo, status"),
      ]);
      const rolesByUser = new Map<string, Role[]>();
      for (const r of rolesRes.data ?? []) {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role as Role);
        rolesByUser.set(r.user_id, list);
      }
      const empByUser = new Map<string, any>();
      for (const e of employeesRes.data ?? []) {
        if (e.user_id) empByUser.set(e.user_id, e);
      }
      return (profilesRes.data ?? []).map((p) => {
        const emp = empByUser.get(p.id);
        return {
          user_id: p.id,
          full_name: p.full_name,
          email: p.email,
          cpf: p.cpf,
          phone: p.phone,
          roles: rolesByUser.get(p.id) ?? [],
          active: emp ? emp.status === "ativo" : true,
          employee_id: emp?.id ?? null,
          cargo: emp?.cargo ?? null,
        } as Row;
      });
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.email || !form.password) throw new Error("E-mail e senha obrigatórios.");
      if (form.password !== form.confirm) throw new Error("Senhas não coincidem.");
      if (form.password.length < 6) throw new Error("Senha mínima de 6 caracteres.");
      await adminCreateUser({
        data: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          cpf: form.cpf || null,
          phone: form.phone || null,
          cargo: form.cargo || null,
          role: form.role,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-min"] });
      setOpen(false);
      resetForm();
      toast.success("Usuário criado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      await adminUpdateUser({
        data: {
          user_id: form.id,
          full_name: form.full_name,
          cpf: form.cpf || null,
          phone: form.phone || null,
          cargo: form.cargo || null,
          role: form.role,
          active: form.active,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      setOpen(false);
      resetForm();
      toast.success("Usuário atualizado");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!pwOpen) return;
      if (newPassword.length < 6) throw new Error("Senha mínima de 6 caracteres.");
      await adminResetPassword({ data: { user_id: pwOpen, password: newPassword } });
    },
    onSuccess: () => {
      setPwOpen(null);
      setNewPassword("");
      toast.success("Senha redefinida");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: async (userId: string) => {
      await adminDeleteUser({ data: { user_id: userId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-list"] });
      toast.success("Usuário removido");
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  function resetForm() {
    setForm({
      id: "",
      full_name: "",
      email: "",
      cpf: "",
      phone: "",
      cargo: "",
      role: "acougueiro",
      password: "",
      confirm: "",
      active: true,
    });
  }

  if (!perms.isAdmin && !perms.isLoading) {
    return (
      <AppShell title="Usuários">
        <div className="text-sm text-muted-foreground">Somente administradores.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Usuários"
      subtitle="Administradores, supervisores, açougueiros e usuários de visualização"
      actions={
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          <Plus className="size-4 mr-1" /> Novo Usuário
        </Button>
      }
    >
      <div className="bg-panel border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/50 border-b">
                <Th>Nome</Th>
                <Th>E-mail / CPF</Th>
                <Th>Cargo</Th>
                <Th>Perfil</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum usuário.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id} className="border-b hover:bg-secondary/40">
                    <td className="px-6 py-3 font-semibold">{u.full_name ?? "—"}</td>
                    <td className="px-6 py-3">
                      <div className="text-xs">{u.email ?? "—"}</div>
                      {u.cpf ? <div className="text-[10px] text-muted-foreground font-mono">{u.cpf}</div> : null}
                    </td>
                    <td className="px-6 py-3">{u.cargo ?? "—"}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">sem perfil</span>
                        ) : (
                          u.roles.map((r) => <RoleChip key={r} role={r} />)
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.active ? "bg-success/15 text-emerald-700" : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {u.active ? <CheckCircle2 className="size-3" /> : <Ban className="size-3" />}
                        {u.active ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setForm({
                              id: u.user_id,
                              full_name: u.full_name ?? "",
                              email: u.email ?? "",
                              cpf: u.cpf ?? "",
                              phone: u.phone ?? "",
                              cargo: u.cargo ?? "",
                              role: u.roles[0] ?? "acougueiro",
                              password: "",
                              confirm: "",
                              active: u.active,
                            });
                            setOpen(true);
                          }}
                          title="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPwOpen(u.user_id);
                            setNewPassword("");
                          }}
                          title="Redefinir senha"
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover ${u.full_name ?? u.email}?`)) delMut.mutate(u.user_id);
                          }}
                          title="Remover"
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

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              {form.id ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              form.id ? updateMut.mutate() : createMut.mutate();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome completo *</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>E-mail {!form.id ? "*" : ""}</Label>
                <Input
                  type="email"
                  required={!form.id}
                  disabled={!!form.id}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={form.cargo}
                  onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  placeholder="Ex: Açougueiro Sênior"
                />
              </div>
              <div className="space-y-2">
                <Label>Perfil *</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="acougueiro">Açougueiro</SelectItem>
                    <SelectItem value="visualizacao">Visualização</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!form.id ? (
                <>
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <div className="relative">
                      <Input
                        type={showPw ? "text" : "password"}
                        required
                        minLength={6}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar senha *</Label>
                    <Input
                      type={showPw ? "text" : "password"}
                      required
                      minLength={6}
                      value={form.confirm}
                      onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <div className="md:col-span-2 space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.active ? "ativo" : "bloqueado"}
                    onValueChange={(v) => setForm((f) => ({ ...f, active: v === "ativo" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="bloqueado">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!pwOpen} onOpenChange={(v) => !v && setPwOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nova senha</Label>
            <Input
              type="password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={() => resetMut.mutate()} disabled={resetMut.isPending}>
              {resetMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Redefinir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  acougueiro: "Açougueiro",
  visualizacao: "Visualização",
};
const ROLE_COLOR: Record<Role, string> = {
  admin: "bg-primary/10 text-primary",
  supervisor: "bg-chart-4/10 text-blue-700",
  acougueiro: "bg-warning/15 text-amber-700",
  visualizacao: "bg-secondary text-muted-foreground",
};

function RoleChip({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${ROLE_COLOR[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
      {children}
    </th>
  );
}
