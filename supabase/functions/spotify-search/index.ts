// 내 인생 플레이리스트 - Spotify 검색 프록시 (Supabase Edge Function)
// Client Secret을 브라우저에 절대 노출하지 않기 위해, 여기 서버 쪽에서만 스포티파이 토큰을 발급/캐시하고
// 검색 결과만 정제해서 돌려줍니다. 예전 Code.gs의 spotifySearch_ 함수와 동작이 동일합니다.
// Client ID/Secret이 설정되어 있지 않으면 조용히 빈 목록을 반환합니다(스포티파이는 선택 사항).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

async function getSpotifyToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const authHeader = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) return null;

  cachedToken = data.access_token;
  cachedTokenExpiry = now + (Math.max(60, (data.expires_in || 3600) - 60)) * 1000;
  return cachedToken;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const term = url.searchParams.get("term") || "";
    if (!term) {
      return new Response(JSON.stringify({ success: true, items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getSpotifyToken();
    if (!token) {
      return new Response(
        JSON.stringify({ success: true, items: [], note: "spotify not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(
      "https://api.spotify.com/v1/search?type=track&market=KR&limit=15&q=" + encodeURIComponent(term),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    const tracks = (data.tracks && data.tracks.items) || [];
    const items = tracks.map((t: any) => {
      const album = t.album || {};
      const images = album.images || [];
      return {
        title: t.name || "",
        artist: (t.artists || []).map((a: any) => a.name).join(", "),
        album: album.name || "",
        releaseDate: album.release_date || "",
        albumType: album.album_type || "", // 'album' | 'single' | 'compilation'
        genre: "",
        artworkUrl: images.length ? images[0].url : "",
        externalUrl: (t.external_urls && t.external_urls.spotify) || "",
        previewUrl: t.preview_url || "", // 30초 미리듣기 mp3 (없는 곡도 있음)
      };
    });

    return new Response(JSON.stringify({ success: true, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: true, items: [], error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
