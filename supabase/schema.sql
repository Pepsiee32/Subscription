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
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

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
