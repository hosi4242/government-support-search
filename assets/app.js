/* Demo-only front end. Replace DEMO_DATA with the approved API response via a secure server-side endpoint. Never expose a secret service key in browser JavaScript. */
const DEMO_DATA = [
 {id:"demo-1",title:"[예시] 소상공인 경영안정 지원사업",category:"경영",region:"전국",scope:"small",agency:"예시 기관",period:"예시 기간 · 실제 일정 아님",target:"소상공인 및 소기업(예시)",summary:"경영 안정과 사업 운영을 돕는 지원사업 카드 예시입니다. 실제 공고가 아닙니다.",url:"https://www.data.go.kr/"},
 {id:"demo-2",title:"[예시] 초기 창업기업 사업화 지원",category:"창업",region:"전국",scope:"all",agency:"예시 기관",period:"예시 기간 · 실제 일정 아님",target:"창업 초기 기업(예시)",summary:"창업 준비 및 초기 사업화와 관련된 정보 카드의 표시 예시입니다.",url:"https://www.data.go.kr/"},
 {id:"demo-3",title:"[예시] 지역 소상공인 온라인 판로 지원",category:"판로",region:"부산",scope:"small",agency:"예시 지자체",period:"예시 기간 · 실제 일정 아님",target:"지역 소상공인(예시)",summary:"온라인 판매 채널과 디지털 판로 관련 지원사업 카드 예시입니다.",url:"https://www.data.go.kr/"},
 {id:"demo-4",title:"[예시] 재직자 직무교육 지원 프로그램",category:"교육",region:"서울",scope:"all",agency:"예시 기관",period:"예시 기간 · 실제 일정 아님",target:"기업 재직자 및 사업자(예시)",summary:"직무 역량 강화 교육을 안내하는 카드 예시입니다.",url:"https://www.data.go.kr/"},
 {id:"demo-5",title:"[예시] 소상공인 디지털 전환 지원",category:"기술",region:"경기",scope:"small",agency:"예시 기관",period:"예시 기간 · 실제 일정 아님",target:"디지털 전환을 희망하는 소상공인(예시)",summary:"온라인 업무·디지털 도구 도입과 관련된 지원사업 카드 예시입니다.",url:"https://www.data.go.kr/"},
 {id:"demo-6",title:"[예시] 중소기업 신규 고용 지원",category:"고용",region:"전국",scope:"all",agency:"예시 기관",period:"예시 기간 · 실제 일정 아님",target:"요건을 충족하는 사업체(예시)",summary:"고용 및 인력 운영 관련 공고를 표시하는 예시입니다.",url:"https://www.data.go.kr/"}
];
const $ = (id) => document.getElementById(id);
// 외부 API 데이터 연결 시 javascript: 등 위험한 URL 스킴 차단 (http/https만 허용)
function safeUrl(u){
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
 const filtered = DEMO_DATA.filter(item => {
   const searchable = [item.title,item.category,item.region,item.agency,item.target,item.summary].join(" ").toLowerCase();
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
   const deadline = document.createElement("span"); deadline.className = "deadline"; deadline.textContent = "예시 데이터";
   top.append(tag,deadline);
   const title = document.createElement("h3"); title.textContent = item.title;
   const summary = document.createElement("p"); summary.className = "summary"; summary.textContent = item.summary;
   const meta = document.createElement("dl"); meta.className = "meta-list";
   [["주관 기관",item.agency],["지원 대상",item.target],["신청 기간",item.period]].forEach(([k,v])=>{
     const row = document.createElement("div"); row.className = "meta-row";
     const dt = document.createElement("dt"); dt.textContent = k;
     const dd = document.createElement("dd"); dd.textContent = v;
     row.append(dt,dd); meta.append(row);
   });
   const link = document.createElement("a"); link.className = "card-link"; link.href = safeUrl(item.url); link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "공식 데이터 포털 열기 ↗";
   card.append(top,title,summary,meta,link); results.append(card);
 });
 if ($("resultCount")) $("resultCount").textContent = `${filtered.length}개 예시`;
 if ($("emptyState")) $("emptyState").hidden = filtered.length !== 0;
}
document.addEventListener("DOMContentLoaded",()=>{
 $("searchBtn")?.addEventListener("click",renderResults);
 ["scope","region","category"].forEach(id=>$(id)?.addEventListener("change",renderResults));
 $("keyword")?.addEventListener("input",renderResults);
 $("keyword")?.addEventListener("keydown",e=>{if(e.key==="Enter")renderResults()});
 const year=$("year"); if(year) year.textContent=new Date().getFullYear();
 renderResults();
});