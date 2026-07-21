-- Restrict SECURITY DEFINER functions from being directly executable by end users.
-- has_role and get_user_tenant remain callable by authenticated because RLS policies invoke them
-- as the querying user; handle_new_user is a trigger and does not need to be user-callable.

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_tenant(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant(uuid) TO authenticated;