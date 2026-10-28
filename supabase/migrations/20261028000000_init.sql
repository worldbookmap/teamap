-- 중국 차 지도: 차 테이블과 이미지 버킷
create extension if not exists pgcrypto;

create table if not exists public.teas (
  id uuid primary key default gen_random_uuid(),
  name_zh text not null default '',        -- 간체
  name_zh_trad text not null default '',   -- 번체
  name_ko text not null default '',        -- 한글 독음
  category text not null check (category in ('green', 'white', 'yellow', 'oolong', 'black', 'dark')),
  description text not null default '',
  images text[] not null default '{}',
  -- [{ adcode, path: [성, 시, 현], name_zh, name_ko, level }]
  origins jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teas_category_idx on public.teas (category);
create index if not exists teas_origins_idx on public.teas using gin (origins jsonb_path_ops);

-- 읽기는 누구나, 쓰기는 서버(service role)에서만
alter table public.teas enable row level security;
drop policy if exists "teas are readable by everyone" on public.teas;
create policy "teas are readable by everyone" on public.teas for select using (true);

-- 차 사진 공개 버킷
insert into storage.buckets (id, name, public)
values ('tea-images', 'tea-images', true)
on conflict (id) do nothing;
