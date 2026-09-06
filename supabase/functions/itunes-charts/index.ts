// 내 인생 플레이리스트 - 아이튠즈 "장르별 실시간 인기차트" 프록시 (Supabase Edge Function)
// "새노래 탐색" 탭에서 씁니다. 검색어를 흉내내는 방식이 아니라, 실제 아이튠즈 인기차트에서
// 곡을 가져오는 방식이라 "지금 진짜 인기 있는 곡"을 보여줄 수 있습니다.
// 1) 장르별 인기차트(RSS)에서 곡 id 목록을 가져오고
// 2) 그 중 일부를 무작위로 골라 lookup API로 상세 정보(미리듣기 링크 포함)를 한 번에 조회합니다.

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
    const genre = url.searchParams.get("genre") || "14"; // 기본값: 팝
    const pick = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pick") || "30", 10) || 30));
    const country = "kr";

    const feedUrl = `https://itunes.apple.com/${country}/rss/topsongs/limit=100/genre=${encodeURIComponent(genre)}/json`;
    const feedRes = await fetch(feedUrl);
    if (!feedRes.ok) {
      return new Response(JSON.stringify({ success: false, results: [], error: "chart HTTP " + feedRes.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const feedData = await feedRes.json();
    const entries = (feedData.feed && feedData.feed.entry) || [];
    const ids = entries
      .map((e: any) => e.id && e.id.attributes && e.id.attributes["im:id"])
      .filter(Boolean);

    if (!ids.length) {
      return new Response(JSON.stringify({ success: true, results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 차트 전체(최대 100곡)를 한 번에 다 보여주지 않고, 그 중 일부만 무작위로 골라서
    // 매번 다른 곡들이 보이게 함
    const shuffled = ids.sort(() => Math.random() - 0.5).slice(0, pick);
    const lookupUrl = `https://itunes.apple.com/lookup?id=${shuffled.join(",")}&country=${country}`;
    const lookupRes = await fetch(lookupUrl);
    const lookupData = await lookupRes.json();
    const results = (lookupData.results || []).filter((r: any) => r.wrapperType === "track" && r.kind === "song");

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, results: [], error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
