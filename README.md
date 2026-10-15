# 지원금 찾기 — Cloudflare Workers API 연동 브랜치

## 현재 배포 구성 및 검증 상태

- 이 브랜치는 **Cloudflare Workers + Static Assets** 방식입니다. 기존 Workers 배포를 유지하며 Cloudflare Pages Functions를 사용하지 않습니다.
- `wrangler.jsonc`의 `main`은 `./_worker.js`이며, `/api/*` 요청은 Worker가 먼저 처리합니다.
- Worker는 암호화된 Cloudflare Secret `DATA_GO_KR_SERVICE_KEY`를 서버에서 읽습니다. 인증키를 HTML이나 브라우저 JavaScript에 넣지 마세요.
- 정적 사이트 파일은 저장소 루트에서 제공하며, `.assetsignore`는 Worker 소스와 설정 파일이 공개 정적 파일로 배포되지 않도록 제외합니다.
- GitHub 브랜치 수정은 완료했지만, **운영 URL에서 실제 API 응답을 확인하기 전까지는 API 연결 성공으로 간주하지 않습니다.** 배포 후 `/api/supports`가 JSON의 `success: true`와 `items` 배열을 반환하는지, 검색과 공식 공고 링크가 동작하는지 확인해야 합니다.
- 공공데이터포털의 해당 API는 개발 단계 자동승인, 운영 단계 심의승인으로 안내되어 있습니다. 운영 승인 상태도 확인하세요.

> 아래 내용은 원본 정적 사이트 템플릿을 만들 때 작성한 이력과 참고 사항입니다. 현재 브랜치의 배포 방식은 위 설명을 기준으로 확인하세요.

정적 HTML/CSS/JavaScript로 만든 초안입니다. GitHub + Cloudflare Pages에 올릴 수 있도록 프레임워크나 빌드 단계 없이 구성했습니다.

## 포함 파일
- `index.html`: 정부지원금 전체 검색
- `small-business.html`: 소상공인 지원사업 검색
- `guide.html`: 이용 안내
- `about.html`: 서비스 소개
- `privacy.html`: 개인정보처리방침 초안 — 실제 운영 내용에 맞춰 반드시 수정
- `sources.html`: 공공데이터 출처 안내
- `contact.html`: 문의 안내 — 실제 이메일 입력 필요
- `assets/style.css`: 반응형 스타일
- `assets/app.js`: 검색 필터와 시연용 예시 데이터
- `404.html`: 없는 주소 안내 (Cloudflare Pages가 자동 사용)
- `_headers`: 기본 보안 헤더 (Cloudflare Pages 전용 설정 파일)
- `robots.txt`, `sitemap.xml`: 배포 전에 도메인 수정 필요

## 현재 상태를 꼭 알아두세요
이 문단은 초기 정적 템플릿 작성 당시의 안내입니다. 현재 작업 브랜치에서는 `_worker.js`를 통해 실제 공공데이터 API를 호출합니다. 운영 자동 갱신 작업은 아래의 ‘운영 자동 갱신 준비’ 섹션을 기준으로 확인하세요.

## API 연결 순서
1. 공공데이터포털에서 데이터셋을 선택하고 이용 조건, 출처 표시, 운영 승인, 호출 한도를 확인합니다.
2. 서비스 키가 브라우저에 노출되지 않도록 가능하면 Cloudflare Worker 같은 서버 측 프록시를 사용합니다.
3. 공고 데이터를 정규화해 `id`, `title`, `category`, `region`, `scope`, `agency`, `period`, `target`, `summary`, `url`, `updatedAt` 형태로 변환합니다.
4. `assets/app.js`에서 `DEMO_DATA`를 API 응답으로 대체하고, 로딩·오류·빈 결과 상태를 구현합니다.
5. API가 일시 중단되어도 사이트가 깨지지 않도록 마지막 정상 갱신 데이터나 안내 메시지를 준비합니다.

