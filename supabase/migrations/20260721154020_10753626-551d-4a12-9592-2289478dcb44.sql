
create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'acougueiro');
create type public.order_status as enum ('pendente', 'em_andamento', 'finalizada');

-- ============ Tables ============
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.tenants to authenticated;
grant all on public.tenants to service_role;
alter table public.tenants enable row level security;
insert into public.tenants (id, name) values ('00000000-0000-0000-0000-000000000001', 'Açougue Central');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) default '00000000-0000-0000-0000-000000000001',
  full_name text,
  email text,
  cpf text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) default '00000000-0000-0000-0000-000000000001',
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role, tenant_id)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_user_tenant(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = _user_id
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _role public.app_role;
  _tenant uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into public.profiles (id, tenant_id, full_name, email)
  values (new.id, _tenant, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  _role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'admin'::public.app_role);
  insert into public.user_roles (user_id, tenant_id, role) values (new.id, _tenant, _role);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  razao_social text not null,
  nome_fantasia text,
  cnpj text,
  contato text,
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  cpf text,
  cargo text,
  email text,
  status text not null default 'ativo',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.employees to authenticated;
grant all on public.employees to service_role;
alter table public.employees enable row level security;

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);
grant select, insert, update, delete on public.product_categories to authenticated;
grant all on public.product_categories to service_role;
alter table public.product_categories enable row level security;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  code text,
  unit text not null default 'kg',
  peso_medio numeric(10,3),
  observacoes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;

create table public.stock_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  supplier_id uuid references public.suppliers(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  peso_bruto numeric(10,3) not null,
  entry_date date not null default current_date,
  invoice_number text,
  purchase_value numeric(12,2),
  lote text,
  observacoes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.stock_entries to authenticated;
grant all on public.stock_entries to service_role;
alter table public.stock_entries enable row level security;

create table public.deboning_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default '00000000-0000-0000-0000-000000000001' references public.tenants(id),
  order_code text,
  product_id uuid references public.products(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  peso_inicial numeric(10,3) not null,
  order_date date not null default current_date,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  status public.order_status not null default 'pendente',
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.deboning_orders to authenticated;
grant all on public.deboning_orders to service_role;
alter table public.deboning_orders enable row level security;

create table public.deboning_pieces (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.deboning_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  peso numeric(10,3) not null,
  quantidade integer not null default 1,
  observacoes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.deboning_pieces to authenticated;
grant all on public.deboning_pieces to service_role;
alter table public.deboning_pieces enable row level security;

create table public.deboning_losses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.deboning_orders(id) on delete cascade,
  ossos numeric(10,3) not null default 0,
  gordura numeric(10,3) not null default 0,
  retalhos numeric(10,3) not null default 0,
  descarte numeric(10,3) not null default 0,
  outros numeric(10,3) not null default 0,
  observacoes text,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.deboning_losses to authenticated;
grant all on public.deboning_losses to service_role;
alter table public.deboning_losses enable row level security;

-- ============ Policies (created after all tables exist) ============
create policy "Users see their tenant" on public.tenants
  for select to authenticated
  using (id in (select tenant_id from public.profiles where id = auth.uid()));

create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid());
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "Users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create policy "Tenant members read suppliers" on public.suppliers
  for select to authenticated using (tenant_id = public.get_user_tenant(auth.uid()));
create policy "Admins manage suppliers" on public.suppliers
  for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

create policy "Tenant members read employees" on public.employees
  for select to authenticated using (tenant_id = public.get_user_tenant(auth.uid()));
create policy "Admins manage employees" on public.employees
  for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

create policy "Tenant members read categories" on public.product_categories
  for select to authenticated using (tenant_id = public.get_user_tenant(auth.uid()));
create policy "Admins manage categories" on public.product_categories
  for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

create policy "Tenant members read products" on public.products
  for select to authenticated using (tenant_id = public.get_user_tenant(auth.uid()));
create policy "Admins manage products" on public.products
  for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

create policy "Tenant members read stock" on public.stock_entries
  for select to authenticated using (tenant_id = public.get_user_tenant(auth.uid()));
create policy "Admins manage stock" on public.stock_entries
  for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));

create policy "Admins read all orders" on public.deboning_orders
  for select to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));
create policy "Butchers read assigned orders" on public.deboning_orders
  for select to authenticated
  using (
    tenant_id = public.get_user_tenant(auth.uid())
    and assigned_employee_id in (select id from public.employees where user_id = auth.uid())
  );
