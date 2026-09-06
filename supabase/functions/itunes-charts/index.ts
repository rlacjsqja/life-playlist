// 내 인생 플레이리스트 - 애플 뮤직 실시간 인기차트 프록시 (Supabase Edge Function)
// "새노래 탐색" 탭에서 씁니다.
// 참고: 예전에 쓰던 "장르별 차트 RSS"(itunes.apple.com/.../rss/topsongs/.../genre=.../json)는
// 애플이 더 이상 실제 데이터를 내려주지 않는 빈 껍데기만 남아있어서(2026-09 확인), 장르 구분 없이
// 애플의 공식 "국가별 실시간 Top 100" 차트(rss.marketingtools.apple.com)로 대체했습니다.
// 1) 실시간 Top 100 차트에서 곡 id 목록을 가져오고
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
    const pick = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pick") || "30", 10) || 30));
    const country = "kr";

    const chartUrl = `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/100/songs.json`;
    const chartRes = await fetch(chartUrl);
    if (!chartRes.ok) {
      return new Response(JSON.stringify({ success: false, results: [], error: "chart HTTP " + chartRes.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const chartData = await chartRes.json();
    const entries = Array.isArray(chartData.feed && chartData.feed.results) ? chartData.feed.results : [];
    const ids = entries.map((e: any) => e.id).filter(Boolean);

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
