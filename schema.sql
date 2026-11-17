-- EONIX INVOICE — Supabase schema
-- Run once in Supabase SQL Editor. Uses authenticated user ownership.
create extension if not exists pgcrypto;

create table if not exists public.invoice_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Business',
  email text,
  phone text,
  address text,
  currency text not null default 'MYR' check (currency in ('MYR','USD','SGD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.invoice_businesses(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.invoice_businesses(id) on delete cascade,
  customer_id uuid not null references public.invoice_customers(id) on delete restrict,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  currency text not null default 'MYR' check (currency in ('MYR','USD','SGD')),
  notes text,
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.invoice_businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoice_documents(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_invoice_customers_business on public.invoice_customers(business_id);
create index if not exists idx_invoice_documents_business on public.invoice_documents(business_id);
create index if not exists idx_invoice_documents_customer on public.invoice_documents(customer_id);
create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);

-- Helper: current user owns the business.
create or replace function public.owns_invoice_business(target_business uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.invoice_businesses b
    where b.id = target_business and b.owner_id = auth.uid()
  );
$$;

alter table public.invoice_businesses enable row level security;
alter table public.invoice_customers enable row level security;
alter table public.invoice_documents enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "business owner can read own business" on public.invoice_businesses;
create policy "business owner can read own business" on public.invoice_businesses
for select to authenticated using (owner_id = auth.uid());
drop policy if exists "business owner can create business" on public.invoice_businesses;
create policy "business owner can create business" on public.invoice_businesses
for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "business owner can update own business" on public.invoice_businesses;
create policy "business owner can update own business" on public.invoice_businesses
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "business owner can delete own business" on public.invoice_businesses;
create policy "business owner can delete own business" on public.invoice_businesses
for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "owner manages own customers" on public.invoice_customers;
create policy "owner manages own customers" on public.invoice_customers
for all to authenticated using (public.owns_invoice_business(business_id))
with check (public.owns_invoice_business(business_id));

drop policy if exists "owner manages own invoices" on public.invoice_documents;
create policy "owner manages own invoices" on public.invoice_documents
for all to authenticated using (public.owns_invoice_business(business_id))
with check (
  public.owns_invoice_business(business_id)
  and exists (
    select 1 from public.invoice_customers c
    where c.id = customer_id and c.business_id = business_id
  )
);

drop policy if exists "owner manages own invoice items" on public.invoice_items;
create policy "owner manages own invoice items" on public.invoice_items
for all to authenticated using (public.owns_invoice_business(business_id))
with check (
  public.owns_invoice_business(business_id)
  and exists (
    select 1 from public.invoice_documents i
    where i.id = invoice_id and i.business_id = business_id
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.invoice_businesses to authenticated;
grant select, insert, update, delete on public.invoice_customers to authenticated;
grant select, insert, update, delete on public.invoice_documents to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;

-- NOTE: For public invoice links, payment gateway integration, team roles,
-- server-side PDF generation and subscription billing, add a trusted backend
-- function/edge function and separate access policies before production use.
