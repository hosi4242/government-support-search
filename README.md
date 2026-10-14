# 지원금 찾기 — Cloudflare Pages 운영 준비

정적 HTML/CSS/JavaScript 사이트이며, 공고 API는 Cloudflare Pages Function을 통해 서버 측에서 호출합니다. 브라우저 코드에 서비스 키를 넣지 않습니다.

## 배포 설정
- Framework preset: `None`
- Build command: `exit 0`
- Build output directory: `.` (저장소 루트)
- Root directory: 비워두기
- Production branch: `main` (기능 브랜치 검토 후 병합)

## 공공데이터 API 연결 (필수)
공공데이터포털의 [중소벤처기업부_중소기업 지원사업 공고 조회 서비스](https://www.data.go.kr/data/15157820/openapi.do)를 활용 신청하세요. 이 API는 최신 중앙부처·지자체·유관기관 지원사업 공고 정보를 제공하며, 일간 갱신됩니다. 이용 범위는 출처표시·변경금지(공공저작물 제3유형)이며, 개발단계 자동승인과 운영단계 심의승인이 표시되어 있으므로 **운영 공개 전 운영단계 승인 여부를 확인**해야 합니다.

Cloudflare 대시보드 → Workers & Pages → 해당 Pages 프로젝트 → Settings → Variables and Secrets에서 다음을 설정하고 재배포하세요.

| 이름 | 종류 | 값 |
|---|---|---|
| `SUPPORT_API_ENDPOINT` | Variable | 공공데이터포털 API 상세 화면의 정확한 요청 URL(기능 선택 후 확인) |
| `DATA_GO_KR_SERVICE_KEY` | **Encrypt / Secret** | 발급받은 서비스 키(디코딩된 원문 키 권장) |
| `SUPPORT_API_KEY_PARAM` | Variable (선택) | 기본값 `serviceKey`; API 명세의 인증키 파라미터가 다르면 변경 |
| `SUPPORT_API_FORMAT_PARAM` | Variable (선택) | 기본값 `_type`; API 명세에 따라 `type` 등으로 변경 |
| `SUPPORT_API_PAGE_PARAM` | Variable (선택) | 기본값 `pageNo` |
| `SUPPORT_API_SIZE_PARAM` | Variable (선택) | 기본값 `numOfRows` |

API 요청 URL은 API 명세에 나온 **요청주소/기능별 URL**을 사용해야 하며, 데이터셋 소개 페이지 URL 자체를 넣으면 안 됩니다. 이 사이트는 JSON 응답을 기대합니다. API가 JSON을 지원하지 않으면 응답 형식 파라미터를 명세에 맞춰 조정하세요.

현재 사이트는 키가 없거나 API가 실패할 경우 예시 공고를 대신 보여주지 않고 오류 안내를 표시합니다. 운영 키를 설정하기 전에는 실제 공고가 표시되지 않습니다.

## 검색엔진 노출
- `robots.txt`는 크롤링을 허용하고 sitemap 경로를 알립니다.
- `sitemap.xml`은 현재 기본 도메인 `https://government-support-search.pages.dev` 기준입니다. Cloudflare Pages의 실제 주소 또는 사용자 지정 도메인이 다르면 robots.txt와 sitemap.xml의 도메인을 함께 바꾸세요.
- Google Search Console과 네이버 서치어드바이저에 실제 배포 도메인을 등록하고 sitemap을 제출하세요.
- 크롤링 허용이 색인이나 순위를 보장하지는 않습니다. 실제 도메인, 유효한 공고 링크, 운영자 연락처, 개인정보처리방침을 확인하세요.

## 중요한 운영 점검
1. API 인증키를 HTML/JS, GitHub 파일, 공개 이슈에 절대 입력하지 마세요.
2. 공공데이터포털의 이용 조건과 운영단계 승인 상태를 확인하세요.
3. 각 결과의 공식 공고 링크, 지원대상, 신청 기간을 원문과 대조하세요. API 응답 필드 이름이 데이터셋 명세와 다르면 `functions/api/supports.js`의 필드 별칭을 조정해야 합니다.
4. `contact.html`와 `privacy.html`의 운영자 이메일 자리표시자를 실제 연락처 및 운영 방식에 맞게 수정하세요.
5. 현재 검색 결과는 브라우저에서 API를 조회해 표시합니다. 정적 페이지에 결과별 서버 렌더링 URL을 생성하지 않으므로 검색엔진은 개별 공고를 색인하지 않을 수 있습니다. 우선 서비스 소개·검색 랜딩 페이지를 색인 대상으로 둡니다.

## 파일 구조
- `index.html`: 통합검색
- `small-business.html`: 소상공인 검색
- `guide.html`, `about.html`, `sources.html`, `privacy.html`, `contact.html`: 안내 페이지
- `assets/app.js`: API 결과 필터 및 카드 표시
- `functions/api/supports.js`: API 키를 숨기는 서버 측 프록시
- `robots.txt`, `sitemap.xml`: 검색엔진 설정
