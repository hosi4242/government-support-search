let SUPPORT_DATA = [];
let apiError = "";
let apiFetchedAt = "";
let apiSource = "";


const $ = (id) => document.getElementById(id);
function cleanApiText(value){
 if (value == null) return "";
 return String(value)
   .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
   .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
   .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
   .replace(/&amp;/gi, "&")
   .replace(/<\s*\/p\s*>/gi, "\n")
   .replace(/<\s*br\s*\/?\s*>/gi, "\n")
   .replace(/<\s*\/li\s*>/gi, "\n")
   .replace(/<[^>]*>/g, "")
   .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
   .replace(/[ \t]+/g, " ")
   .trim();
}
function splitReadableParagraphs(value) {
 const normalized = cleanApiText(value)
   .replace(/\\r\\n?/g, "\\n")
   .replace(/[ \\t\\u00a0]+/g, " ")
   .replace(/ *\\n */g, "\\n")
   .trim();
 if (!normalized) return [];
 const parts = normalized.split("\\n");
 const output = [];
 for (const raw of parts) {
   const item = raw.trim();
   if (!item) continue;
   const sentences = item.split(/(?<=[.!?。]) +(?=[가-힣])/);
   for (const sentence of sentences) {
     const headingParts = sentence.split(/(?=■|●|○|◆|▶|※|[•▪‣]|\\d+[.)、]|(?:지원|신청|접수|사업|대상|기간|내용|방법|문의|유의)\\s*[:：])/);
     for (const heading of headingParts) {
       if (heading.trim()) output.push(heading.trim());
     }
   }
 }
 return output;
}
// 외부 API 데이터 연결 시 javascript: 등 위험한 URL 스킴 차단 (http/https만 허용)
function safeUrl(u){
 if (!u) return "#";
 try{ const p = new URL(u, location.href); return (p.protocol === "https:" || p.protocol === "http:") ? p.href : "#"; }
 catch(e){ return "#"; }
}
function renderResults(){
 const results = $("results");
 if (!results) return;
 const keyword = ($("keyword")?.value || "").trim().toLowerCase();
 const scope = $("scope")?.value || "all";
 const region = $("region")?.value || "";
 const category = $("category")?.value || "";
 const filtered = SUPPORT_DATA.filter(item => {
   const searchable = [item.title,item.category,item.region,item.agency,item.target,item.summary,item.detail].join(" ").toLowerCase();
   return (!keyword || searchable.includes(keyword)) &&
     (scope === "all" || item.scope === scope) &&
     (!region || item.region === region || item.region === "전국") &&
     (!category || item.category === category);
 });
 results.replaceChildren();
 filtered.forEach(item => {
   const card = document.createElement("article"); card.className = "result-card";
   const top = document.createElement("div"); top.className = "card-top";
   const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = item.category + " · " + item.region;
   const deadline = document.createElement("span"); deadline.className = "deadline"; deadline.textContent = item.period && item.period !== "공고 원문 확인" ? item.period : "공고 정보";
   top.append(tag,deadline);
   const title = document.createElement("h3"); title.textContent = item.title;
   const summary = document.createElement("div"); summary.className = "summary";\n    splitReadableParagraphs(item.summary).forEach(text => { const p = document.createElement("p"); p.textContent = text; summary.append(p); });
   // 상세 공고의 HTML 줄바꿈과 붙어 있는 문장을 읽기 좋은 문단으로 정리합니다.
   const detailText = item.detail || item.content || item.contents || item.description || item.body || "";
   const detail = document.createElement("div"); detail.className = "notice-detail";
   if (typeof detailText === "string" && detailText.trim()) {
     const normalized = detailText
       .replace(/<\s*br\s*\/?>/gi, "\n")
       .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article)\s*>/gi, "\n")
       .replace(/<li\b[^>]*>/gi, "\n• ")
       .replace(/<[^>]*>/g, " ")
       .replace(/&nbsp;|&#160;/gi, " ")
       .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
       .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
       .replace(/\r\n?/g, "\n")
       .replace(/[ \t\u00a0]+/g, " ")
       .replace(/ *\n */g, "\n")
       .replace(/\n{2,}/g, "\n")
       .trim();
     const chunks = normalized
       .replace(/([.!?。])(?=[가-힣A-Z0-9“"‘'])/g, "$1\n")
       .replace(/(■|●|○|◆|▶|※|[•▪‣]|\d+[.)、]|[가-힣][.)、]|\[[^\]]{1,24}\]|(?:지원|신청|접수|사업|대상|기간|내용|방법|문의|유의)\s*[:：])/g, "\n$1")
       .split(/\n+/).map(part => part.trim()).filter(Boolean);
     chunks.forEach(part => {
       const paragraph = document.createElement("p");
       paragraph.textContent = part;
       detail.append(paragraph);
     });
   }
   const meta = document.createElement("dl"); meta.className = "meta-list";
   [["주관 기관",item.agency],["지원 대상",item.target],["신청 기간",item.period]].forEach(([k,v])=>{
     const row = document.createElement("div"); row.className = "meta-row";
     const dt = document.createElement("dt"); dt.textContent = k;
     const dd = document.createElement("dd"); dd.textContent = v;
     row.append(dt,dd); meta.append(row);
   });
   const link = document.createElement("a"); link.className = "card-link"; link.href = safeUrl(item.url); link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "공식 공고문 열기 ↗";
   card.append(top,title,summary);
   if (detail.childElementCount) card.append(detail);
   card.append(meta);
   if (item.url) card.append(link);
   results.append(card);
 });
 if ($("resultCount")) $("resultCount").textContent = apiError ? "연결 확인 필요" : `${filtered.length}개 공고`;
 if ($("emptyState")) {
   $("emptyState").hidden = filtered.length !== 0 && !apiError;
   const emptyTitle = $("emptyState").querySelector("strong");
   const emptyText = $("emptyState").querySelector("p");
   if (apiError) {
     if (emptyTitle) emptyTitle.textContent = "공고 데이터를 불러오지 못했습니다.";
     if (emptyText) emptyText.textContent = apiError;
   } else {
     if (emptyTitle) emptyTitle.textContent = "검색 결과가 없습니다.";
     if (emptyText) emptyText.textContent = "검색어 또는 필터를 변경해 보세요.";
   }
 }
}
async function loadSupportData() {
 const notice = $("demoNotice");
 if (notice) {
   notice.hidden = false;
   notice.textContent = "공공데이터 API에서 최신 지원사업 공고를 불러오는 중입니다.";
 }
 try {
   const response = await fetch("/api/supports", { headers: { "Accept": "application/json" } });
   const data = await response.json();
   if (!response.ok || !data.success || !Array.isArray(data.items)) {
     throw new Error(data.message || "API 연결 상태를 확인해 주세요.");
   }
   SUPPORT_DATA = data.items;
   apiFetchedAt = data.fetchedAt || "";
   apiSource = data.source || "공공데이터 API";
   apiError = "";
   if (notice) {
     notice.hidden = false;
     const when = apiFetchedAt ? new Date(apiFetchedAt).toLocaleString("ko-KR") : "";
     notice.textContent = apiSource + (when ? " · 조회 시각: " + when : "") + " · 최종 신청 조건은 공식 공고문을 확인하세요.";
   }
 } catch (error) {
   SUPPORT_DATA = [];
   apiError = error?.message || "공공데이터 API에 연결하지 못했습니다.";
   if (notice) {
     notice.hidden = false;
     notice.textContent = "공공데이터 연결 안내: " + apiError;
   }
 }
 renderResults();
}

document.addEventListener("DOMContentLoaded",()=>{
 $("searchBtn")?.addEventListener("click",renderResults);
 ["scope","region","category"].forEach(id=>$(id)?.addEventListener("change",renderResults));
 $("keyword")?.addEventListener("input",renderResults);
 $("keyword")?.addEventListener("keydown",e=>{if(e.key==="Enter")renderResults()});
 const year=$("year"); if(year) year.textContent=new Date().getFullYear();
 loadSupportData();
})    // 상세 공고를 문장과 항목별 문단으로 분리해 읽기 쉽게 표시합니다.
    const detailText = item.detail || item.content || item.contents || item.description || item.body || "";
    const detail = document.createElement("div"); detail.className = "notice-detail";
    splitReadableParagraphs(detailText).forEach(text => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      detail.append(paragraph);
    });
;