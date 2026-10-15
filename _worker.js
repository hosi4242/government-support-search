/**
 * Cloudflare Workers Static Assets entry point.
 * API credentials remain server-side in DATA_GO_KR_SERVICE_KEY.
 * SUPPORTS_DB is an optional D1 binding during setup; configure it before enabling
 * the scheduled sync in production. Without D1, the existing live API fallback remains.
 */
const API_ENDPOINT = "https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService";
const API_PAGE_SIZE = 100;
const API_MAX_PAGES = 100;
const SOURCE_NAME = "중소벤처기업부·기업마당 중소기업 지원사업 공고 조회 서비스";

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

function totalCountFor(payload) {
  const value = firstValue(payload, [
    "totalCount"
  ], "");
  const nested = payload?.response?.body?.totalCount ??
    payload?.body?.totalCount ??
    payload?.data?.totalCount ??
    payload?.result?.totalCount ??
    value;
  const parsed = Number.parseInt(nested, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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

function mapRow(row, index, fetchedAt) {
  const title = firstValue(row, ["pblancNm","bizNm","title","announcementTitle","공고명","nttSj","bizTitle","사업명","사업공고명"]);
  const summary = firstValue(row, ["bsnsSumryCn","bizSumry","summary","사업개요내용","description","content","pblancCn","공고내용"], "상세 내용은 공식 공고문에서 확인해 주세요.");
  const target = firstValue(row, ["suptTrgt","suptTrgtNm","target","지원대상","지원 대상","trgt","trgetNm","지원대상내용"], "공고 원문 확인");
  const agency = firstValue(row, ["suptInstNm","excInstNm","agency","기관명","organNm","pblancInstNm","소관명","수행기관명","주관기관"], "공고 원문 확인");
  const period = firstValue(row, ["reqstBeginEndDe","reqstPeriod","applicationPeriod","신청기간","period","reqstDe","신청기간내용"]);
  const begin = firstValue(row, ["reqstBeginDe","startDate","applicationStart","신청시작일"]);
  const end = firstValue(row, ["reqstEndDe","endDate","applicationEnd","신청종료일"]);
  const url = firstValue(row, ["pblancUrl","bizInfoUrl","url","detailUrl","공고URL","pblancLink","dtlUrl","사업신청URL","bizUrl","link"]);
  const tags = firstValue(row, ["hashTag","hashtag","해시태그","분야","category"]);
  const updatedAt = firstValue(row, ["lastMdfcnDt","modDate","updateDate","수정일자","등록일자","regDate"]);
  const fallbackId = [title, url, period || [begin, end].filter(Boolean).join("~")].filter(Boolean).join("|") || String(index + 1);
  const id = firstValue(row, ["pblancId","bizId","id","공고ID","seq","nttId"], fallbackId);
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
    updatedAt,
    fetchedAt
  };
}

function parseApiPayload(raw, response) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    const xmlValue = (tag) => {
      const match = raw.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">", "i"));
      return match?.[1]?.replace(/<!\\[CDATA\\[|\\]\\]>/g, "").trim() || "";
    };
    const providerCode = xmlValue("returnReasonCode") || xmlValue("resultCode") || xmlValue("errCode") || xmlValue("code");
    const providerMessage = xmlValue("returnAuthMsg") || xmlValue("errMsg") || xmlValue("resultMsg") || xmlValue("returnReason") || xmlValue("message");
    const details = [providerCode, providerMessage].filter(Boolean).join(" / ");
    throw new Error(details
      ? "공공데이터 API 응답 확인 필요 (" + details.slice(0, 240) + "). 인증키, 승인 상태, 요청 변수를 확인해 주세요."
      : "공공데이터 API가 JSON 대신 다른 형식으로 응답했습니다. 응답 형식: " + (response.headers.get("content-type") || "unknown") + ".");
  }
}

