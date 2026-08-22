# 내 인생 플레이리스트

내가 좋아하는 곡을 검색해서 등록하고, 아카이브할 수 있는 개인용/공유용 음악 플레이리스트 웹앱입니다.

## 배포 구조

- **프런트엔드**: 단일 `index.html` (바닐라 JS + Supabase JS SDK). 파일명은 반드시 `index.html`이어야 합니다.
- **호스팅**: [Netlify](https://lifeplaylist.netlify.app) — 이 저장소와 연결되면 `main` 브랜치에 push할 때마다 자동으로 재배포됩니다.
- **백엔드**: [Supabase](https://supabase.com) — Postgres DB(Row Level Security 적용) + Auth(익명 로그인 + 구글 계정 연결) + Edge Functions.

## 폴더 구조

```
index.html                          - 앱 전체 (프런트엔드 전부)
supabase-schema.sql                  - Supabase DB 스키마 (최초 1회만 SQL Editor에서 실행)
supabase/functions/spotify-search/   - 스포티파이 검색 프록시 Edge Function
supabase/functions/youtube-info/     - 유튜브 링크 정보 조회 프록시 Edge Function
SETUP_GUIDE_SUPABASE.md              - Supabase 최초 설정 가이드
archive/                             - 예전 Google Sheets/Apps Script 버전 (더 이상 안 씀, 참고용)
```

## 개발/배포 흐름

이 저장소가 Netlify와 연결된 이후로는:

1. `index.html` 등 코드가 바뀌면 `main` 브랜치에 커밋 + push
2. Netlify가 자동으로 감지해서 재배포 (수동 업로드 불필요)
3. DB 스키마가 바뀌면 `supabase-schema.sql`을 Supabase 대시보드 SQL Editor에서 직접 실행해야 함(자동 반영 안 됨)
4. Edge Function 코드가 바뀌면 Supabase 대시보드에서 해당 함수를 다시 배포해야 함(자동 반영 안 됨)
