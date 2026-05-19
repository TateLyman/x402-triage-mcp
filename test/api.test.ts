import assert from "node:assert/strict";
import { test } from "node:test";
import { servicePaths, summarizeForText, watch402Index } from "../src/api.js";

test("service paths expose paid handoff URLs", () => {
  const paths = servicePaths();

  assert.equal(paths.paid_triage_endpoint, "https://the402.tateprograms.com/api/x402/triage");
  assert.equal(paths.paid_index_watch_endpoint, "https://the402.tateprograms.com/api/x402/index-watch");
  assert.equal(paths.service_catalog, "https://tateprograms.com/services.json");
});

test("summary includes findings and paid paths", () => {
  const text = summarizeForText({
    ok: true,
    checked_at: "2026-05-19T00:00:00.000Z",
    response: { status: 402 },
    x402: { challenge_like: true, accepts_count: 1 },
    findings: ["Payment challenge returned before content."]
  });

  assert.match(text, /response\.status: 402/);
  assert.match(text, /x402\.challenge_like: true/);
  assert.match(text, /Payment challenge returned before content/);
  assert.match(text, /paid paths:/);
});

test("watch402Index can use a mocked index API", async () => {
  const original = process.env.X402_INDEX_API_URL;
  const server = await startJsonServer({
    total: 1,
    services: [
      {
        id: "svc_1",
        name: "Example API",
        url: "https://api.example.com/x402",
        health: "down",
        payment_valid: false,
        domain_verified: false
      }
    ]
  });

  try {
    process.env.X402_INDEX_API_URL = server.url;
    const result = await watch402Index({ q: "example", limit: 5 });

    assert.equal(result.ok, true);
    assert.equal(result.total, 1);
    assert.deepEqual(result.summary, {
      total: 1,
      healthy: 0,
      degraded: 0,
      down: 1,
      unknown: 0,
      payment_invalid: 1,
      domain_unverified: 1
    });
    assert.ok(Array.isArray(result.findings));
  } finally {
    if (original === undefined) {
      delete process.env.X402_INDEX_API_URL;
    } else {
      process.env.X402_INDEX_API_URL = original;
    }
    await server.close();
  }
});

async function startJsonServer(payload: unknown): Promise<{ url: string; close: () => Promise<void> }> {
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(payload));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    url: `http://127.0.0.1:${address.port}/services`,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}
