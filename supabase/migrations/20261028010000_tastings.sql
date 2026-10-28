-- 내가 마신 기록(시음 노트)
create table if not exists public.tastings (
  id uuid primary key default gen_random_uuid(),
  tea_id uuid not null references public.teas (id) on delete cascade,
  tasted_on date not null default current_date,
  rating numeric(2, 1) check (rating is null or (rating >= 0.5 and rating <= 5)),
  price integer check (price is null or price >= 0),  -- 원
  amount text not null default '',   -- 가격 기준 양 (50g 등)
  shop text not null default '',     -- 구매처
  vintage text not null default '',  -- 생산 연도·시기
  brewing text not null default '',  -- 우림 정보
  aroma text not null default '',
  taste text not null default '',
  note text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tastings_tea_idx on public.tastings (tea_id, tasted_on desc);

alter table public.tastings enable row level security;
drop policy if exists "tastings are readable by everyone" on public.tastings;
create policy "tastings are readable by everyone" on public.tastings for select using (true);
