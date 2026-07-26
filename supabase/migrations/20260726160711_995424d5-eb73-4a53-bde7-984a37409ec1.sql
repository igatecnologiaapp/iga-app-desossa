-- Harden SECURITY DEFINER helpers: only allow querying about the caller themselves
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('role', true) NOT IN ('postgres','service_role')
     AND (auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid()) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
END $$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE t uuid;
BEGIN
  IF current_setting('role', true) NOT IN ('postgres','service_role')
     AND (auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid()) THEN
    RETURN NULL;
  END IF;
  SELECT tenant_id INTO t FROM public.profiles WHERE id = _user_id;
  RETURN t;
END $$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant(uuid) FROM anon, PUBLIC;

-- Sequential order code generator must only run from trusted server code
REVOKE EXECUTE ON FUNCTION public.next_order_code(uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_order_code(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;