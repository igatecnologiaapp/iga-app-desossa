import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ComponentType } from "react";
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
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  show: boolean;
}
interface NavGroup {
  label: string;
  key: string;
  collapsible?: boolean;
  items: NavItem[];
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const perms = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const canOps = perms.isAdmin || perms.isSupervisor || perms.isVisualizacao;

  const groups: NavGroup[] = [
    {
      key: "operacao",
      label: "Operação",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: canOps },
        { to: "/ordens", label: "Ordens de Desossa", icon: ClipboardList, show: canOps },
        { to: "/entradas", label: "Entrada de Produtos", icon: Package, show: perms.isAdmin || perms.isSupervisor },
      ],
    },
    {
      key: "cadastros",
      label: "Cadastros",
      collapsible: true,
      items: [
        { to: "/fornecedores", label: "Fornecedores", icon: Truck, show: perms.isAdmin },
        { to: "/funcionarios", label: "Funcionários", icon: UserCog, show: perms.isAdmin },
        { to: "/produtos", label: "Produtos", icon: Package, show: perms.isAdmin },
        { to: "/pecas", label: "Peças de Entrada", icon: Layers, show: perms.isAdmin },
        { to: "/cortes", label: "Cortes", icon: Scissors, show: perms.isAdmin },
        { to: "/rendimento", label: "Rendimento Esperado", icon: ListTree, show: perms.isAdmin },
      ],
    },
    {
      key: "gestao",
      label: "Gestão",
      items: [
        { to: "/relatorios", label: "Relatórios", icon: BarChart3, show: canOps },
        { to: "/mobile", label: "Visão Açougueiro", icon: Smartphone, show: perms.isAdmin || perms.isAcougueiro },
      ],
    },
    {
      key: "admin",
      label: "Administração",
      items: [
        { to: "/usuarios", label: "Usuários", icon: Users, show: perms.isAdmin },
        { to: "/configuracoes", label: "Configurações", icon: Settings2, show: perms.isAdmin },
      ],
    },
  ];

  const filtered = groups
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

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="size-9 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold shadow-sm shrink-0">
            C
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-bold tracking-tight text-base leading-none">
              CARNE<span className="text-primary">PRO</span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
              Gestão de Desossa
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {filtered.map((group) =>
          group.collapsible ? (
            <CollapsibleGroup
              key={group.key}
              group={group}
              isActive={isActive}
              collapsed={collapsed}
            />
          ) : (
            <SidebarGroup key={group.key}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.to);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                        >
                          <Link to={item.to}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ),
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div
          className={cn(
            "flex items-center gap-3 px-2 py-2",
            collapsed && "justify-center",
          )}
        >
          <div className="size-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs shrink-0">
            {(perms.context?.profile?.full_name ?? perms.context?.profile?.email ?? "U")
              .toString()
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
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
            className="text-muted-foreground hover:text-foreground p-1 rounded group-data-[collapsible=icon]:hidden"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function CollapsibleGroup({
  group,
  isActive,
  collapsed,
}: {
  group: NavGroup;
  isActive: (to: string) => boolean;
  collapsed: boolean;
}) {
  const hasActiveChild = group.items.some((i) => isActive(i.to));
  const [open, setOpen] = useState(hasActiveChild);

  // Quando a sidebar está recolhida em modo ícone: exibe itens como ícones planos com tooltip.
  if (collapsed) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.to)}
                    tooltip={item.label}
                  >
                    <Link to={item.to}>
                      <Icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors"
            aria-expanded={open}
          >
            <span>{group.label}</span>
            <ChevronRight
              className={cn(
                "size-3 transition-transform duration-200",
                open && "rotate-90",
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <SidebarGroupContent>
            <SidebarMenuSub>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuSubItem key={item.to}>
                    <SidebarMenuSubButton asChild isActive={isActive(item.to)}>
                      <Link to={item.to}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
