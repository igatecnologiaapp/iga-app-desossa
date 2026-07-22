ALTER TABLE public.deboning_orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid,
  ADD COLUMN IF NOT EXISTS reopen_reason text,
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_deboning_orders_deleted_at ON public.deboning_orders(deleted_at);