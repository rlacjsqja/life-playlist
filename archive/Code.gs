/**
 * 내 인생 플레이리스트 - Google Apps Script 백엔드
 *
 * 이 코드는 구글 시트를 데이터베이스처럼 사용해서
 * index.html 앱이 어디서든(휴대폰, PC, 태블릿) 같은 목록을
 * 읽고 쓸 수 있게 해주는 API 역할을 합니다.
 *
 * v3부터는 uid(익명 기기 식별자) 기반으로 여러 사람이 같은 배포 주소를
 * 같이 써도 각자 자기 목록만 보고 편집하도록 되어 있습니다.
 * v4부터는 (선택) 구글 로그인도 지원해서, 로그인하면 익명 링크 없이도
 * 같은 구글 계정으로 어느 기기에서 접속하든 같은 목록을 볼 수 있습니다.
 * v5부터는 곡 수정(action=update)과 국내/해외 구분(nationality 컬럼)을 지원합니다.
 * v6부터는 30초 미리듣기(previewUrl 컬럼)를 지원합니다.
 * v7부터는 해외 곡의 국가 세부 구분(country 컬럼: 일본/미국/영국/중국/직접입력)을 지원합니다.
 * v8부터는 "이 기기의 곡을 로그인 계정으로 합치기"(action=claim)를 지원합니다.
 * (로그인 전/로그인 실패 상태로 추가된 곡이 기기에만 묶여 있을 때, 로그인 후 계정으로 옮길 수 있게 해줌)
 * v9부터는 유튜브 링크로 곡 등록을 지원합니다(action=youtubeInfo, youtubeUrl 컬럼).
 * 음원을 다운로드/추출하는 게 아니라, 유튜브가 공식 제공하는 oEmbed로 제목/채널명만 가져와서
 * 제목/아티스트 추천값으로 쓰고, 재생은 유튜브 공식 임베드 플레이어(iframe)를 그대로 씁니다.
 * v11부터는 직접 입력한 곡을 음원 사이트에서 자동으로 다시 찾아주는 기능을 지원합니다
 * (source, matchDismissed 컬럼). 직접 입력 저장 직후 클라이언트가 백그라운드에서 iTunes/Spotify를
 * 검색해서 비슷한 곡을 찾으면 사용자에게 "이 곡이 맞나요?" 확인을 받고, 맞다고 하면
 * action=update로 같은 행을 정식 음원 정보(앨범아트/링크/미리듣기 등)로 덮어씁니다.
 *
 * 설치 방법은 SETUP_GUIDE.md 를 참고하세요.
 */

const SHEET_NAME = 'Playlist';
const SPOTIFY_CLIENT_ID_PROP = 'SPOTIFY_CLIENT_ID';
const SPOTIFY_CLIENT_SECRET_PROP = 'SPOTIFY_CLIENT_SECRET';

// (선택) 구글 로그인용 OAuth 클라이언트 ID. index.html의 CONFIG.GOOGLE_CLIENT_ID와 반드시 같은 값이어야 합니다.
// 비밀값이 아니라 공개되어도 되는 값이라 여기 코드에 직접 넣습니다. 설정 안 하면 로그인 기능은 그냥 꺼진 채로 동작해요.
const GOOGLE_CLIENT_ID = '204989352633-rk4s2feef3mjgif4g2n2l44aqvrncrrc.apps.googleusercontent.com';

// 목록 조회(GET ?uid=...) / 스포티파이 검색 프록시(GET ?action=spotifySearch&term=...)
function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action;

  if (action === 'spotifySearch') {
    return spotifySearch_(params.term || '');
  }

  if (action === 'youtubeInfo') {
    return youtubeInfo_(params.url || '');
  }

  const sheet = getSheet_();
  const uid = resolveUid_(params);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1)
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    })
    .filter(function (obj) { return obj.id; }) // 빈 행 제거
    // uid가 전달되면 그 사람 것만, uid가 없으면(구버전 프런트 호환) 전체 반환
    .filter(function (obj) { return !uid || obj.uid === uid; })
    .reverse(); // 최근 추가한 곡이 위로

  return jsonResponse_({ success: true, items: rows });
}

/**
 * 스포티파이 검색 프록시.
 * Client Secret을 프런트엔드(index.html)에 절대 노출하지 않기 위해
 * Apps Script 서버 쪽에서만 스포티파이 토큰을 발급/캐시하고,
 * 검색 결과만 정제해서 index.html로 돌려줍니다.
 * Client ID/Secret이 설정되어 있지 않으면 조용히 빈 목록을 반환합니다
 * (스포티파이 연동은 선택 사항이라 iTunes 검색만으로도 앱은 정상 동작해요).
 */
