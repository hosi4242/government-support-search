import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerSource = await readFile(new URL("../_worker.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../assets/app.js", import.meta.url), "utf8");
const configSource = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const worker = await import("data:text/javascript;base64," + Buffer.from(workerSource).toString("base64"));

const apiPayload = (items, totalCount = items.length) => ({
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE" },
    body: { totalCount, items: { item: items } }
  }
});
const apiRow = (id, title) => ({
  pblancId: id,
  pblancNm: title,
  bsnsSumryCn: title + " 요약",
  pblancCn: "<p>상세 공고문 본문</p>",
  suptTrgt: "소상공인",
  suptInstNm: "테스트 기관",
  reqstBeginEndDe: "2026-10-01 ~ 2026-12-31",
  pblancUrl: "https://example.com/" + id
});

test("worker, browser script, and Wrangler configuration parse", () => {
  assert.doesNotThrow(() => new Function(appSource));
  const config = JSON.parse(configSource);
  assert.equal(config.name, "government-support-search");
  assert.equal(config.d1_databases[0].binding, "SUPPORTS_DB");
  assert.equal(config.d1_databases[0].database_id, "13937fd6-0de1-4f3d-bd79-6d65fe6068d5");
  assert.match(workerSource, /detail, target/);
  assert.deepEqual(config.triggers.crons, ["15 18 * * *"]);
  assert.match(workerSource, /async scheduled\(/);
});

test("API route keeps a live API fallback and returns normalized items", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(apiPayload([apiRow("A1", "테스트 지원사업")])), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
  try {
    const response = await worker.default.fetch(new Request("https://site.example/api/supports"), {
      DATA_GO_KR_SERVICE_KEY: "test-key"
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.items[0].id, "A1");
    assert.equal(body.items[0].title, "테스트 지원사업");
    assert.equal(body.items[0].detail, "<p>상세 공고문 본문</p>");
    assert.equal(body.items[0].scope, "small");
    assert.equal(body.items[0].url, "https://example.com/A1");
    assert.equal(body.dataMode, "live");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing API secret returns a safe configuration error", async () => {
  const response = await worker.default.fetch(new Request("https://site.example/api/supports"), {});
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.code, "API_NOT_CONFIGURED");
  assert.doesNotMatch(JSON.stringify(body), /test-key|serviceKey=/i);
});

test("scheduled sync paginates, upserts rows, and never deletes existing data", async () => {
  const originalFetch = globalThis.fetch;
  const allRows = Array.from({ length: 101 }, (_, index) => apiRow("A" + (index + 1), "지원사업 공고 " + (index + 1)));
  const requestedPages = [];
  globalThis.fetch = async (input) => {
    const pageNo = Number(new URL(String(input)).searchParams.get("pageNo"));
    requestedPages.push(pageNo);
    const rows = allRows.slice((pageNo - 1) * 100, pageNo * 100);
    return new Response(JSON.stringify(apiPayload(rows, allRows.length)), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const batches = [];
  const cleanupRuns = [];
  const db = {
    prepare(sql) {
      return {
        async run() {
          cleanupRuns.push({ sql, values: [] });
          return { success: true };
        },
        bind(...values) {
          return {
            sql,
            values,
            async run() {
              cleanupRuns.push({ sql, values });
              return { success: true };
            }
          };
        }
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    }
  };
  try {
    await worker.default.scheduled({ cron: "15 18 * * *" }, {
      DATA_GO_KR_SERVICE_KEY: "test-key",
      SUPPORTS_DB: db
    });
    assert.deepEqual(requestedPages, [1, 2]);
    assert.equal(batches.length, 3);
    assert.equal(batches[0].length, 50);
    assert.equal(batches[1].length, 50);
    assert.equal(batches[2].length, 1);
    assert.match(batches[0][0].sql, /ON CONFLICT\(id\) DO UPDATE/);
    assert.doesNotMatch(batches[0][0].sql, /DELETE FROM/i);
    assert.equal(batches[0][0].values[0], "A1");
    assert.equal(batches[0][1].values[0], "A2");
    assert.equal(batches[2][0].values[0], "A101");
    assert.equal(cleanupRuns.length, 2);
    assert.match(cleanupRuns[0].sql, /CREATE TABLE IF NOT EXISTS support_announcements/);
    assert.match(cleanupRuns[1].sql, /DELETE FROM support_announcements WHERE fetched_at < \?/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scheduled sync refuses to run without D1 and reports setup requirement", async () => {
  await assert.rejects(
    worker.default.scheduled({ cron: "15 18 * * *" }, { DATA_GO_KR_SERVICE_KEY: "test-key" }),
    /SUPPORTS_DB D1 binding is not configured/
  );
});
