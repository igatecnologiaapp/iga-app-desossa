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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Operacional",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/ordens", label: "Ordens de Desossa", icon: ClipboardList },
      { to: "/entradas", label: "Entrada de Produtos", icon: Package },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { to: "/fornecedores", label: "Fornecedores", icon: Truck },
      { to: "/funcionarios", label: "Funcionários", icon: UserCog },
      { to: "/produtos", label: "Produtos", icon: Package },
    ],
  },
  {
    label: "Análise",
    items: [
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/mobile", label: "Visão Açougueiro", icon: Smartphone },
    ],
  },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { context } = useUserContext();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="hidden lg:flex w-64 border-r bg-panel flex-col sticky top-0 h-screen shrink-0">
      <div className="p-6 border-b flex items-center gap-3">
        <div className="size-9 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
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
        {groups.map((group) => (
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
                    <Icon
                      className={cn("size-4 shrink-0", active && "text-primary")}
                    />
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
            {(context?.profile?.full_name ?? context?.profile?.email ?? "U")
              .toString()
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate">
              {context?.profile?.full_name ?? context?.profile?.email ?? "Usuário"}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">
              {context?.isAdmin ? "Administrador" : "Açougueiro"}
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