function spotifySearch_(term) {
  if (!term) return jsonResponse_({ success: true, items: [] });

  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty(SPOTIFY_CLIENT_ID_PROP);
  const clientSecret = props.getProperty(SPOTIFY_CLIENT_SECRET_PROP);
  if (!clientId || !clientSecret) {
    return jsonResponse_({ success: true, items: [], note: 'spotify not configured' });
  }

  try {
    const token = getSpotifyToken_(clientId, clientSecret);
    const url = 'https://api.spotify.com/v1/search?type=track&market=KR&limit=15&q=' + encodeURIComponent(term);
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    const data = JSON.parse(res.getContentText());
    const tracks = (data.tracks && data.tracks.items) || [];
    const items = tracks.map(function (t) {
      const album = t.album || {};
      const images = album.images || [];
      return {
        title: t.name || '',
        artist: (t.artists || []).map(function (a) { return a.name; }).join(', '),
        album: album.name || '',
        releaseDate: album.release_date || '',
        albumType: album.album_type || '', // 'album' | 'single' | 'compilation'
        genre: '',
        artworkUrl: images.length ? images[0].url : '',
        externalUrl: (t.external_urls && t.external_urls.spotify) || '',
        previewUrl: t.preview_url || '' // 30초 미리듣기 mp3 (스포티파이가 제공 안 하는 곡도 있음)
      };
    });
    return jsonResponse_({ success: true, items: items });
  } catch (err) {
    return jsonResponse_({ success: true, items: [], error: String(err) });
  }
}

