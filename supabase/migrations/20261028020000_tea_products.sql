-- 차의 하위 제품 (예: 普洱茶 → 大益 7542, 7572 …)
alter table public.teas
  add column if not exists parent_id uuid references public.teas (id) on delete cascade,
  add column if not exists maker text not null default '';  -- 제조사·차창 (勐海茶厂 등)

create index if not exists teas_parent_idx on public.teas (parent_id);
