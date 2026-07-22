
-- Backfill: link existing employees to profiles/auth by matching email
UPDATE public.employees e
SET user_id = p.id
FROM public.profiles p
WHERE e.user_id IS NULL
  AND e.email IS NOT NULL
  AND lower(e.email) = lower(p.email);

-- Also backfill by matching employee full_name -> profile.full_name when email missing
UPDATE public.employees e
SET user_id = p.id
FROM public.profiles p
WHERE e.user_id IS NULL
  AND lower(trim(e.full_name)) = lower(trim(p.full_name));

-- De-duplicate: keep the most recent employee row per user_id
DELETE FROM public.employees a
USING public.employees b
WHERE a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Ensure a user has at most one employee row
CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_key
  ON public.employees(user_id)
  WHERE user_id IS NOT NULL;

-- Admins can read all profiles (needed for user management listing)
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any profile
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can read all user_roles (needed to display each user's profile in the list)
DROP POLICY IF EXISTS "Admins read all user_roles" ON public.user_roles;
CREATE POLICY "Admins read all user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Ensure the acougueiro employee for any existing user with that role
INSERT INTO public.employees (user_id, full_name, email, cargo, status, tenant_id)
SELECT ur.user_id, p.full_name, p.email, 'Açougueiro', 'ativo', ur.tenant_id
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'acougueiro'
  AND NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.user_id = ur.user_id);