function getSpotifyToken_(clientId, clientSecret) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('spotify_token');
  if (cached) return cached;

  const authHeader = Utilities.base64Encode(clientId + ':' + clientSecret);
  const res = UrlFetchApp.fetch('https://accounts.spotify.com/api/token', {
    method: 'post',
    headers: { Authorization: 'Basic ' + authHeader },
    payload: { grant_type: 'client_credentials' },
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  if (!data.access_token) {
    throw new Error('스포티파이 토큰 발급 실패: ' + res.getContentText());
  }
  cache.put('spotify_token', data.access_token, Math.max(60, (data.expires_in || 3600) - 60));
  return data.access_token;
}

/**
 * 유튜브 링크로 곡을 등록할 때 쓰는 정보 조회.
 * 영상을 다운로드하거나 음원을 추출하지 않고, 유튜브가 공식 제공하는 oEmbed 엔드포인트로
 * 제목/채널명/썸네일만 가져옵니다(유튜브 이용약관 범위 안에서 임베드에 필요한 정보만 사용).
 * 실제 재생은 index.html에서 유튜브 공식 임베드 플레이어(iframe)로 하고, 여기선 메타데이터만 줍니다.
 */
function youtubeInfo_(url) {
  const videoId = extractYoutubeId_(url);
  if (!videoId) {
    return jsonResponse_({ success: false, error: '유튜브 링크에서 영상 ID를 찾지 못했어요. 링크를 다시 확인해주세요.' });
  }
  try {
    const oembedUrl = 'https://www.youtube.com/oembed?url='
      + encodeURIComponent('https://www.youtube.com/watch?v=' + videoId) + '&format=json';
    const res = UrlFetchApp.fetch(oembedUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      return jsonResponse_({ success: false, error: '유튜브에서 영상 정보를 가져오지 못했어요 (비공개/삭제된 영상이거나 링크가 잘못됐을 수 있어요)' });
    }
    const data = JSON.parse(res.getContentText());
    return jsonResponse_({
      success: true,
      videoId: videoId,
      title: data.title || '',
      channelTitle: data.author_name || '',
      thumbnailUrl: data.thumbnail_url || ('https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg')
    });
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

// 흔한 유튜브 링크 형태(watch?v=, youtu.be/, shorts/, embed/)에서 11자리 영상 ID를 추출
function extractYoutubeId_(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

/**
 * 스포티파이 연동을 쓰고 싶다면 딱 한 번만 하면 되는 설정입니다.
 * 1) https://developer.spotify.com/dashboard 에서 앱을 하나 만들고
 *    Client ID / Client Secret을 발급받으세요 (무료).
 * 2) 아래 두 줄의 'YOUR_SPOTIFY_CLIENT_ID' / 'YOUR_SPOTIFY_CLIENT_SECRET' 자리에
 *    발급받은 값을 붙여넣으세요.
 * 3) Apps Script 화면 상단에서 이 함수(setSpotifyCredentials)를 선택하고 ▶ 실행 버튼을 누르세요.
 *    (최초 1회만 실행하면 되고, 이후엔 실행할 필요 없습니다)
 * 4) 실행 후에는 보안을 위해 아래 두 줄의 값을 다시 지우거나 'YOUR_...' 로 되돌려도 됩니다.
 *    (이미 Script Properties에 안전하게 저장되어 있어서 상관없어요)
 */
function setSpotifyCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(SPOTIFY_CLIENT_ID_PROP, 'YOUR_SPOTIFY_CLIENT_ID');
  props.setProperty(SPOTIFY_CLIENT_SECRET_PROP, 'YOUR_SPOTIFY_CLIENT_SECRET');
}

/**
 * 구글 ID 토큰(로그인 시 프런트엔드가 보내는 JWT)을 구글의 tokeninfo 엔드포인트로 검증합니다.
 * 서명 검증을 직접 구현하지 않고 구글이 검증해준 결과를 그대로 신뢰하는 방식이라
 * Apps Script처럼 가벼운 백엔드에서도 안전하게 쓸 수 있어요.
 * - aud(발급 대상)가 우리 GOOGLE_CLIENT_ID와 다르면 다른 앱용 토큰이므로 거부합니다.
 * - 로그인 기능을 설정하지 않았거나(placeholder 그대로) 토큰이 없으면 null을 반환합니다.
 */
function verifyGoogleIdToken_(idToken) {
  return verifyGoogleIdTokenDetailed_(idToken).verified;
}

// verifyGoogleIdToken_과 로직은 같지만, 실패 이유를 함께 돌려줌(디버깅용).
// action=claim처럼 실패 이유를 사용자에게 보여줘야 하는 곳에서 씀.
function verifyGoogleIdTokenDetailed_(idToken) {
  if (!idToken) return { verified: null, reason: '로그인 토큰이 서버로 전달되지 않았어요 (프런트엔드가 로그인 상태를 못 읽은 것으로 보여요)' };
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.indexOf('YOUR_GOOGLE_CLIENT_ID') === 0) {
    return { verified: null, reason: 'Code.gs에 GOOGLE_CLIENT_ID가 설정되어 있지 않아요' };
  }
  try {
    const res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) {
      return { verified: null, reason: '토큰이 만료됐거나 유효하지 않아요 (구글 응답 코드 ' + res.getResponseCode() + ')' };
    }
    const data = JSON.parse(res.getContentText());
    if (!data.sub || !data.email) {
      return { verified: null, reason: '구글이 돌려준 토큰 정보가 올바르지 않아요' };
    }
    if (data.aud !== GOOGLE_CLIENT_ID) {
      // 프런트엔드(index.html의 CONFIG.GOOGLE_CLIENT_ID)와 백엔드(Code.gs의 GOOGLE_CLIENT_ID)가 서로 다른 값일 때 발생.
      // aud 값을 그대로 보여줘서, 어떤 클라이언트 ID로 로그인됐는지 비교해볼 수 있게 함.
      return { verified: null, reason: '이 토큰은 다른 클라이언트 ID로 발급됐어요 (받은 aud: ' + data.aud + ' / 서버 GOOGLE_CLIENT_ID: ' + GOOGLE_CLIENT_ID + ')' };
    }
    return { verified: { sub: data.sub, email: data.email, name: data.name || '' }, reason: '' };
  } catch (err) {
    return { verified: null, reason: '검증 중 오류: ' + String(err) };
  }
}

// idToken이 있고 유효하면 구글 계정 기준 uid('google:'+sub)를 우선 사용하고,
// 없거나 무효하면 클라이언트가 보낸 익명 uid를 그대로 씁니다(로그인 안 한 사람용, 기존 방식 호환).
function resolveUid_(params) {
  const verified = verifyGoogleIdToken_(params.idToken);
  if (verified) return 'google:' + verified.sub;
  return params.uid || '';
}

// 추가/삭제 (POST)
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheet = getSheet_();
    const uid = resolveUid_(body);

    if (action === 'add') {
      const id = Utilities.getUuid();
      appendRowByHeaders_(sheet, {
        id: id,
        uid: uid,
        title: body.title || '',
        artist: body.artist || '',
        album: body.album || '',
        releaseDate: body.releaseDate || '',
        genre: body.genre || '',
        artworkUrl: body.artworkUrl || '',
        appleMusicUrl: body.appleMusicUrl || '', // Apple Music 또는 Spotify 등 외부 링크 (컬럼명은 이전 버전과의 호환을 위해 유지)
        memo: body.memo || '',
        rating: body.rating || '',
        nationality: body.nationality || '', // 'domestic' | 'international'
        country: body.country || '', // nationality가 international일 때만 의미 있음 (예: '일본', '미국', 직접입력 문자열 등)
        previewUrl: body.previewUrl || '', // 30초 미리듣기 mp3 URL (없을 수 있음)
        youtubeUrl: body.youtubeUrl || '', // 검색 결과에 없는 곡을 유튜브 링크로 등록했을 때만 값이 있음
        source: body.source || '', // 'search'(검색 결과 선택) | 'manual'(직접 입력) | 'youtube'(유튜브 링크로 등록)
        matchDismissed: body.matchDismissed || '', // 직접 입력한 곡의 "비슷한 음원 찾기" 제안을 이미 처리했으면 '1'
        addedAt: new Date().toISOString()
      });
      return jsonResponse_({ success: true, id: id });
    }

    if (action === 'update') {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('id');
      const uidIdx = headers.indexOf('uid');
      // 수정 가능한 필드 목록. id/uid/addedAt은 수정 대상에서 제외.
      const editableFields = ['title', 'artist', 'album', 'releaseDate', 'genre', 'artworkUrl', 'appleMusicUrl', 'memo', 'rating', 'nationality', 'country', 'previewUrl', 'youtubeUrl', 'source', 'matchDismissed'];
      for (let i = 1; i < data.length; i++) {
        const rowId = data[i][idIdx];
        const rowUid = uidIdx > -1 ? data[i][uidIdx] : '';
        if (rowId === body.id && (!uid || !rowUid || rowUid === uid)) {
          const rowNum = i + 1;
          editableFields.forEach(function (field) {
            if (!Object.prototype.hasOwnProperty.call(body, field)) return;
            const colIdx = headers.indexOf(field);
            if (colIdx > -1) sheet.getRange(rowNum, colIdx + 1).setValue(body[field]);
          });
          return jsonResponse_({ success: true });
        }
      }
      return jsonResponse_({ success: false, error: '수정할 곡을 찾지 못했어요' });
    }

    // 이 기기(브라우저)의 익명 uid로 저장돼 있던 곡들을, 지금 로그인한 구글 계정 uid로 옮겨줌.
    // 예) 로그인 안 한 상태로(혹은 구버전 OAuth 설정으로 로그인이 실패한 채) 곡을 추가한 뒤,
    //     나중에 로그인을 해도 그 곡들은 계속 "이 기기"에만 보이는 문제를 사용자가 직접 해결할 수 있게 해줌.
    if (action === 'claim') {
      const anonUid = body.uid || ''; // 합칠 대상(이 기기의 익명 uid). postToSheet가 항상 MY_UID를 담아 보냄.
      const detail = verifyGoogleIdTokenDetailed_(body.idToken);
      const verified = detail.verified;
      if (!verified) {
        return jsonResponse_({ success: false, error: '로그인한 상태에서만 합칠 수 있어요 (' + detail.reason + ')' });
      }
      const targetUid = 'google:' + verified.sub;
      if (!anonUid || anonUid === targetUid) {
        return jsonResponse_({ success: true, merged: 0 });
      }
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const uidIdx = headers.indexOf('uid');
      let merged = 0;
      if (uidIdx > -1) {
        for (let i = 1; i < data.length; i++) {
          if (data[i][uidIdx] === anonUid) {
            sheet.getRange(i + 1, uidIdx + 1).setValue(targetUid);
            merged++;
          }
        }
      }
      return jsonResponse_({ success: true, merged: merged });
    }

    if (action === 'delete') {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('id');
      const uidIdx = headers.indexOf('uid');
      for (let i = 1; i < data.length; i++) {
        const rowId = data[i][idIdx];
        const rowUid = uidIdx > -1 ? data[i][uidIdx] : '';
        // uid가 없는(구버전) 행이거나, 요청자 uid와 일치할 때만 삭제 허용
        if (rowId === body.id && (!uid || !rowUid || rowUid === uid)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return jsonResponse_({ success: true });
    }

    return jsonResponse_({ success: false, error: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

// 시트의 실제 헤더 순서에 맞춰 값을 채워 넣기 때문에, 나중에 컬럼이 추가/이동되어도 안전합니다.
function appendRowByHeaders_(sheet, valuesObj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(valuesObj, h) ? valuesObj[h] : '';
  });
  sheet.appendRow(row);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'id', 'uid', 'title', 'artist', 'album', 'releaseDate', 'genre',
      'artworkUrl', 'appleMusicUrl', 'memo', 'rating', 'nationality', 'country', 'previewUrl', 'youtubeUrl',
      'source', 'matchDismissed', 'addedAt'
    ]);
  }
  ensureColumns_(sheet, ['uid', 'nationality', 'country', 'previewUrl', 'youtubeUrl', 'source', 'matchDismissed']);
  return sheet;
}

// 이전 버전에서 만들어진 시트에는 새로 추가된 컬럼(uid, nationality 등)이 없을 수 있어서,
// 없으면 시트 맨 뒤에 자동으로 추가해줍니다. appendRowByHeaders_/update가 헤더 기준으로 동작하므로 순서는 상관없어요.
function ensureColumns_(sheet, columnNames) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  columnNames.forEach(function (name) {
    if (headers.indexOf(name) === -1) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(name);
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }
  });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
