-- 차 설명용 사진 (찻잎·탕색·엽저·포장·차밭 등): [{ "src": "...", "caption": "..." }]
alter table public.teas
  add column if not exists figures jsonb not null default '[]'::jsonb;
