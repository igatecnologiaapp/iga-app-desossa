import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "supervisor" | "acougueiro" | "visualizacao";

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) return [];
  return ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
}

export function homeForRoles(roles: AppRole[]): "/dashboard" | "/mobile" {
  // Açougueiro puro vai para mobile; qualquer papel administrativo vai para dashboard.
  if (roles.includes("admin") || roles.includes("supervisor") || roles.includes("visualizacao")) {
    return "/dashboard";
  }
  if (roles.includes("acougueiro")) return "/mobile";
  return "/dashboard";
}

/**
 * Guard usado em `beforeLoad` das rotas dentro de `_authenticated/`.
 * Se o usuário não tiver nenhum dos papéis permitidos, é redirecionado
 * para a home compatível com o(s) seu(s) papel(éis) — impede acesso
 * a URLs administrativas por perfis não autorizados.
 */
export function assertAnyRole(roles: AppRole[], allowed: AppRole[]): void {
  if (!roles || roles.length === 0) {
    // Sem papéis: manda ao dashboard (que também redireciona se necessário).
    throw redirect({ to: "/dashboard" });
  }
  if (!roles.some((r) => allowed.includes(r))) {
    throw redirect({ to: homeForRoles(roles) });
  }
}
