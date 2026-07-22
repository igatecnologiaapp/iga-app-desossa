import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRoles, type AppRole } from "@/lib/route-guards";
import { SidebarProvider } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async (): Promise<{ userId: string; roles: AppRole[] }> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    const roles = await fetchUserRoles(data.user.id);
    return { userId: data.user.id, roles };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // Sidebar inicia recolhida por padrão; shadcn persiste o estado no cookie `sidebar_state`.
  return (
    <SidebarProvider defaultOpen={false}>
      <Outlet />
    </SidebarProvider>
  );
}
