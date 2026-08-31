-- 내 인생 플레이리스트 - Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run 하면 됩니다. (한 번만 실행하면 됨)

create extension if not exists pgcrypto;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  artist text not null default '',
  album text default '',
  release_date text default '',
  genre text default '',
  artwork_url text default '',
  apple_music_url text default '', -- Apple Music 또는 Spotify 등 외부 링크
  memo text default '',
  rating text default '',
  nationality text default '', -- 'domestic' | 'international'
  country text default '',     -- nationality가 international일 때만 의미 있음 (일본/미국/영국/중국/직접입력 등)
  preview_url text default '', -- 30초 미리듣기 mp3 URL
  youtube_url text default '', -- 유튜브 링크로 등록한 경우에만 값이 있음
  source text default '',      -- 'search' | 'manual' | 'youtube'
  match_dismissed text default '', -- 직접 입력한 곡의 "비슷한 음원 찾기" 제안을 이미 처리했으면 '1'
  added_at timestamptz not null default now()
);

create index if not exists songs_user_id_idx on public.songs(user_id);
create index if not exists songs_added_at_idx on public.songs(added_at desc);

-- Row Level Security: 자기 user_id 행만 보고/쓰고/지울 수 있게 강제.
-- 익명 로그인 사용자도 실제 auth.uid()를 가지므로 이 정책이 그대로 적용됩니다.
alter table public.songs enable row level security;

drop policy if exists "select own songs" on public.songs;
create policy "select own songs" on public.songs
  for select using (auth.uid() = user_id);

drop policy if exists "insert own songs" on public.songs;
create policy "insert own songs" on public.songs
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own songs" on public.songs;
create policy "update own songs" on public.songs
  for update using (auth.uid() = user_id);

drop policy if exists "delete own songs" on public.songs;
create policy "delete own songs" on public.songs
  for delete using (auth.uid() = user_id);

-- 플레이리스트: 저장한 곡들을 모아 담는 모음집
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists playlists_user_id_idx on public.playlists(user_id);

alter table public.playlists enable row level security;

drop policy if exists "select own playlists" on public.playlists;
create policy "select own playlists" on public.playlists
  for select using (auth.uid() = user_id);

drop policy if exists "insert own playlists" on public.playlists;
create policy "insert own playlists" on public.playlists
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own playlists" on public.playlists;
create policy "update own playlists" on public.playlists
  for update using (auth.uid() = user_id);

drop policy if exists "delete own playlists" on public.playlists;
create policy "delete own playlists" on public.playlists
  for delete using (auth.uid() = user_id);

-- 곡 하나가 여러 플레이리스트에 동시에 들어갈 수 있어서, 곡 쪽에 소속 플레이리스트 id 배열을 둠
-- (플레이리스트별 곡 목록 조회는 songs 테이블에서 이 배열에 해당 id가 포함된 행만 걸러서 봄)
alter table public.songs add column if not exists playlist_ids uuid[] not null default '{}';
create index if not exists songs_playlist_ids_idx on public.songs using gin(playlist_ids);
