-- thetea.app 백과사전 글 연결
-- null: 차 이름으로 자동 연결 · '': 연결하지 않음 · 그 밖: 직접 고른 글 주소 (예: xihu-longjing)
alter table public.teas
  add column if not exists thetea_slug text;
