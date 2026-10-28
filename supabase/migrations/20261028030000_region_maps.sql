-- 지역별 참고 지도 (차산 지도, 옛 지도, 외부 지도 링크 등)
create table if not exists public.region_maps (
  id uuid primary key default gen_random_uuid(),
  adcode text not null,               -- 성·시·현 행정 코드
  title text not null default '',
  description text not null default '',  -- 설명·출처
  images text[] not null default '{}',
  link text not null default '',      -- 외부 지도 주소
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists region_maps_adcode_idx on public.region_maps (adcode);

alter table public.region_maps enable row level security;
drop policy if exists "region maps are readable by everyone" on public.region_maps;
create policy "region maps are readable by everyone" on public.region_maps for select using (true);
