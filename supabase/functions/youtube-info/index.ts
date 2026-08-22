// 내 인생 플레이리스트 - 유튜브 링크 정보 조회 프록시 (Supabase Edge Function)
// 영상을 다운로드하거나 음원을 추출하지 않고, 유튜브가 공식 제공하는 oEmbed 엔드포인트로
// 제목/채널명/썸네일만 가져옵니다(유튜브 이용약관 범위 안에서 임베드에 필요한 정보만 사용).
// 실제 재생은 index.html에서 유튜브 공식 임베드 플레이어(iframe)로 하고, 여기선 메타데이터만 줍니다.
// 예전 Code.gs의 youtubeInfo_ 함수와 동작이 동일합니다.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractYoutubeId(url: string): string {
  if (!url) return "";
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url") || "";
    const videoId = extractYoutubeId(targetUrl);

    if (!videoId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "유튜브 링크에서 영상 ID를 찾지 못했어요. 링크를 다시 확인해주세요.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const oembedUrl =
      "https://www.youtube.com/oembed?url=" +
      encodeURIComponent("https://www.youtube.com/watch?v=" + videoId) +
      "&format=json";
    const res = await fetch(oembedUrl);

    if (res.status !== 200) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "유튜브에서 영상 정보를 가져오지 못했어요 (비공개/삭제된 영상이거나 링크가 잘못됐을 수 있어요)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        title: data.title || "",
        channelTitle: data.author_name || "",
        thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
