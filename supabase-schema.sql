-- 1453 Party House Supabase setup
-- Supabase Dashboard > SQL Editor içinde tamamını çalıştırın.
-- Tarayıcı uygulamasında yalnızca Project URL ve anon public key kullanılmalı.

create table if not exists public.reservations (
  id text primary key,
  date date not null,
  slot text not null check (slot in ('day', 'night')),
  event_type text not null,
  customer_name text not null,
  phone text default '',
  guest_count integer not null check (guest_count > 0),
  catering text not null,
  amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  notes text default '',
  created_by text default '',
  created_by_name text default '',
  updated_at timestamptz not null default now(),
  constraint reservations_paid_amount_check check (paid_amount >= 0),
  constraint reservations_amount_check check (amount >= 0)
);

create unique index if not exists reservations_date_slot_idx
  on public.reservations (date, slot);

create table if not exists public.prices (
  id text primary key,
  event_type text not null,
  guest_count integer not null check (guest_count > 0),
  catering text not null,
  amount numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  constraint prices_amount_check check (amount >= 0)
);

alter table public.reservations enable row level security;
alter table public.prices enable row level security;

drop policy if exists "Reservations select for authenticated" on public.reservations;
drop policy if exists "Reservations insert for authenticated" on public.reservations;
drop policy if exists "Reservations update for authenticated" on public.reservations;
drop policy if exists "Reservations delete for authenticated" on public.reservations;

create policy "Reservations select for authenticated"
  on public.reservations for select
  to authenticated
  using ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));

create policy "Reservations insert for authenticated"
  on public.reservations for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));

create policy "Reservations update for authenticated"
  on public.reservations for update
  to authenticated
  using ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ))
  with check ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));

create policy "Reservations delete for authenticated"
  on public.reservations for delete
  to authenticated
  using ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));

drop policy if exists "Prices select for authenticated" on public.prices;
drop policy if exists "Prices insert for authenticated" on public.prices;
drop policy if exists "Prices update for authenticated" on public.prices;
drop policy if exists "Prices delete for authenticated" on public.prices;

create policy "Prices select for authenticated"
  on public.prices for select
  to authenticated
  using ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));

create policy "Prices insert for authenticated"
  on public.prices for insert
  to authenticated
  with check ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));

create policy "Prices update for authenticated"
  on public.prices for update
  to authenticated
  using ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ))
  with check ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));

create policy "Prices delete for authenticated"
  on public.prices for delete
  to authenticated
  using ((auth.jwt() ->> 'email') in (
    'sule@1453partyhouse.com',
    'mustafa@1453partyhouse.com',
    'yahya@1453partyhouse.com',
    'gamze@1453partyhouse.com'
  ));
