import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  ClipboardList,
  BarChart3,
  UserCog,
  LogOut,
  Smartphone,
  Scissors,
  Layers,
  ListTree,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const perms = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const canOps = perms.isAdmin || perms.isSupervisor || perms.isVisualizacao;

  const groups: NavGroup[] = [
    {
      label: "Operacional",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: canOps },
        { to: "/ordens", label: "Ordens de Desossa", icon: ClipboardList, show: canOps },
        { to: "/entradas", label: "Entrada de Produtos", icon: Package, show: perms.isAdmin || perms.isSupervisor },
      ],
    },
    {
      label: "Cadastros",
      items: [
        { to: "/fornecedores", label: "Fornecedores", icon: Truck, show: perms.isAdmin },
        { to: "/funcionarios", label: "Funcionários", icon: UserCog, show: perms.isAdmin },
        { to: "/pecas", label: "Peças de Entrada", icon: Layers, show: perms.isAdmin },
        { to: "/cortes", label: "Cortes", icon: Scissors, show: perms.isAdmin },
        { to: "/rendimento", label: "Rendimento Esperado", icon: ListTree, show: perms.isAdmin },
        { to: "/produtos", label: "Produtos", icon: Package, show: perms.isAdmin },
      ],
    },
    {
      label: "Análise",
      items: [
        { to: "/relatorios", label: "Relatórios", icon: BarChart3, show: canOps },
        { to: "/mobile", label: "Visão Açougueiro", icon: Smartphone, show: perms.isAdmin || perms.isAcougueiro },
      ],
    },
    {
      label: "Administração",
      items: [
        { to: "/usuarios", label: "Usuários", icon: Users, show: perms.isAdmin },
        { to: "/configuracoes", label: "Configurações", icon: Settings2, show: perms.isAdmin },
      ],
    },
  ];

  const filteredGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length > 0);

  const roleLabel = perms.isAdmin
    ? "Administrador"
    : perms.isSupervisor
    ? "Supervisor"
    : perms.isAcougueiro
    ? "Açougueiro"
    : perms.isVisualizacao
    ? "Visualização"
    : "Usuário";

  return (
    <aside className="hidden lg:flex w-64 border-r bg-panel flex-col sticky top-0 h-screen shrink-0">
      <div className="p-6 border-b flex items-center gap-3">
        <div className="size-9 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold shadow-sm">
          C
        </div>
        <div className="min-w-0">
          <div className="font-bold tracking-tight text-lg leading-none">
            CARNE<span className="text-primary">PRO</span>
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
            Gestão de Desossa
          </div>
        </div>
      </div>

      <nav className="p-3 flex-1 overflow-y-auto space-y-4">
        {filteredGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      active
                        ? "bg-primary/5 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="size-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs">
            {(perms.context?.profile?.full_name ?? perms.context?.profile?.email ?? "U")
              .toString()
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate">
              {perms.context?.profile?.full_name ?? perms.context?.profile?.email ?? "Usuário"}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
              <ShieldCheck className="size-3" />
              {roleLabel}
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            title="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