async function fetchApiPage(env, pageNo, numOfRows = API_PAGE_SIZE, cache = false) {
  if (!env.DATA_GO_KR_SERVICE_KEY) {
    throw new Error("API 인증키 설정을 확인해 주세요. Cloudflare Secret DATA_GO_KR_SERVICE_KEY가 필요합니다.");
  }
  const upstream = new URL(API_ENDPOINT);
  upstream.searchParams.set("serviceKey", serviceKeyValue(env.DATA_GO_KR_SERVICE_KEY.trim()));
  upstream.searchParams.set("dataType", "json");
  upstream.searchParams.set("pageNo", String(pageNo));
  upstream.searchParams.set("numOfRows", String(numOfRows));
  const options = { headers: { "Accept": "application/json" } };
  if (cache) options.cf = { cacheTtl: 300, cacheEverything: true };

  const response = await fetch(upstream.toString(), options);
  const raw = await response.text();
  if (!response.ok) {
    throw new Error("공공데이터 API HTTP 응답 오류(" + response.status + "). API 승인 상태와 요청 주소를 확인해 주세요.");
  }
  const payload = parseApiPayload(raw, response);
  const resultCode = String(payload?.response?.header?.resultCode ?? payload?.header?.resultCode ?? payload?.resultCode ?? "");
  const resultMsg = String(payload?.response?.header?.resultMsg ?? payload?.header?.resultMsg ?? payload?.resultMsg ?? "");
  if ((resultCode && !["00", "0"].includes(resultCode)) || payload?.error || payload?.errors) {
    throw new Error("공공데이터 제공기관 응답 오류입니다. (" + (resultMsg || resultCode || "요청 실패") + ")");
  }
  return { payload, rows: normalizeRows(payload), totalCount: totalCountFor(payload) };
}

function apiErrorResponse(error) {
  const message = error?.message || "공공데이터 API에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  const code = /인증키/.test(message) ? "API_NOT_CONFIGURED" :
    /HTTP 응답 오류/.test(message) ? "UPSTREAM_HTTP_ERROR" :
    /응답 확인 필요|JSON 대신|제공기관 응답 오류/.test(message) ? "API_PROVIDER_ERROR" : "FETCH_FAILED";
  return json({ success: false, code, message, items: [] }, code === "API_NOT_CONFIGURED" ? 503 : 502);
}

async function readStoredSupports(env) {
  if (!env.SUPPORTS_DB) return null;
  const result = await env.SUPPORTS_DB.prepare(
    "SELECT id, title, summary, target, agency, period, url, category, region, scope, updated_at AS updatedAt, fetched_at AS fetchedAt FROM support_announcements ORDER BY COALESCE(updated_at, fetched_at) DESC, title ASC"
  ).all();
  const rows = result?.results;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const fetchedAt = rows.reduce((latest, row) => row.fetchedAt > latest ? row.fetchedAt : latest, "");
  return { items: rows, fetchedAt };
}

