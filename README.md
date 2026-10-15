# 정부지원금 검색 — 운영 자동 갱신 작업 브랜치

## 이번 변경 사항

- 기존 정적 페이지, 디자인, 검색 필터와 공식 공고문 링크는 그대로 유지합니다.
- `/api/supports`는 D1 데이터가 있으면 저장된 공고를 반환하고, D1 미설정 또는 데이터가 없는 초기 상태에서는 기존 실시간 API 조회로 대체합니다.
- `migrations/0001_create_support_announcements.sql`은 공고 저장 테이블과 검색 보조 인덱스를 생성합니다.
- Worker의 `scheduled()`는 기업마당 API를 페이지 단위로 수집하고, 공고 ID 기준 upsert로 D1에 저장합니다.
- API 수집이 실패하거나 유효 공고가 0건이면 기존 D1 데이터를 삭제하지 않습니다. 전체 페이지 수집과 upsert가 모두 성공한 경우에만 원본에서 사라진 오래된 공고를 정리합니다.
- 원본 총건수가 10,000건을 넘거나 페이지 한도 내에서 수집 완료 여부를 확인할 수 없으면 동기화를 중단하고 기존 데이터를 유지합니다.
- Cron은 `15 18 * * *` UTC, 즉 한국 시간 기준 매일 오전 3시 15분에 실행하도록 설정합니다.
- `tests/worker.test.mjs`에는 코드 파싱, API 대체 경로, 인증키 누락, D1 upsert 동작 테스트가 포함되어 있습니다.

## 배포 전 필수 설정 — 아직 배포하지 마세요

1. Cloudflare 대시보드에서 D1 데이터베이스 `government-support-search-db`를 생성합니다.
2. 생성된 실제 데이터베이스 ID로 `wrangler.jsonc`의 `REPLACE_WITH_D1_DATABASE_ID`를 교체합니다.
3. 기존 Worker의 Secret `DATA_GO_KR_SERVICE_KEY`가 유지되는지 확인합니다. 인증키 값은 GitHub에 넣지 않습니다.
4. 로컬에서 `npx wrangler d1 migrations apply government-support-search-db --local`로 마이그레이션을 시험하고, 배포 전 운영 DB에 적용할 계획을 확인합니다.
5. 실제 데이터베이스에 적용할 때는 `npx wrangler d1 migrations apply government-support-search-db --remote`를 사용합니다. 이 명령은 원격 DB 스키마를 변경하므로, 올바른 DB ID와 백업/복구 계획을 확인한 후에만 실행합니다.
6. `npx wrangler deploy` 실행 전 `npx wrangler deploy --dry-run` 및 테스트를 통과시킵니다. 이번 작업에서는 배포를 실행하지 않습니다.
7. 배포 후 Worker의 Cron Trigger 기록, `/api/supports` 응답, 검색과 공식 공고문 링크를 검증합니다.

> **중요:** `wrangler.jsonc`의 데이터베이스 ID는 의도적으로 자리표시자입니다. 이 상태로는 배포하지 마세요. Cloudflare 계정에 생성된 실제 D1 ID가 있어야 합니다. 자동 갱신은 D1 바인딩과 마이그레이션이 설정되기 전에는 성공하지 않습니다.

## 검증 명령

```bash
node --test tests/worker.test.mjs
```

현재 저장소는 정적 HTML/CSS/JavaScript와 Worker로 구성되어 있어 기존의 별도 번들 빌드 단계는 없습니다. 위 테스트는 Worker 문법/구성, 브라우저 스크립트 파싱 및 API/D1 핵심 경로를 확인합니다. Wrangler 배포 검증은 실제 D1 ID를 설정한 후 수행해야 합니다.

## API 및 운영 조건

- API: [중소벤처기업부_중소기업 지원사업 공고 조회 서비스](https://www.data.go.kr/data/15157820/openapi.do)
- 개발계정은 해당 API의 신청 트래픽 한도 안에서 사용합니다. 실제 공개 운영 전 공공데이터포털에서 운영계정 신청 조건과 승인된 호출 한도를 확인하세요.
- API 인증키는 Cloudflare Secret `DATA_GO_KR_SERVICE_KEY`에만 보관합니다.
- Cron Trigger는 UTC 기준으로 실행됩니다. 현재 설정은 한국 시간 매일 오전 3시 15분입니다.
