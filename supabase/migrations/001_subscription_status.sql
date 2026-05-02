-- Estado explícito: active | cancelled | archived (compatible con filas sin columna).
alter table public.subscriptions
  add column if not exists status text;

update public.subscriptions
set status = case when active then 'active' else 'cancelled' end
where status is null;

alter table public.subscriptions
  alter column status set default 'active';

alter table public.subscriptions
  alter column status set not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check check (status in ('active', 'cancelled', 'archived'));
