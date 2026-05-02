-- Ejecutá ESTE archivo en Supabase → SQL Editor si ves error de columnas faltantes en `subscriptions`.
-- Es seguro correrlo varias veces (usa IF NOT EXISTS / DROP IF EXISTS).

alter table public.subscriptions add column if not exists cancel_from date;
alter table public.subscriptions add column if not exists category text;
alter table public.subscriptions add column if not exists image_url text;
alter table public.subscriptions add column if not exists avatar_color text;

alter table public.subscriptions drop constraint if exists subscriptions_category_check;
alter table public.subscriptions add constraint subscriptions_category_check
  check (
    category is null
    or category in (
      'Entretenimiento',
      'Productividad',
      'Lifestyle',
      'Utilidad',
      'Finanzas',
      'Salud',
      'Gaming',
      'Otros'
    )
  );

-- Estado del ciclo de vida (activo / cancelado / archivado)
alter table public.subscriptions add column if not exists status text;

update public.subscriptions
set status = case when active then 'active' else 'cancelled' end
where status is null;

alter table public.subscriptions alter column status set default 'active';

-- Solo si ya no hay nulls
alter table public.subscriptions alter column status set not null;

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'cancelled', 'archived'));
