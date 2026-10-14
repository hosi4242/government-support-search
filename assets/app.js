/* Production frontend: live records are loaded through the Cloudflare Pages Function.
   API credentials must never be placed in this file. */
const $ = (id) => document.getElementById(id);
let supportData = [];
let apiReady = false;

function safeUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") ? url.href : "";
  } catch { return ""; }
}
function text(value, fallback = "공고 원문 확인") {
  return value === undefined || value === null || String(value).trim() === "" ? fallback : String(value).trim();
}
function renderResults() {
  const results = $("results");
  if (!results) return;
  const keyword = ($("keyword")?.value || "").trim().toLocaleLowerCase("ko-KR");
  const scope = $("scope")?.value || "all";
  const region = $("region")?.value || "";
  const category = $("category")?.value || "";
  const filtered = supportData.filter(item => {
    const searchable = [item.title,item.category,item.region,item.agency,item.target,item.summary].join(" ").toLocaleLowerCase("ko-KR");
    return (!keyword || searchable.includes(keyword)) &&
      (scope === "all" || item.scope === "small" || item.scope === "all" && scope === "all") &&
      (!region || item.region === region || item.region === "전국") &&
      (!category || item.category === category);
  });
  results.replaceChildren();
  filtered.forEach(item => {
    const card = document.createElement("article"); card.className = "result-card";
    const top = document.createElement("div"); top.className = "card-top";
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = text(item.category, "지원사업") + " · " + text(item.region, "전국");
    const deadline = document.createElement("span"); deadline.className = "deadline"; deadline.textContent = text(item.period, "기간은 원문 확인");
    top.append(tag, deadline);
    const title = document.createElement("h3"); title.textContent = text(item.title, "지원사업 공고");
    const summary = document.createElement("p"); summary.className = "summary"; summary.textContent = text(item.summary);
    const meta = document.createElement("dl"); meta.className = "meta-list";
    [["주관 기관", item.agency], ["지원 대상", item.target], ["신청 기간", item.period]].forEach(([label,value]) => {
      const row = document.createElement("div"); row.className = "meta-row";
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = text(value);
      row.append(dt,dd); meta.append(row);
    });
    card.append(top,title,summary,meta);
    const linkUrl = safeUrl(item.url);
    if (linkUrl) {
      const link = document.createElement("a");
      link.className = "card-link"; link.href = linkUrl; link.target = "_blank";
      link.rel = "noopener noreferrer"; link.textContent = "공식 공고 확인 ↗";
      card.append(link);
    } else {
      const missing = document.createElement("p");
      missing.className = "summary"; missing.textContent = "이 공고의 직접 링크가 API에서 제공되지 않았습니다. 공고 제목으로 제공기관의 공식 사이트에서 다시 확인해 주세요.";
      card.append(missing);
    }
    results.append(card);
  });
  if ($("resultCount")) $("resultCount").textContent = apiReady ? `${filtered.length}개 공고` : "실시간 데이터 연결 대기";
  if ($("emptyState")) $("emptyState").hidden = filtered.length !== 0;
  if ($("demoNotice")) $("demoNotice").hidden = false;
}
async function loadSupportData() {
  const count = $("resultCount");
  const notice = $("demoNotice");
  if (count) count.textContent = "공고를 불러오는 중…";
  if (notice) {
    notice.hidden = false;
    notice.replaceChildren();
    const strong = document.createElement("strong"); strong.textContent = "실시간 공공데이터 연결";
    const message = document.createElement("p"); message.textContent = "공식 공고 데이터를 불러오고 있습니다.";
    notice.append(strong, message);
  }
  try {
    const response = await fetch("/api/supports", { headers: { "Accept": "application/json" } });
    const payload = await response.json();
    if (!response.ok || !payload.success || !Array.isArray(payload.items)) {
      throw new Error(payload.message || "공공데이터를 불러오지 못했습니다.");
    }
    supportData = payload.items;
    apiReady = true;
    if (count) count.textContent = `${supportData.length}개 공고 · ${new Date(payload.fetchedAt || Date.now()).toLocaleString("ko-KR")} 확인`;
    if (notice) {
      notice.hidden = false;
      notice.replaceChildren();
      const strong = document.createElement("strong"); strong.textContent = "공식 공공데이터";
      const message = document.createElement("p"); message.textContent = "중소벤처기업부·기업마당 지원사업 공고 API를 통해 불러온 정보입니다. 신청 자격과 기간은 공식 공고문에서 최종 확인하세요.";
      notice.append(strong, message);
    }
    renderResults();
  } catch (error) {
    apiReady = false;
    supportData = [];
    if (count) count.textContent = "공고 데이터를 불러오지 못했습니다";
    if (notice) {
      notice.hidden = false;
      notice.replaceChildren();
      const strong = document.createElement("strong"); strong.textContent = "실시간 데이터 설정이 필요합니다";
      const message = document.createElement("p");
      message.textContent = error.message || "Cloudflare Pages의 API 주소와 암호화된 서비스 키 설정을 확인해 주세요. 예시 데이터는 실제 공고처럼 표시하지 않습니다.";
      notice.append(strong, message);
    }
    renderResults();
  }
}
document.addEventListener("DOMContentLoaded", () => {
  $("searchBtn")?.addEventListener("click", renderResults);
  ["scope","region","category"].forEach(id => $(id)?.addEventListener("change", renderResults));
  $("keyword")?.addEventListener("input", renderResults);
  $("keyword")?.addEventListener("keydown", event => { if (event.key === "Enter") renderResults(); });
  const year = $("year"); if (year) year.textContent = new Date().getFullYear();
  loadSupportData();
});
