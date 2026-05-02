create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount_ars numeric(12, 2) not null check (amount_ars > 0),
  category text check (category is null or category in ('Entretenimiento', 'Productividad', 'Lifestyle', 'Utilidad', 'Finanzas', 'Salud', 'Gaming', 'Otros')),
  image_url text,
  avatar_color text,
  frequency text not null check (frequency in ('monthly', 'yearly')),
  start_date date not null,
  active boolean not null default true,
  cancel_from date,
  status text not null default 'active' check (status in ('active', 'cancelled', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create table if not exists public.subscription_amount_overrides (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ars numeric(12, 2) not null check (amount_ars > 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (subscription_id, effective_from)
);

alter table public.subscription_amount_overrides enable row level security;

create policy "users can read own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own subscriptions"
on public.subscriptions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own subscriptions"
on public.subscriptions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own subscriptions"
on public.subscriptions
for delete
to authenticated
using (auth.uid() = user_id);

create policy "users can read own amount overrides"
on public.subscription_amount_overrides
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own amount overrides"
on public.subscription_amount_overrides
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own amount overrides"
on public.subscription_amount_overrides
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own amount overrides"
on public.subscription_amount_overrides
for delete
to authenticated
using (auth.uid() = user_id);
