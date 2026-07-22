import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Marca notificações do usuário autenticado como lidas.
 * Se `ids` for omitido, marca todas as não lidas do usuário.
 * Auditoria: registro implícito via updated_at/read_at + RLS por user_id.
 */
export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ids?: string[] }) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    let q = supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
    if (data.ids && data.ids.length > 0) {
      q = q.in("id", data.ids);
    }
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
