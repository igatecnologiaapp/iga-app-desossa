import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin" as any,
  });
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Somente administradores podem executar esta ação.");
}

interface CreateInput {
  email: string;
  password: string;
  full_name: string;
  cpf?: string | null;
  phone?: string | null;
  cargo?: string | null;
  role: "admin" | "supervisor" | "acougueiro" | "visualizacao";
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: data.role },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    // Profile
    await supabaseAdmin.from("profiles").upsert(
      {
        id: uid,
        full_name: data.full_name,
        email: data.email,
        cpf: data.cpf ?? null,
        phone: data.phone ?? null,
      },
      { onConflict: "id" },
    );

    // Reset role (trigger cria admin por padrão)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role as any });

    // Employee record se for açougueiro
    if (data.role === "acougueiro") {
      await supabaseAdmin.from("employees").upsert(
        {
          user_id: uid,
          full_name: data.full_name,
          email: data.email,
          cpf: data.cpf ?? null,
          cargo: data.cargo ?? "Açougueiro",
          status: "ativo",
        },
        { onConflict: "user_id" } as any,
      );
    }

    return { ok: true, user_id: uid };
  });

interface UpdateInput {
  user_id: string;
  full_name: string;
  cpf?: string | null;
  phone?: string | null;
  cargo?: string | null;
  role: "admin" | "supervisor" | "acougueiro" | "visualizacao";
  active: boolean;
}

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UpdateInput) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        cpf: data.cpf ?? null,
        phone: data.phone ?? null,
      })
      .eq("id", data.user_id);

    // Sync role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role as any });

    // Employee sync
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (data.role === "acougueiro") {
      if (emp) {
        await supabaseAdmin
          .from("employees")
          .update({
            full_name: data.full_name,
            cargo: data.cargo ?? "Açougueiro",
            status: data.active ? "ativo" : "inativo",
          })
          .eq("user_id", data.user_id);
      } else {
        await supabaseAdmin.from("employees").insert({
          user_id: data.user_id,
          full_name: data.full_name,
          cargo: data.cargo ?? "Açougueiro",
          status: data.active ? "ativo" : "inativo",
        });
      }
    } else if (emp) {
      await supabaseAdmin
        .from("employees")
        .update({ status: data.active ? "ativo" : "inativo" })
        .eq("user_id", data.user_id);
    }

    // Bloquear/desbloquear no Auth
    if (!data.active) {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "876000h" as any });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, { ban_duration: "none" as any });
    }

    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; password: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir seu próprio usuário.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
