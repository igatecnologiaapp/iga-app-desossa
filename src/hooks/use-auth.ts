import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loaded };
}

export function useUserContext() {
  const { session, loaded } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["user-context", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const [profileRes, rolesRes, employeeRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("employees").select("id, full_name").eq("user_id", userId).maybeSingle(),
      ]);
      const roles = (rolesRes.data ?? []).map((r) => r.role as "admin" | "acougueiro");
      return {
        profile: profileRes.data,
        roles,
        isAdmin: roles.includes("admin"),
        isAcougueiro: roles.includes("acougueiro"),
        employee: employeeRes.data,
      };
    },
  });

  return {
    session,
    loaded,
    userId,
    ...query,
    context: query.data,
  };
}
