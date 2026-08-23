// 내 인생 플레이리스트 - 유튜브(뮤직) 검색 프록시 (Supabase Edge Function)
// API 키를 브라우저에 노출하지 않기 위해 서버 쪽에서만 YouTube Data API를 호출하고,
// 검색 결과만 정제해서 돌려줍니다. YOUTUBE_API_KEY가 설정되어 있지 않으면 빈 목록을 반환합니다.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const term = url.searchParams.get("term") || "";
    const limit = url.searchParams.get("limit") || "15";
    if (!term) {
      return new Response(JSON.stringify({ success: true, items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: true, items: [], note: "youtube not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", term);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoCategoryId", "10"); // 10 = Music
    searchUrl.searchParams.set("maxResults", limit);
    searchUrl.searchParams.set("key", apiKey);

    const res = await fetch(searchUrl.toString());
    const data = await res.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ success: false, items: [], error: data.error.message || "youtube api error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const items = (data.items || [])
      .filter((it: any) => it.id && it.id.videoId)
      .map((it: any) => {
        const s = it.snippet || {};
        const thumb = s.thumbnails || {};
        return {
          videoId: it.id.videoId,
          title: s.title || "",
          channelTitle: s.channelTitle || "",
          publishedAt: s.publishedAt ? s.publishedAt.slice(0, 10) : "",
          artworkUrl: (thumb.high && thumb.high.url) || (thumb.default && thumb.default.url) || "",
          externalUrl: "https://www.youtube.com/watch?v=" + it.id.videoId,
        };
      });

    return new Response(JSON.stringify({ success: true, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, items: [], error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
