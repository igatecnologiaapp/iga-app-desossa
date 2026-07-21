
-- 1) PEÇAS DE ENTRADA -------------------------------------------
create table if not exists public.pecas_entrada (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  code text,
  active boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.pecas_entrada to authenticated;
grant all on public.pecas_entrada to service_role;
alter table public.pecas_entrada enable row level security;
drop policy if exists "tenant members read pecas_entrada" on public.pecas_entrada;
create policy "tenant members read pecas_entrada" on public.pecas_entrada for select to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()));
drop policy if exists "admins manage pecas_entrada" on public.pecas_entrada;
create policy "admins manage pecas_entrada" on public.pecas_entrada for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

-- 2) CORTES -----------------------------------------------------
create table if not exists public.cortes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.cortes to authenticated;
grant all on public.cortes to service_role;
alter table public.cortes enable row level security;
drop policy if exists "tenant members read cortes" on public.cortes;
create policy "tenant members read cortes" on public.cortes for select to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()));
drop policy if exists "admins manage cortes" on public.cortes;
create policy "admins manage cortes" on public.cortes for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

-- 3) MAPEAMENTO PEÇA -> CORTES ----------------------------------
create table if not exists public.peca_cortes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  peca_id uuid not null references public.pecas_entrada(id) on delete cascade,
  corte_id uuid not null references public.cortes(id) on delete cascade,
  rendimento_esperado_pct numeric(6,2),
  created_at timestamptz not null default now(),
  unique (peca_id, corte_id)
);
grant select, insert, update, delete on public.peca_cortes to authenticated;
grant all on public.peca_cortes to service_role;
alter table public.peca_cortes enable row level security;
drop policy if exists "tenant members read peca_cortes" on public.peca_cortes;
create policy "tenant members read peca_cortes" on public.peca_cortes for select to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()));
drop policy if exists "admins manage peca_cortes" on public.peca_cortes;
create policy "admins manage peca_cortes" on public.peca_cortes for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

-- 4) EXTENSÕES de deboning_orders --------------------------------
alter table public.deboning_orders
  add column if not exists peca_entrada_id uuid references public.pecas_entrada(id) on delete set null,
  add column if not exists valor_compra numeric(12,2),
  add column if not exists margem_pct numeric(6,2),
  add column if not exists divergencia_kg numeric(10,3),
  add column if not exists divergencia_pct numeric(6,2),
  add column if not exists finalizada_com_divergencia boolean not null default false,
  add column if not exists cancellation_reason text;

-- 5) HISTÓRICO --------------------------------------------------
create table if not exists public.deboning_order_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  order_id uuid not null references public.deboning_orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  action text not null,
  from_status text,
  to_status text,
  metadata jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_dbo_history_order on public.deboning_order_history(order_id);
grant select, insert on public.deboning_order_history to authenticated;
grant all on public.deboning_order_history to service_role;
alter table public.deboning_order_history enable row level security;
drop policy if exists "read history of accessible orders" on public.deboning_order_history;
create policy "read history of accessible orders" on public.deboning_order_history for select to authenticated
  using (
    order_id in (
      select id from public.deboning_orders
      where tenant_id = public.get_user_tenant(auth.uid())
        and (
          public.has_role(auth.uid(), 'admin')
          or public.has_role(auth.uid(), 'supervisor')
          or public.has_role(auth.uid(), 'visualizacao')
          or assigned_employee_id in (select id from public.employees where user_id = auth.uid())
        )
    )
  );
drop policy if exists "insert history for accessible orders" on public.deboning_order_history;
create policy "insert history for accessible orders" on public.deboning_order_history for insert to authenticated
  with check (
    order_id in (
      select id from public.deboning_orders
      where tenant_id = public.get_user_tenant(auth.uid())
        and (
          public.has_role(auth.uid(), 'admin')
          or public.has_role(auth.uid(), 'supervisor')
          or assigned_employee_id in (select id from public.employees where user_id = auth.uid())
        )
    )
  );

-- 6) NOTIFICAÇÕES -----------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  order_id uuid references public.deboning_orders(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "insert notifications tenant scope" on public.notifications;
create policy "insert notifications tenant scope" on public.notifications for insert to authenticated
  with check (tenant_id = public.get_user_tenant(auth.uid()));
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

-- 7) CONFIGURAÇÕES DO TENANT ------------------------------------
create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  divergencia_maxima_kg numeric(10,3) not null default 0.500,
  atencao_pct numeric(6,2) not null default 2.0,
  critico_pct numeric(6,2) not null default 5.0,
  margem_padrao_pct numeric(6,2) not null default 30.0,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.tenant_settings to authenticated;
grant all on public.tenant_settings to service_role;
alter table public.tenant_settings enable row level security;
drop policy if exists "tenant members read settings" on public.tenant_settings;
create policy "tenant members read settings" on public.tenant_settings for select to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()));
drop policy if exists "admins manage settings" on public.tenant_settings;
create policy "admins manage settings" on public.tenant_settings for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

insert into public.tenant_settings (tenant_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (tenant_id) do nothing;

-- 8) CORTE nas peças extraídas ----------------------------------
alter table public.deboning_pieces
  add column if not exists corte_id uuid references public.cortes(id) on delete set null;

