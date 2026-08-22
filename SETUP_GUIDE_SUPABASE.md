# Supabase로 이전하기 - 설정 가이드

이 문서는 "내 인생 플레이리스트"를 기존 Google Sheets/Apps Script 백엔드에서
Supabase로 옮기기 위해, **직접(Claude가 대신 할 수 없는) 해야 하는 작업**을 순서대로 정리한
것입니다. 여기 나온 값들을 알려주시면 제가 `index.html`에 반영해서 다시 전달할게요.

왜 옮기나요? Google Sheets/Apps Script는 동시 실행 제한이 있고 매 요청마다 시트 전체를
읽는 방식이라, 사용자가 몇 명만 늘어도 계속 느려집니다. Supabase는 실제 데이터베이스(Postgres)라
동시 접속자가 늘어나도 훨씬 여유롭게 버팁니다.

---

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 무료로 가입하고 새 프로젝트를 만드세요 (리전은 Northeast Asia(Seoul) 또는
   가까운 지역 추천). 데이터베이스 비밀번호는 아무거나 안전하게 설정하고 따로 보관해두세요(우리 코드에서는
   안 씀).
2. 프로젝트가 만들어지면 왼쪽 메뉴 **Project Settings → API**로 들어가서 아래 두 값을 확인하세요.
   - **Project URL** (예: `https://abcdefghijk.supabase.co`)
   - **anon public** 키 (긴 문자열, `eyJ...`로 시작함)
   - 이 두 값을 저에게 알려주시면 `index.html`의 `CONFIG.SUPABASE_URL` / `CONFIG.SUPABASE_ANON_KEY`에
     반영해서 다시 보내드릴게요. (이 anon 키는 공개돼도 안전한 값이에요 — 실제 접근 제어는 아래 4번의
     RLS 정책이 담당해요.)

## 2. 테이블 만들기 (SQL 실행)

1. 왼쪽 메뉴 **SQL Editor** → New query.
2. 같이 전달한 `supabase-schema.sql` 파일 내용을 통째로 붙여넣고 **Run**을 누르세요. (한 번만 하면 됨)
3. 이 SQL이 하는 일: `songs` 테이블 생성 + RLS(Row Level Security) 정책 설정. RLS 덕분에 각자
   자기가 등록한 곡만 보고 고칠 수 있고, 다른 사람 곡은 절대 못 봅니다 (예전엔 uid를 아는 사람이면
   누구나 접근 가능했는데, 이제 진짜 계정 기반 권한 제어가 됩니다).

## 3. 익명 로그인 켜기 + 계정 연결(linking) 켜기

같은 화면(**Authentication → Sign In / Providers**)에서 아래 두 개를 **둘 다** 켜주세요. 하나만 켜면
구글 로그인 시 "Manual linking is disabled" 에러가 납니다.

1. **Allow anonymous sign-ins** — 로그인 없이도 앱을 바로 쓸 수 있게 해줍니다 (예전의 "익명 uid"
   방식과 같은 역할을, 이번엔 진짜 Supabase 계정으로 처리하는 것뿐이에요).
2. **Allow manual linking** — 익명 세션에 나중에 구글 계정을 "연결(link)"할 수 있게 해주는
   설정입니다. 이게 꺼져 있으면 구글 로그인 버튼을 눌러도 "Manual linking is disabled"라는
   에러가 나면서 로그인이 시작조차 안 됩니다. 이 앱은 익명 세션 → 구글 계정 연결 흐름을 쓰기 때문에
   **필수**로 켜야 해요.

## 4. 구글 로그인 연결하기

기존에 만들어두신 Google Cloud OAuth 클라이언트를 그대로 재사용합니다 (Client ID:
`204989352633-rk4s2feef3mjgif4g2n2l44aqvrncrrc.apps.googleusercontent.com`). 다만 Supabase가
새로운 방식(웹 리디렉션)으로 로그인을 처리하기 때문에 설정을 조금 추가해야 해요.

1. **Supabase 대시보드 → Authentication → Providers → Google**을 켜고, 아래 두 값을 입력하세요.
   - Client ID: 기존 값 그대로
   - Client Secret: Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → 해당 OAuth 클라이언트
     클릭하면 확인/재발급할 수 있어요. (예전 GIS 방식은 Client Secret이 필요 없었는데, Supabase의
     리디렉션 방식은 필요합니다.)
   - 이 화면에 표시되는 **Callback URL(redirect URL)**을 복사해두세요
     (`https://<프로젝트-ref>.supabase.co/auth/v1/callback` 형태).
