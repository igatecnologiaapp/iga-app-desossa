ALTER TABLE public.stock_entries
  ADD COLUMN IF NOT EXISTS peca_entrada_id uuid REFERENCES public.pecas_entrada(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_entries_peca_entrada ON public.stock_entries(peca_entrada_id);

ALTER TABLE public.stock_entries ALTER COLUMN product_id DROP NOT NULL;