-- 9) POLICIES para supervisor -----------------------------------
drop policy if exists "supervisor read orders" on public.deboning_orders;
create policy "supervisor read orders" on public.deboning_orders for select to authenticated
  using (
    tenant_id = public.get_user_tenant(auth.uid())
    and (public.has_role(auth.uid(), 'supervisor') or public.has_role(auth.uid(), 'visualizacao'))
  );
drop policy if exists "supervisor create orders" on public.deboning_orders;
create policy "supervisor create orders" on public.deboning_orders for insert to authenticated
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'supervisor'));
drop policy if exists "supervisor update orders" on public.deboning_orders;
create policy "supervisor update orders" on public.deboning_orders for update to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'supervisor'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'supervisor'));

-- 10) SEED de peças e cortes ------------------------------------
do $$
declare
  t uuid := '00000000-0000-0000-0000-000000000001';
  cat_dianteiro uuid;
  cat_traseiro uuid;
  cat_frango uuid;
  cat_suino uuid;
  peca_dianteiro uuid;
  peca_traseiro uuid;
  peca_frango uuid;
  peca_suino uuid;
begin
  select id into cat_dianteiro from public.product_categories where tenant_id = t and lower(name) like '%dianteiro%' limit 1;
  select id into cat_traseiro from public.product_categories where tenant_id = t and lower(name) like '%traseiro%' limit 1;
  select id into cat_frango from public.product_categories where tenant_id = t and lower(name) like '%frango%' limit 1;
  select id into cat_suino from public.product_categories where tenant_id = t and (lower(name) like '%su%no%' or lower(name) like '%suino%') limit 1;

  insert into public.pecas_entrada (tenant_id, category_id, name, code) values
    (t, cat_dianteiro, 'Dianteiro Bovino Inteiro', 'PE-DIA-01'),
    (t, cat_traseiro, 'Traseiro Bovino Inteiro', 'PE-TRA-01'),
    (t, cat_frango, 'Frango Inteiro', 'PE-FRA-01'),
    (t, cat_suino, 'Suíno Meio Carcaça', 'PE-SUI-01')
  on conflict do nothing;

  select id into peca_dianteiro from public.pecas_entrada where tenant_id = t and name = 'Dianteiro Bovino Inteiro';
  select id into peca_traseiro from public.pecas_entrada where tenant_id = t and name = 'Traseiro Bovino Inteiro';
  select id into peca_frango from public.pecas_entrada where tenant_id = t and name = 'Frango Inteiro';
  select id into peca_suino from public.pecas_entrada where tenant_id = t and name = 'Suíno Meio Carcaça';

  insert into public.cortes (tenant_id, category_id, name, code) values
    (t, cat_dianteiro, 'Acém', 'C-ACEM'),
    (t, cat_dianteiro, 'Peito', 'C-PEIT'),
    (t, cat_dianteiro, 'Cupim', 'C-CUPI'),
    (t, cat_dianteiro, 'Paleta', 'C-PALE'),
    (t, cat_dianteiro, 'Músculo Dianteiro', 'C-MUSCD'),
    (t, cat_dianteiro, 'Costela Dianteira', 'C-COSTD'),
    (t, cat_traseiro, 'Picanha', 'C-PICA'),
    (t, cat_traseiro, 'Alcatra', 'C-ALCA'),
    (t, cat_traseiro, 'Contra Filé', 'C-CONT'),
    (t, cat_traseiro, 'Maminha', 'C-MAMI'),
    (t, cat_traseiro, 'Coxão Mole', 'C-CXM'),
    (t, cat_traseiro, 'Coxão Duro', 'C-CXD'),
    (t, cat_traseiro, 'Patinho', 'C-PATI'),
    (t, cat_traseiro, 'Lagarto', 'C-LAGA'),
    (t, cat_traseiro, 'Fraldinha', 'C-FRAL'),
    (t, cat_traseiro, 'Filé Mignon', 'C-FILE'),
    (t, cat_frango, 'Peito Frango', 'C-PFRA'),
    (t, cat_frango, 'Coxa Frango', 'C-CFRA'),
    (t, cat_frango, 'Sobrecoxa', 'C-SFRA'),
    (t, cat_frango, 'Asa', 'C-AFRA'),
    (t, cat_suino, 'Pernil', 'C-PERN'),
    (t, cat_suino, 'Lombo Suíno', 'C-LOMB'),
    (t, cat_suino, 'Costela Suína', 'C-COSU'),
    (t, cat_suino, 'Bisteca', 'C-BIST'),
    (t, cat_suino, 'Barriga', 'C-BARR')
  on conflict do nothing;

  if peca_dianteiro is not null then
    insert into public.peca_cortes (tenant_id, peca_id, corte_id)
    select t, peca_dianteiro, id from public.cortes where tenant_id = t and category_id = cat_dianteiro
    on conflict do nothing;
  end if;
  if peca_traseiro is not null then
    insert into public.peca_cortes (tenant_id, peca_id, corte_id)
    select t, peca_traseiro, id from public.cortes where tenant_id = t and category_id = cat_traseiro
    on conflict do nothing;
  end if;
  if peca_frango is not null then
    insert into public.peca_cortes (tenant_id, peca_id, corte_id)
    select t, peca_frango, id from public.cortes where tenant_id = t and category_id = cat_frango
    on conflict do nothing;
  end if;
  if peca_suino is not null then
    insert into public.peca_cortes (tenant_id, peca_id, corte_id)
    select t, peca_suino, id from public.cortes where tenant_id = t and category_id = cat_suino
    on conflict do nothing;
  end if;
end $$;