2. **Google Cloud Console → 사용자 인증 정보 → 해당 OAuth 클라이언트**로 가서
   "승인된 리디렉션 URI"에 위에서 복사한 Supabase Callback URL을 추가하고 저장하세요.
3. (참고) 오픈카톡방 등 인앱 브라우저에서는 구글이 정책적으로 로그인을 막습니다 — 이건 Supabase로
   옮겨도 동일한 구글 정책이라 어쩔 수 없어요. 최신 index.html에는 인앱 브라우저 감지 시
   "다른 브라우저로 열어달라"는 안내 배너가 이미 들어가 있어요.

## 4-1. 로그인 후 돌아올 주소 등록하기 (Redirect URL)

구글 로그인이 성공하면 Supabase가 사용자를 다시 우리 앱 주소로 돌려보내는데, 이 "돌아올 주소"는
Supabase가 미리 허용해둔 목록에 있는 주소로만 갈 수 있어요. 등록을 안 해두면 로그인은 성공하는데
엉뚱하게 `http://localhost:3000/#access_token=...` 같은, 존재하지 않는 개발용 기본 주소로
날아가버립니다 (로그인은 됐지만 화면이 그 주소로 이동해버려서 못 쓰는 상태가 됨).

1. **Supabase 대시보드 → Authentication → URL Configuration**으로 이동.
2. **Site URL**을 실제 배포된 주소로 바꾸세요. 예: `https://lifeplaylist.netlify.app`
   (지금 `localhost:3000`으로 되어 있는 게 기본값이라 이게 원인이었을 가능성이 높아요.)
3. **Redirect URLs** 목록에도 같은 주소를 추가하세요. 하위 경로까지 다 허용하려면
   `https://lifeplaylist.netlify.app/**` 처럼 끝에 `/**`를 붙여서 추가하면 안전해요.
4. 저장 후 다시 로그인 시도 — 이번엔 성공하면 원래 앱 주소로 돌아와야 정상이에요.

(실제 Netlify 주소가 위 예시와 다르면, 브라우저 주소창에 있는 정확한 그 주소로 등록해주세요.)

## 5. Spotify 검색 프록시 배포 (Edge Function)

같이 전달한 `supabase/functions/spotify-search/index.ts`, `supabase/functions/youtube-info/index.ts`
두 파일을 배포해야 검색/유튜브 등록 기능이 동작해요.

**Supabase CLI 사용 (권장)**
```
npm install -g supabase
supabase login
supabase link --project-ref <프로젝트-ref>
supabase functions deploy spotify-search
supabase functions deploy youtube-info
supabase secrets set SPOTIFY_CLIENT_ID=발급받은값 SPOTIFY_CLIENT_SECRET=발급받은값
```
Spotify Client ID/Secret은 이전과 동일하게 https://developer.spotify.com/dashboard 에서 무료로
발급받을 수 있어요. 설정 안 해도 앱은 동작하고(iTunes 검색만 씀), 나중에 추가해도 됩니다.

**CLI 없이 대시보드에서 하고 싶다면**: Supabase 대시보드 → **Edge Functions** → Create a function →
이름을 `spotify-search`로 하고 해당 코드 붙여넣기, 같은 방식으로 `youtube-info`도 생성. Secrets는
Edge Functions → Manage secrets 에서 추가.

## 6. 값 알려주시면 제가 반영할 것

아래 값들을 알려주시면 `index.html`의 `CONFIG`에 채워서 다시 전달할게요.
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

(Spotify Client ID/Secret, Google Client Secret은 Supabase 대시보드/CLI에만 입력하는 값이라 저한테
알려주실 필요는 없어요 — 브라우저 코드에는 들어가지 않습니다.)

## 7. 기존 Google Sheets 데이터는 어떻게 되나요

새 Supabase 백엔드는 완전히 새 데이터베이스라서, 지금 Google Sheet에 있는 기존 곡들은 자동으로
옮겨지지 않아요. 지금까지 등록된 곡 수가 많지 않다면 새로 등록하는 게 제일 간단하고, 만약 꼭
옮기고 싶으시면 알려주세요 — Google Sheet를 CSV로 내보낸 뒤 특정 계정으로 일괄 등록하는 마이그레이션
스크립트를 별도로 만들어드릴 수 있어요 (다만 예전에 uid로만 구분되던 익명 사용자 데이터라, "누구 것을
누구 계정에 넣을지"는 직접 정해주셔야 해요).

## 8. 다 끝나면

이제 Code.gs / Google Apps Script 배포는 더 이상 쓰지 않아요. 기존 Apps Script 프로젝트와
Google Sheet는 그대로 둬도 되고(문제 없음), 나중에 정리하고 싶으면 지우셔도 됩니다.