우선 검토할 API:
- https://www.data.go.kr/data/15157820/openapi.do — 중소벤처기업부_중소기업 지원사업 공고 조회 서비스(기업마당). 공고명·공고URL·신청기간·지원대상·사업신청URL 등 제공이 확인됨. 응답이 XML일 수 있으므로 Worker에서 JSON으로 변환 권장
- https://www.data.go.kr/data/15113297/openapi.do — **제목·제공 항목을 확인하지 못함.** 사용 전 데이터셋 이름과 이용 조건을 직접 확인
- https://www.data.go.kr/

API별 이용 조건은 서로 다를 수 있으므로 실제 사용 전 해당 페이지의 최신 안내를 확인하세요.

## Google AdSense
- 이 템플릿에는 광고가 실제 송출되지 않습니다. 광고 영역은 자리 표시자입니다.
- AdSense 승인 후 `index.html` 및 필요한 페이지의 주석 처리된 광고 스크립트에 실제 게시자 ID를 입력해 활성화하세요.
- 자동 광고 또는 광고 단위를 적용할 때 검색 버튼·필터·공식 신청 링크와 오인될 배치를 피하고, 광고가 본문을 가리지 않도록 하세요.
- 개인정보처리방침에 실제 광고·쿠키·데이터 처리 방식을 정확히 반영하세요.
- 공고 목록을 그대로 복제하는 데 그치지 말고, 지원 조건 확인 방법, 신청 단계, 공식 원문 링크, 데이터 갱신 시각 등 독자에게 실질적인 가치를 제공하세요. AdSense 승인은 보장되지 않습니다.

## Cloudflare Pages에 배포
1. ZIP 압축을 풀고, **`government-support-search-starter` 폴더 안의 내용물**(폴더 자체가 아님)을 GitHub 저장소 루트에 업로드합니다. 폴더째 올리면 404가 납니다.
2. Cloudflare Pages에서 해당 저장소를 연결합니다.
3. 프레임워크 프리셋은 `None`, 빌드 명령은 비워두고, 출력 디렉터리는 `/` 또는 프로젝트 루트 설정을 사용합니다(기존 프로젝트 설정과 일치하는지 확인).
4. `robots.txt`, `sitemap.xml` 안의 `YOUR-DOMAIN.example`을 실제 도메인으로 바꿉니다. (sitemap은 Cloudflare Pages의 정식 주소인 `.html` 없는 형태로 작성되어 있습니다.)
5. 배포 후 모바일 화면, 검색 필터, 모든 하위 페이지, 외부 링크, 개인정보처리방침을 확인합니다.

## 배포 전 체크리스트
- [ ] 실제 API 연동 및 운영 단계 승인 확인
- [ ] 예시 데이터 전부 제거 (실데이터 연결 전까지는 검색 엔진에 노출되지 않도록 각 페이지 `<head>`에 `<meta name="robots" content="noindex">` 추가 고려)
- [ ] 모든 공식 신청 링크 검증
- [ ] 최종 갱신 시각 표시
- [ ] 실제 운영자 이메일 입력
- [ ] AdSense 활성화 시 `_headers`에 CSP를 추가한다면 Google 광고 도메인 허용 필요
- [ ] 개인정보처리방침을 실제 수집·광고·분석 설정에 맞게 수정
- [ ] 실제 도메인으로 sitemap/robots 수정
- [ ] 모바일·키보드 접근성·오류 상태 점검
- [ ] AdSense 정책 및 콘텐츠 가치 검토


