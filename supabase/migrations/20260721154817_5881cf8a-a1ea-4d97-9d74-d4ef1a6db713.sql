alter table public.deboning_orders
  add column if not exists peso_aproveitado numeric(10,3),
  add column if not exists rendimento_pct numeric(6,2),
  add column if not exists observacoes_finalizacao text;