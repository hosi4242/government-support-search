// Cloudflare Pages Function: secure proxy for the public-data API.
// Configure SUPPORT_API_ENDPOINT as the exact operation URL from the data.go.kr API guide.
// Store the issued key in DATA_GO_KR_SERVICE_KEY (encrypted Secret), never in browser code.
export async function onRequestGet({ request, env }) {
  const cors = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=900",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": new URL(request.url).origin,
    "Vary": "Origin"
  };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

  if (!env.SUPPORT_API_ENDPOINT || !env.DATA_GO_KR_SERVICE_KEY) {
    return json({
      success: false,
      code: "API_NOT_CONFIGURED",
      message: "공공데이터 API 설정이 아직 완료되지 않았습니다. 운영자가 Cloudflare 환경 변수와 Secret을 설정해야 합니다.",
      items: []
    }, 503);
  }

  let upstream;
  try {
    upstream = new URL(env.SUPPORT_API_ENDPOINT);
    if (upstream.protocol !== "https:") {
      return json({ success: false, code: "INVALID_ENDPOINT", message: "API 주소는 HTTPS여야 합니다.", items: [] }, 500);
    }
  } catch {
    return json({ success: false, code: "INVALID_ENDPOINT", message: "SUPPORT_API_ENDPOINT 설정을 확인해 주세요.", items: [] }, 500);
  }

  const params = upstream.searchParams;
  params.set(env.SUPPORT_API_KEY_PARAM || "serviceKey", env.DATA_GO_KR_SERVICE_KEY);
  params.set(env.SUPPORT_API_FORMAT_PARAM || "_type", "json");
  params.set(env.SUPPORT_API_PAGE_PARAM || "pageNo", "1");
  params.set(env.SUPPORT_API_SIZE_PARAM || "numOfRows", "100");

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    const raw = await upstreamResponse.text();
    if (!upstreamResponse.ok) {
      return json({ success: false, code: "UPSTREAM_HTTP_ERROR", message: "공공데이터 API 응답 오류가 발생했습니다. API 승인 상태와 호출 주소를 확인해 주세요.", items: [] }, 502);
    }

    let payload;
    try { payload = JSON.parse(raw); }
    catch {
      return json({ success: false, code: "NON_JSON_RESPONSE", message: "API가 JSON이 아닌 응답을 반환했습니다. Cloudflare의 SUPPORT_API_FORMAT_PARAM 설정과 API 명세를 확인해 주세요.", items: [] }, 502);
    }

    const statusCode = String(
      payload?.response?.header?.resultCode ??
      payload?.response?.header?.resultMsg ??
      payload?.header?.resultCode ??
      payload?.resultCode ?? ""
    );
    const errorLike = /^(?!00$|0$)(\d{2})$/.test(statusCode) &&
      !/SUCCESS|NORMAL/i.test(String(payload?.response?.header?.resultMsg ?? payload?.header?.resultMsg ?? ""));
    if (errorLike || payload?.error || payload?.errors) {
      return json({ success: false, code: "API_PROVIDER_ERROR", message: "공공데이터 제공기관에서 오류를 반환했습니다. 인증키·활용 승인·요청 변수 설정을 확인해 주세요.", items: [] }, 502);
    }

    const candidates = [
      payload?.response?.body?.items?.item,
      payload?.response?.body?.items,
      payload?.body?.items?.item,
      payload?.body?.items,
      payload?.items?.item,
      payload?.items,
      payload?.data?.items,
      payload?.data,
      payload?.result?.items,
      payload?.results
    ];
    let rows = candidates.find(Array.isArray);
    if (!rows) {
      const single = candidates.find(v => v && typeof v === "object" && !Array.isArray(v));
      rows = single ? [single] : [];
    }
    if (!Array.isArray(rows)) rows = [];

    const pick = (obj, names, fallback = "") => {
      for (const name of names) {
        const value = obj?.[name];
        if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
      }
      return fallback;
    };
    const inferCategory = (text) => {
      if (/창업|창업기업|예비창업/i.test(text)) return "창업";
      if (/고용|채용|인력|근로자/i.test(text)) return "고용";
      if (/교육|컨설팅|멘토링|역량/i.test(text)) return "교육";
      if (/판로|수출|마케팅|온라인몰/i.test(text)) return "판로";
      if (/기술|디지털|스마트|연구개발|R&D/i.test(text)) return "기술";
      return "경영";
    };
    const inferRegion = (text) => {
      const regions = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
      const match = regions.find(region => text.includes(region));
      return match || "전국";
    };
    const items = rows.map((row, index) => {
      const title = pick(row, ["pblancNm","bizNm","title","announcementTitle","공고명","nttSj","bizTitle","사업명","사업공고명"], "제목 확인 필요");
      const summary = pick(row, ["bsnsSumryCn","bizSumry","summary","사업개요내용","description","content","pblancCn","공고내용"], "상세 내용은 공식 공고문에서 확인해 주세요.");
      const target = pick(row, ["suptTrgt","suptTrgtNm","target","지원대상","지원 대상","trgt","trgetNm","지원대상내용"], "공고 원문 확인");
      const agency = pick(row, ["suptInstNm","excInstNm","agency","기관명","organNm","pblancInstNm","소관명","수행기관명","주관기관"], "공고 원문 확인");
      const period = pick(row, ["reqstBeginEndDe","reqstPeriod","applicationPeriod","신청기간","period","reqstDe","신청기간내용"], "");
      const begin = pick(row, ["reqstBeginDe","startDate","applicationStart","신청시작일"], "");
      const end = pick(row, ["reqstEndDe","endDate","applicationEnd","신청종료일"], "");
      const finalPeriod = period || (begin || end ? [begin, end].filter(Boolean).join(" ~ ") : "공고 원문 확인");
      const url = pick(row, ["pblancUrl","bizInfoUrl","url","detailUrl","공고URL","pblancLink","dtlUrl","사업신청URL","bizUrl","link"], "");
      const id = pick(row, ["pblancId","bizId","id","공고ID","seq","nttId"], String(index + 1));
      const combined = [title, summary, target, agency, pick(row, ["hashTag","hashtag","해시태그"], "")].join(" ");
      const tag = pick(row, ["hashTag","hashtag","해시태그","분야","category"], "");
      return {
        id,
        title,
        summary,
        target,
        agency,
        period: finalPeriod,
        url: /^https?:\/\//i.test(url) ? url : "",
        category: inferCategory(tag + " " + combined),
        region: inferRegion(combined),
        scope: /소상공인|자영업|소기업/i.test(combined) ? "small" : "all",
        updatedAt: pick(row, ["lastMdfcnDt","modDate","updateDate","수정일자","등록일자","regDate"], "")
      };
    }).filter(item => item.title !== "제목 확인 필요");

    return json({
      success: true,
      items,
      count: items.length,
      fetchedAt: new Date().toISOString(),
      source: "중소벤처기업부·기업마당 지원사업 공고 API"
    });
  } catch {
    return json({ success: false, code: "FETCH_FAILED", message: "공공데이터 API에 연결하지 못했습니다. API 주소와 Cloudflare 설정을 확인해 주세요.", items: [] }, 502);
  }
}