## 변경 이력 (기술 검수)
- 수정: "소상공인" 필터가 동작하지 않던 버그 (항상 전체 결과 표시)
- 수정: 소상공인 페이지 지역 목록이 8개뿐이던 문제 → 17개 시·도 전체
- 보완: 외부 링크 URL 스킴 검증(`safeUrl`), 필터 이벤트 중복 제거
- 보완: 접근성 (본문 바로가기, 포커스 표시, 색 대비, aria-current, 결과 수 안내를 스크린리더용 `role="status"`로 이동)
- 보완: 상대경로로 변경해 로컬(file://) 미리보기 가능, 푸터·메뉴 링크 전 페이지 통일, 파비콘 추가
- 추가: `404.html`, `_headers`, sitemap 정식 URL 형식

## GitHub Pages 배포

1. 저장소의 **Settings → Pages**에서 **Deploy from a branch**를 선택합니다.
2. Branch는 `main`, 폴더는 `/ (root)`로 설정하고 저장합니다.
3. 배포가 완료되면 `https://hosi4242.github.io/government-support-search/`에서 사이트를 확인합니다.
4. 실제 API 연동과 개인정보·문의 정보 확정 전까지는 시연용 데이터와 검색엔진 비노출 설정을 유지합니다.
5. 운영을 시작할 때 `robots.txt`, `sitemap.xml`, 각 페이지의 `noindex` 설정을 실제 데이터와 도메인에 맞게 갱신합니다.


## 운영 자동 갱신 준비 (작업 브랜치)

- 기존 정적 페이지, 디자인, 검색 필터와 공식 공고문 링크는 보존합니다.
- `/api/supports`는 D1 데이터가 있으면 저장된 공고를 반환하고, D1 미설정 또는 데이터가 없는 초기 상태에서는 기존 실시간 API 조회로 대체합니다.
- `migrations/0001_create_support_announcements.sql`은 공고 저장 테이블과 검색 보조 인덱스를 생성합니다.
- Worker의 `scheduled()`는 기업마당 API를 페이지 단위로 수집하고, 공고 ID 기준 upsert로 D1에 저장합니다.
- API 수집이 실패하거나 유효 공고가 0건이면 기존 D1 데이터를 삭제하지 않습니다. 전체 페이지 수집과 upsert가 모두 성공한 경우에만 원본에서 사라진 오래된 공고를 정리합니다.
- 원본 총건수가 10,000건을 넘거나 페이지 한도 내에서 수집 완료 여부를 확인할 수 없으면 동기화를 중단하고 기존 데이터를 유지합니다.
- Cron은 `15 18 * * *` UTC, 즉 한국 시간 기준 매일 오전 3시 15분에 실행하도록 설정합니다.
- `tests/worker.test.mjs`에는 코드 파싱, API 대체 경로, 인증키 누락, 다중 페이지 D1 동기화 테스트가 포함되어 있습니다.

### 배포 전 필수 설정 — 아직 배포하지 마세요

1. Cloudflare 대시보드에서 D1 데이터베이스 `government-support-search-db`를 생성합니다.
2. 생성된 실제 데이터베이스 ID로 `wrangler.jsonc`의 `REPLACE_WITH_D1_DATABASE_ID`를 교체합니다.
3. 기존 Worker의 Secret `DATA_GO_KR_SERVICE_KEY`가 유지되는지 확인합니다. 인증키 값은 GitHub에 넣지 않습니다.
4. `node --test tests/worker.test.mjs`로 회귀 테스트를 실행합니다.
5. 실제 DB 스키마를 적용하기 전에 올바른 데이터베이스 ID를 확인하고 백업/복구 계획을 세웁니다. 원격 마이그레이션은 별도 확인 후 실행합니다.
6. `npx wrangler deploy --dry-run`과 회귀 테스트가 통과한 뒤에만 배포를 검토합니다. 이번 작업에서는 배포를 실행하지 않습니다.
7. 배포 후 Worker의 Cron Trigger 기록, `/api/supports` 응답, 검색과 공식 공고문 링크를 검증합니다.

> **중요:** `wrangler.jsonc`의 데이터베이스 ID는 의도적으로 자리표시자입니다. 이 상태로는 배포하지 마세요. Cloudflare 계정에 생성된 실제 D1 ID가 있어야 합니다. 자동 갱신은 D1 바인딩과 마이그레이션이 설정되기 전에는 성공하지 않습니다.

### 로컬 회귀 테스트

```bash
node --test tests/worker.test.mjs
```

현재 저장소는 정적 HTML/CSS/JavaScript와 Worker로 구성되어 있어 별도의 번들 빌드 단계는 없습니다. 위 테스트는 Worker 문법/구성, 브라우저 스크립트 파싱 및 API/D1 핵심 경로를 확인합니다. Wrangler 배포 검증은 실제 D1 ID를 설정한 후 수행해야 합니다.
