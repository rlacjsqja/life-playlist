# 업데이트할 때마다 해야 할 절차

이 앱은 두 군데에 나뉘어 있어요: **Code.gs**(Google Apps Script, 데이터 저장/로그인 검증 담당)와 **index.html**(Netlify에 올라간 화면). 어느 쪽이 바뀌었느냐에 따라 반영 절차가 달라요.

## Code.gs가 바뀐 경우 (백엔드 로직 변경)

1. 구글 시트 열기 → **확장 프로그램 → Apps Script**
2. 기존 코드 전체 삭제 → 새로 받은 `Code.gs` 내용 붙여넣기
3. 저장 (Ctrl+S 또는 디스크 아이콘)
4. **배포 → 배포 관리** 클릭
5. 기존 배포 항목의 **연필(수정) 아이콘** 클릭
6. **버전**을 "새 버전"으로 선택
7. **배포** 클릭

이렇게 하면 웹앱 URL이 그대로 유지돼서 index.html은 안 건드려도 돼요.

> ⚠️ "배포 관리"가 아니라 **"새 배포"**를 누르면 URL 자체가 바뀌어버려요. 그러면 index.html의 `CONFIG.WEBAPP_URL`도 새 주소로 다시 바꿔야 하니, 되도록 "배포 관리 → 새 버전"만 쓰세요.

## index.html이 바뀐 경우 (화면/기능 변경)

1. [app.netlify.com](https://app.netlify.com) 로그인 → `lifeplaylist` 사이트 클릭
2. **Deploys** 탭 클릭
3. 새 `index.html` 파일을 업로드 영역에 드래그 앤 드롭
4. 몇 초 기다리면 반영 완료
5. 브라우저에서 **강력 새로고침** (캐시 때문에 예전 화면이 계속 보일 수 있어요)
   - iPhone Safari: 새로고침 버튼 길게 눌러 "페이지 새로고침 요청"
   - Chrome: 설정에서 캐시 삭제 후 재접속, 또는 시크릿 모드로 확인

## 둘 다 바뀐 경우

순서는 상관없지만, 둘 다 최신 상태여야 정상 동작해요. Code.gs → index.html 순서로 하는 걸 추천해요 (백엔드가 먼저 준비되어 있어야 프런트에서 호출했을 때 에러가 안 나요).

## (참고) Spotify / Google 로그인 설정값은?

`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` / `GOOGLE_CLIENT_ID` 같은 설정값은 한번 넣어두면 계속 유지돼요. Code.gs를 새로 붙여넣어도 `setSpotifyCredentials` 함수를 다시 실행할 필요는 없어요(Script Properties에 이미 저장되어 있어서). 다만 `GOOGLE_CLIENT_ID`처럼 코드 안에 상수로 직접 박아둔 값은, Code.gs 전체를 새로 받으실 때 그 값이 빠져 있지 않은지 한 번 확인해주세요 (제가 파일 드릴 때는 항상 반영해서 드려요).

## 빠른 체크리스트

- [ ] Code.gs 바뀜? → Apps Script에 붙여넣기 → 저장 → **배포 관리 → 새 버전** → 배포
- [ ] index.html 바뀜? → Netlify **Deploys**에 드래그
- [ ] 강력 새로고침 후 실제로 눌러보며 테스트
