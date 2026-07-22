
-- Phase 4 foundations: stock_entry link, sequential order codes, demo flags

-- 1) Link Order -> Stock Entry (nullable for now; enforced in server fn)
ALTER TABLE public.deboning_orders
  ADD COLUMN IF NOT EXISTS stock_entry_id uuid REFERENCES public.stock_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dbo_orders_stock_entry ON public.deboning_orders(stock_entry_id);
CREATE INDEX IF NOT EXISTS idx_dbo_orders_status_date ON public.deboning_orders(status, order_date);
CREATE INDEX IF NOT EXISTS idx_dbo_orders_assigned ON public.deboning_orders(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_dbo_history_created ON public.deboning_order_history(order_id, created_at DESC);

-- 2) Sequential order code per tenant
CREATE TABLE IF NOT EXISTS public.order_code_counters (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_code_counters TO authenticated;
GRANT ALL ON public.order_code_counters TO service_role;
ALTER TABLE public.order_code_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant members read counters" ON public.order_code_counters;
CREATE POLICY "Tenant members read counters" ON public.order_code_counters
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_order_code(_tenant uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  INSERT INTO public.order_code_counters (tenant_id, last_value)
  VALUES (_tenant, 1)
  ON CONFLICT (tenant_id)
    DO UPDATE SET last_value = order_code_counters.last_value + 1, updated_at = now()
  RETURNING last_value INTO n;
  RETURN 'OD-' || lpad(n::text, 6, '0');
END $$;
REVOKE ALL ON FUNCTION public.next_order_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_order_code(uuid) TO authenticated, service_role;

-- Seed the counter from existing rows
INSERT INTO public.order_code_counters (tenant_id, last_value)
SELECT tenant_id, COALESCE(MAX(NULLIF(regexp_replace(order_code, '\D', '', 'g'), '')::bigint), 0)
FROM public.deboning_orders
WHERE order_code IS NOT NULL
GROUP BY tenant_id
ON CONFLICT (tenant_id) DO UPDATE
  SET last_value = GREATEST(order_code_counters.last_value, EXCLUDED.last_value);

-- 3) Demo mode flags (only rows created by the demo seed are wiped on reload)
ALTER TABLE public.suppliers          ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.employees          ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.stock_entries      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.deboning_orders    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.deboning_pieces    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.deboning_losses    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.deboning_order_history ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 4) Extend order history with structured field-level change tracking
ALTER TABLE public.deboning_order_history
  ADD COLUMN IF NOT EXISTS field text,
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS new_value text;
