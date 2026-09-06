// 내 인생 플레이리스트 - 애플 뮤직 실시간 인기차트 프록시 (Supabase Edge Function)
// "새노래 탐색" 탭에서 씁니다.
// 참고1: 예전에 쓰던 "장르별 차트 RSS"(itunes.apple.com/.../rss/topsongs/.../genre=.../json)는
// 애플이 더 이상 실제 데이터를 내려주지 않는 빈 껍데기만 남아있어서(2026-09 확인), 장르 구분 없이
// 애플의 공식 "국가별 실시간 Top 100" 차트(rss.marketingtools.apple.com)로 대체했습니다.
// 참고2: 검색 API의 genreIndex 속성으로 장르별 조회를 시도해봤지만 항상 결과 0건이라(genreIndex는
// song에는 지원 안 되는 것으로 보임) 사용하지 않았습니다. 대신 lookup 결과에 곡마다 이미 붙어있는
// primaryGenreName을 그대로 클라이언트에 넘겨서, 클라이언트가 "같은 장르/다른 장르"를 골라 보여줍니다.
// 1) 실시간 Top 100 차트에서 곡 id 목록(최대 100개)을 가져오고
// 2) 전부 lookup API로 상세 정보(미리듣기 링크, 장르 등)를 한 번에 조회해 그대로 돌려줍니다.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    // 장르별로 나눠서 보여주려면 일부만 뽑지 않고 차트 전체(최대 100곡)의 장르 정보가 다 있어야 해서,
    // 여기서는 자르지 않고 전부 lookup함 (한 번의 요청으로 최대 100개 id 조회 가능)
    const lookupUrl = `https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${country}`;
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
