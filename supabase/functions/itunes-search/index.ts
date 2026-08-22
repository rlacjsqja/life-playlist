// 내 인생 플레이리스트 - iTunes 검색 프록시 (Supabase Edge Function)
// 일부 통신사/공유기 네트워크에서 itunes.apple.com으로 브라우저가 직접 접속하는 게
// 막혀 있는 경우가 있어서, 스포티파이처럼 Supabase 서버를 거쳐서 대신 조회합니다.

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
    const attribute = url.searchParams.get("attribute") || "";
    const limit = url.searchParams.get("limit") || "15";
    if (!term) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itunesUrl = new URL("https://itunes.apple.com/search");
    itunesUrl.searchParams.set("media", "music");
    itunesUrl.searchParams.set("entity", "song");
    itunesUrl.searchParams.set("limit", limit);
    itunesUrl.searchParams.set("country", "KR");
    itunesUrl.searchParams.set("lang", "ko_kr");
    itunesUrl.searchParams.set("term", term);
    if (attribute) itunesUrl.searchParams.set("attribute", attribute);

    const res = await fetch(itunesUrl.toString());
    const data = await res.json();

    return new Response(JSON.stringify({ success: true, results: data.results || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, results: [], error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