create policy "Admins manage orders" on public.deboning_orders
  for all to authenticated
  using (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'))
  with check (tenant_id = public.get_user_tenant(auth.uid()) and public.has_role(auth.uid(), 'admin'));
create policy "Butchers update assigned orders" on public.deboning_orders
  for update to authenticated
  using (
    tenant_id = public.get_user_tenant(auth.uid())
    and assigned_employee_id in (select id from public.employees where user_id = auth.uid())
  )
  with check (
    tenant_id = public.get_user_tenant(auth.uid())
    and assigned_employee_id in (select id from public.employees where user_id = auth.uid())
  );

create policy "Read pieces of accessible orders" on public.deboning_pieces
  for select to authenticated
  using (order_id in (
    select id from public.deboning_orders
    where tenant_id = public.get_user_tenant(auth.uid())
      and (public.has_role(auth.uid(), 'admin')
           or assigned_employee_id in (select id from public.employees where user_id = auth.uid()))
  ));
create policy "Manage pieces of accessible orders" on public.deboning_pieces
  for all to authenticated
  using (order_id in (
    select id from public.deboning_orders
    where tenant_id = public.get_user_tenant(auth.uid())
      and (public.has_role(auth.uid(), 'admin')
           or assigned_employee_id in (select id from public.employees where user_id = auth.uid()))
  ))
  with check (order_id in (
    select id from public.deboning_orders
    where tenant_id = public.get_user_tenant(auth.uid())
      and (public.has_role(auth.uid(), 'admin')
           or assigned_employee_id in (select id from public.employees where user_id = auth.uid()))
  ));

create policy "Read losses of accessible orders" on public.deboning_losses
  for select to authenticated
  using (order_id in (
    select id from public.deboning_orders
    where tenant_id = public.get_user_tenant(auth.uid())
      and (public.has_role(auth.uid(), 'admin')
           or assigned_employee_id in (select id from public.employees where user_id = auth.uid()))
  ));
create policy "Manage losses of accessible orders" on public.deboning_losses
  for all to authenticated
  using (order_id in (
    select id from public.deboning_orders
    where tenant_id = public.get_user_tenant(auth.uid())
      and (public.has_role(auth.uid(), 'admin')
           or assigned_employee_id in (select id from public.employees where user_id = auth.uid()))
  ))
  with check (order_id in (
    select id from public.deboning_orders
    where tenant_id = public.get_user_tenant(auth.uid())
      and (public.has_role(auth.uid(), 'admin')
           or assigned_employee_id in (select id from public.employees where user_id = auth.uid()))
  ));

-- ============ Seed ============
do $$
declare
  _t uuid := '00000000-0000-0000-0000-000000000001';
  _cat_dianteiro uuid;
  _cat_traseiro uuid;
  _cat_frango uuid;
  _cat_suino uuid;
  _cat_ovino uuid;
  _cat_miudos uuid;
  _cat_outros uuid;
begin
  insert into public.product_categories (tenant_id, name, slug) values (_t, 'Dianteiro Bovino', 'dianteiro-bovino') returning id into _cat_dianteiro;
  insert into public.product_categories (tenant_id, name, slug) values (_t, 'Traseiro Bovino', 'traseiro-bovino') returning id into _cat_traseiro;
  insert into public.product_categories (tenant_id, name, slug) values (_t, 'Frango', 'frango') returning id into _cat_frango;
  insert into public.product_categories (tenant_id, name, slug) values (_t, 'Suíno', 'suino') returning id into _cat_suino;
  insert into public.product_categories (tenant_id, name, slug) values (_t, 'Ovino', 'ovino') returning id into _cat_ovino;
  insert into public.product_categories (tenant_id, name, slug) values (_t, 'Miúdos', 'miudos') returning id into _cat_miudos;
  insert into public.product_categories (tenant_id, name, slug) values (_t, 'Outros', 'outros') returning id into _cat_outros;

  insert into public.products (tenant_id, category_id, name, code, unit) values
    (_t, _cat_dianteiro, 'Acém', 'ACE', 'kg'),
    (_t, _cat_dianteiro, 'Paleta', 'PAL', 'kg'),
    (_t, _cat_dianteiro, 'Peito', 'PEI', 'kg'),
    (_t, _cat_dianteiro, 'Cupim', 'CUP', 'kg'),
    (_t, _cat_traseiro, 'Alcatra', 'ALC', 'kg'),
    (_t, _cat_traseiro, 'Picanha', 'PIC', 'kg'),
    (_t, _cat_traseiro, 'Contra Filé', 'CFI', 'kg'),
    (_t, _cat_traseiro, 'Patinho', 'PAT', 'kg'),
    (_t, _cat_traseiro, 'Coxão Mole', 'CMO', 'kg'),
    (_t, _cat_traseiro, 'Coxão Duro', 'CDU', 'kg'),
    (_t, _cat_traseiro, 'Lagarto', 'LAG', 'kg'),
    (_t, _cat_traseiro, 'Maminha', 'MAM', 'kg'),
    (_t, _cat_traseiro, 'Fraldinha', 'FRA', 'kg'),
    (_t, _cat_frango, 'Peito de Frango', 'PFR', 'kg'),
    (_t, _cat_frango, 'Asa', 'ASA', 'kg'),
    (_t, _cat_frango, 'Coxa', 'COX', 'kg'),
    (_t, _cat_frango, 'Sobrecoxa', 'SBX', 'kg'),
    (_t, _cat_frango, 'Tulipa', 'TUL', 'kg'),
    (_t, _cat_suino, 'Pernil Suíno', 'PES', 'kg'),
    (_t, _cat_suino, 'Paleta Suína', 'PSU', 'kg'),
    (_t, _cat_suino, 'Costela Suína', 'CST', 'kg'),
    (_t, _cat_suino, 'Lombo Suíno', 'LBO', 'kg'),
    (_t, _cat_suino, 'Panceta', 'PNC', 'kg');
end $$;
