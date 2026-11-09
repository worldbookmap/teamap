-- 티끌 모임 기록 (정기모임 · 벙개모임)
create table if not exists public.gatherings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'regular' check (kind in ('regular', 'casual')),
  held_on date not null default current_date,
  time text not null default '',     -- HH:MM (선택)
  title text not null default '',
  place text not null default '',
  photos text[] not null default '{}',
  teas jsonb not null default '[]',  -- [{ tea_id, name }] 등록된 차와 연결
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gatherings_held_on_idx on public.gatherings (held_on desc);

alter table public.gatherings enable row level security;
drop policy if exists "gatherings are readable by everyone" on public.gatherings;
create policy "gatherings are readable by everyone" on public.gatherings for select using (true);
