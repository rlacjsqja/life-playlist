# GitHub로 옮기기 - 설정 가이드

지금까지는 제가 index.html을 고칠 때마다 파일로 보내드리고, 그걸 Netlify Deploys 탭에 직접
드래그 앤 드롭하는 방식으로 배포해왔어요. 이 문서는 그 대신 GitHub 저장소를 하나 만들어서,
앞으로는 제가 코드를 고치면 자동으로 Netlify에 반영되게 만드는 절차예요.

채팅으로 요청하고 받는 방식은 지금과 완전히 똑같고, 딱 아래 5단계만 한 번 해두면 그 다음부터는
"Netlify에 재배포해주세요"라고 매번 말씀드릴 필요가 없어져요.

---

## 1. 빈 GitHub 저장소 만들기

1. https://github.com/new 접속
2. Repository name: 원하는 이름 (예: `life-playlist`)
3. **Public이든 Private이든 상관없어요** (Private 추천 — 어차피 앱 자체는 공개 배포되지만, 코드 저장소는
   비공개로 둬도 됨)
4. **"Add a README file", ".gitignore", "license" 는 전부 체크하지 말고 완전히 빈 저장소로 만들어주세요.**
   (제가 이미 만들어둔 파일들을 그대로 올릴 거라, 저장소에 뭔가 미리 들어있으면 충돌이 나요)
5. Create repository 누르면 나오는 저장소 주소를 복사해두세요.
   (`https://github.com/사용자명/저장소이름` 형태)

## 2. 제가 한 번 push할 수 있게 접근 권한(토큰) 만들어주기

저는 터미널이나 GitHub 계정에 직접 접속할 수 없어서, 딱 한 번 push할 때만 쓸 수 있는 임시 열쇠
(Personal Access Token)가 필요해요.

1. https://github.com/settings/personal-access-tokens/new 접속 (또는 프로필 사진 → Settings →
   왼쪽 메뉴 맨 아래 Developer settings → Personal access tokens → Fine-grained tokens →
   Generate new token)
2. **Token name**: 아무 이름 (예: `life-playlist-initial-push`)
3. **Expiration**: 7일 정도로 짧게 설정하세요 (한 번 쓰고 버릴 용도라 짧을수록 안전해요)
4. **Repository access**: "Only select repositories" 선택 → 방금 만든 저장소만 선택
5. **Permissions → Repository permissions**에서 **Contents**를 `Read and write`로 설정
6. Generate token 누르면 `github_pat_...`로 시작하는 토큰이 딱 한 번 보여져요. 이걸 복사해두세요
   (페이지를 벗어나면 다시 못 봐요, 그러면 새로 만들면 돼요)

## 3. 저장소 주소 + 토큰을 저한테 알려주기

채팅으로 아래 두 가지를 알려주세요.
- 저장소 주소 (1번에서 복사한 것)
- 토큰 (2번에서 복사한 `github_pat_...`)

받으면 제가 지금 가지고 있는 파일들(index.html, supabase-schema.sql, Edge Function 코드,
설정 가이드 등)을 그 저장소에 한 번에 올려드릴게요. **토큰은 이 push 한 번 끝나면 더 이상
필요 없으니, 다 되면 GitHub 설정에서 삭제(revoke)하시길 추천해요** (7일 뒤 어차피 자동 만료되지만,
미리 지워도 안전해요).

## 4. Netlify 사이트를 이 저장소에 연결하기

제가 push를 끝내면, 이제 Netlify 쪽에서 "이 저장소를 보고 있다가 바뀌면 자동 배포해줘"라고
연결해주셔야 해요 (이 부분은 Netlify 계정 로그인이 필요해서 직접 해주셔야 해요).

1. Netlify 대시보드 → 지금 쓰고 계신 사이트(lifeplaylist) 선택
2. **Site configuration → Build & deploy → Continuous deployment** 이동
   (또는 사이트 개요 화면에 보이는 "Install the Netlify GitHub App" 안내를 따라가도 돼요)
3. **Link repository** 선택 → GitHub 로그인/권한 승인 → 방금 만든 저장소 선택
   (저장소 목록에 안 보이면 "Configure Netlify on GitHub"에서 이 저장소에 접근 권한을 추가해주세요)
4. 연결되면 끝! 이제부터 이 저장소의 `main` 브랜치가 바뀔 때마다 Netlify가 자동으로 새로 빌드/배포해요.

## 5. 이후 작업 흐름

이 4단계까지 끝나면:
- 채팅으로 수정 요청 → 제가 코드 고치고 이 저장소에 커밋 + push
- Netlify가 자동으로 감지해서 몇 분 안에 사이트에 반영
- **더 이상 파일을 직접 다운로드해서 Netlify에 올리실 필요가 없어요**
- 그래도 DB 스키마(`supabase-schema.sql`)나 Edge Function 코드가 바뀌는 경우엔, 그 부분은
  여전히 Supabase 대시보드에서 직접 반영해주셔야 해요(이건 GitHub 연동과 무관한 부분이라
  자동화가 안 돼요) — 이 경우엔 지금처럼 제가 매번 안내해드릴게요.