async function supports(request, env) {
  if (request.method !== "GET") {
    return json({ success: false, code: "METHOD_NOT_ALLOWED", message: "GET 요청만 지원합니다.", items: [] }, 405);
  }
  try {
    if (env.SUPPORTS_DB) {
      try {
        const stored = await readStoredSupports(env);
        if (stored) {
          return json({ success: true, items: stored.items, count: stored.items.length, fetchedAt: stored.fetchedAt, source: SOURCE_NAME, dataMode: "stored" });
        }
      } catch (error) {
        console.error("D1 read failed; using live API fallback.", error?.message || "unknown error");
      }
    }

    // Preserve the existing live API behavior until D1 is configured and has data.
    const incoming = new URL(request.url);
    const pageNo = Math.min(API_MAX_PAGES, Math.max(1, Number.parseInt(incoming.searchParams.get("pageNo") || "1", 10) || 1));
    const numOfRows = Math.min(API_PAGE_SIZE, Math.max(1, Number.parseInt(incoming.searchParams.get("numOfRows") || String(API_PAGE_SIZE), 10) || API_PAGE_SIZE));
    const { rows } = await fetchApiPage(env, pageNo, numOfRows, true);
    const fetchedAt = new Date().toISOString();
    const items = rows.map((row, index) => mapRow(row, index + ((pageNo - 1) * numOfRows), fetchedAt)).filter(item => item.title);
    return json({ success: true, items, count: items.length, fetchedAt, source: SOURCE_NAME, dataMode: "live" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

async function syncAllSupports(env) {
  if (!env.DATA_GO_KR_SERVICE_KEY) throw new Error("DATA_GO_KR_SERVICE_KEY secret is not configured.");
  if (!env.SUPPORTS_DB) throw new Error("SUPPORTS_DB D1 binding is not configured; create the database, configure the binding, and apply migrations before enabling scheduled sync.");

  const fetchedAt = new Date().toISOString();
  const collected = [];
  let expectedTotal = null;
  for (let pageNo = 1; pageNo <= API_MAX_PAGES; pageNo += 1) {
    const { rows, totalCount } = await fetchApiPage(env, pageNo, API_PAGE_SIZE, false);
    if (pageNo === 1) {
      expectedTotal = totalCount;
      if (expectedTotal !== null && expectedTotal > API_PAGE_SIZE * API_MAX_PAGES) {
        throw new Error("The API reports more than the configured 10,000-record safety limit. Increase the pagination limit before syncing; existing D1 data was left unchanged.");
      }
    }
    collected.push(...rows.map((row, index) => mapRow(row, ((pageNo - 1) * API_PAGE_SIZE) + index, fetchedAt)).filter(item => item.title));

    if (expectedTotal !== null) {
      const totalPages = Math.max(1, Math.ceil(expectedTotal / API_PAGE_SIZE));
      if (pageNo >= Math.min(totalPages, API_MAX_PAGES)) break;
    } else if (rows.length < API_PAGE_SIZE) {
      break;
    } else if (pageNo === API_MAX_PAGES) {
      throw new Error("Pagination reached the 10,000-record safety limit without a provider total count. Existing D1 data was left unchanged.");
    }
  }

  if (collected.length === 0) {
    throw new Error("The API returned no valid announcements; existing D1 data was left unchanged.");
  }

  const unique = new Map();
  for (const item of collected) unique.set(item.id, item);
  const items = [...unique.values()];
  const statements = items.map(item => env.SUPPORTS_DB.prepare(
    "INSERT INTO support_announcements (id, title, summary, target, agency, period, url, category, region, scope, updated_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, summary=excluded.summary, target=excluded.target, agency=excluded.agency, period=excluded.period, url=excluded.url, category=excluded.category, region=excluded.region, scope=excluded.scope, updated_at=excluded.updated_at, fetched_at=excluded.fetched_at"
  ).bind(item.id, item.title, item.summary, item.target, item.agency, item.period, item.url, item.category, item.region, item.scope, item.updatedAt, item.fetchedAt));

  // Small batches avoid oversized D1 batch transactions for large result sets.
  for (let offset = 0; offset < statements.length; offset += 50) {
    await env.SUPPORTS_DB.batch(statements.slice(offset, offset + 50));
  }
  // Only prune announcements absent from the provider after every page was fetched
  // and every upsert succeeded. A failed/incomplete sync never runs this cleanup.
  await env.SUPPORTS_DB.prepare(
    "DELETE FROM support_announcements WHERE fetched_at < ?"
  ).bind(fetchedAt).run();
  console.log("Support announcement sync completed.", JSON.stringify({ count: items.length, fetchedAt, apiTotalCount: expectedTotal }));
  return { count: items.length, fetchedAt, apiTotalCount: expectedTotal };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/supports") return supports(request, env);
    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return json({ success: false, code: "ASSETS_BINDING_MISSING", message: "정적 파일 바인딩 ASSETS를 찾을 수 없습니다. Cloudflare Workers Static Assets 설정을 확인해 주세요.", items: [] }, 500);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env) {
    try {
      await syncAllSupports(env);
    } catch (error) {
      console.error("Support announcement sync failed.", error?.message || "unknown error");
      throw error;
    }
  }
};
