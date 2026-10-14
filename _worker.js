/**
 * Cloudflare Workers Static Assets entry point.
 * API credentials remain server-side in the DATA_GO_KR_SERVICE_KEY secret.
 */
const API_ENDPOINT = "https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "Vary": "Origin"
    }
  });
}

function serviceKeyValue(value) {
  // Cloudflare secrets are safest when stored as the decoded/original key.
  // Also tolerate a URL-encoded key if one was stored previously.
  if (/%[0-9a-f]{2}/i.test(value)) {
    try { return decodeURIComponent(value); } catch (_) {}
  }
  return value;
}

function firstValue(obj, names, fallback = "") {
  for (const name of names) {
    const value = obj?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function normalizeRows(payload) {
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
  const rows = candidates.find(Array.isArray);
  if (rows) return rows;
  const one = candidates.find(value => value && typeof value === "object" && !Array.isArray(value));
  return one ? [one] : [];
}

function categoryFor(text) {
  if (/창업|예비창업|창업기업/.test(text)) return "창업";
  if (/고용|채용|인력|근로자/.test(text)) return "고용";
  if (/교육|컨설팅|멘토링|역량/.test(text)) return "교육";
  if (/판로|수출|마케팅|온라인몰/.test(text)) return "판로";
  if (/기술|디지털|스마트|연구개발|R&D/i.test(text)) return "기술";
  return "경영";
}

function regionFor(text) {
  const regions = ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
  return regions.find(region => text.includes(region)) || "전국";
}

async function supports(request, env) {
  if (request.method !== "GET") {
    return json({ success: false, code: "METHOD_NOT_ALLOWED", message: "GET 요청만 지원합니다.", items: [] }, 405);
  }
  if (!env.DATA_GO_KR_SERVICE_KEY) {
    return json({ success: false, code: "API_NOT_CONFIGURED", message: "API 인증키 설정을 확인해 주세요. 운영자는 Cloudflare Secret DATA_GO_KR_SERVICE_KEY를 확인해야 합니다.", items: [] }, 503);
  }

  const incoming = new URL(request.url);
  const pageNo = Math.min(100, Math.max(1, Number.parseInt(incoming.searchParams.get("pageNo") || "1", 10) || 1));
  const numOfRows = Math.min(100, Math.max(1, Number.parseInt(incoming.searchParams.get("numOfRows") || "100", 10) || 100));
  const upstream = new URL(API_ENDPOINT);
  upstream.searchParams.set("serviceKey", serviceKeyValue(env.DATA_GO_KR_SERVICE_KEY.trim()));
  upstream.searchParams.set("dataType", "json");
  upstream.searchParams.set("pageNo", String(pageNo));
  upstream.searchParams.set("numOfRows", String(numOfRows));

  try {
    const response = await fetch(upstream.toString(), {
      headers: { "Accept": "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    const raw = await response.text();

    if (!response.ok) {
      return json({ success: false, code: "UPSTREAM_HTTP_ERROR", message: "공공데이터 API 응답 오류입니다. API 승인 상태와 요청 주소를 확인해 주세요.", items: [] }, 502);
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (_) {
      const xmlValue = (tag) => {
        const match = raw.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">", "i"));
        return match?.[1]?.replace(/<!\\[CDATA\\[|\\]\\]>/g, "").trim() || "";
      };
      const providerCode =
        xmlValue("returnReasonCode") ||
        xmlValue("resultCode") ||
        xmlValue("errCode") ||
        xmlValue("code");
      const providerMessage =
        xmlValue("returnAuthMsg") ||
        xmlValue("errMsg") ||
        xmlValue("resultMsg") ||
        xmlValue("returnReason") ||
        xmlValue("message");
      const contentType = response.headers.get("content-type") || "unknown";
      const safeMessage = [providerCode, providerMessage].filter(Boolean).join(" / ");
      return json({
        success: false,
        code: "NON_JSON_RESPONSE",
        message: safeMessage
          ? "공공데이터 API 응답 확인 필요 (" + safeMessage.slice(0, 240) + "). 인증키, 승인 상태, 요청 변수를 확인해 주세요."
          : "공공데이터 API가 JSON 대신 다른 형식으로 응답했습니다. 응답 형식: " + contentType + ". API 주소와 요청 변수를 확인해야 합니다.",
        items: []
      }, 502);
    }

    const resultCode = String(
      payload?.response?.header?.resultCode ??
      payload?.header?.resultCode ??
      payload?.resultCode ?? ""
    );
    const resultMsg = String(
      payload?.response?.header?.resultMsg ??
      payload?.header?.resultMsg ??
      payload?.resultMsg ?? ""
    );
    if ((resultCode && !["00", "0"].includes(resultCode)) || payload?.error || payload?.errors) {
      return json({
        success: false,
        code: "API_PROVIDER_ERROR",
        message: "공공데이터 제공기관 응답 오류입니다. (" + (resultMsg || resultCode || "요청 실패") + ") 활용신청 승인 상태와 인증키를 확인해 주세요.",
        items: []
      }, 502);
    }

    const rows = normalizeRows(payload);
    const items = rows.map((row, index) => {
      const title = firstValue(row, ["pblancNm","bizNm","title","announcementTitle","공고명","nttSj","bizTitle","사업명","사업공고명"]);
      const summary = firstValue(row, ["bsnsSumryCn","bizSumry","summary","사업개요내용","description","content","pblancCn","공고내용"], "상세 내용은 공식 공고문에서 확인해 주세요.");
      const target = firstValue(row, ["suptTrgt","suptTrgtNm","target","지원대상","지원 대상","trgt","trgetNm","지원대상내용"], "공고 원문 확인");
      const agency = firstValue(row, ["suptInstNm","excInstNm","agency","기관명","organNm","pblancInstNm","소관명","수행기관명","주관기관"], "공고 원문 확인");
      const period = firstValue(row, ["reqstBeginEndDe","reqstPeriod","applicationPeriod","신청기간","period","reqstDe","신청기간내용"]);
      const begin = firstValue(row, ["reqstBeginDe","startDate","applicationStart","신청시작일"]);
      const end = firstValue(row, ["reqstEndDe","endDate","applicationEnd","신청종료일"]);
      const url = firstValue(row, ["pblancUrl","bizInfoUrl","url","detailUrl","공고URL","pblancLink","dtlUrl","사업신청URL","bizUrl","link"]);
      const tags = firstValue(row, ["hashTag","hashtag","해시태그","분야","category"]);
      const id = firstValue(row, ["pblancId","bizId","id","공고ID","seq","nttId"], String(index + 1));
      const searchable = [title, summary, target, agency, tags].join(" ");
      return {
        id,
        title,
        summary,
        target,
        agency,
        period: period || [begin, end].filter(Boolean).join(" ~ ") || "공고 원문 확인",
        url: /^https?:\/\//i.test(url) ? url : "",
        category: categoryFor(tags + " " + searchable),
        region: regionFor(searchable),
        scope: /소상공인|자영업|소기업/.test(searchable) ? "small" : "all",
        updatedAt: firstValue(row, ["lastMdfcnDt","modDate","updateDate","수정일자","등록일자","regDate"])
      };
    }).filter(item => item.title);

    return json({
      success: true,
      items,
      count: items.length,
      fetchedAt: new Date().toISOString(),
      source: "중소벤처기업부·기업마당 중소기업 지원사업 공고 조회 서비스"
    });
  } catch (_) {
    return json({ success: false, code: "FETCH_FAILED", message: "공공데이터 API에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", items: [] }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/supports") {
      return supports(request, env);
    }
    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return json({ success: false, code: "ASSETS_BINDING_MISSING", message: "정적 파일 바인딩 ASSETS를 찾을 수 없습니다. Cloudflare Workers Static Assets 설정을 확인해 주세요.", items: [] }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};
