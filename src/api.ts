export type JsonObject = Record<string, unknown>;

export type TriageInput = {
  url: string;
  method?: "GET" | "POST" | "OPTIONS";
  origin?: string;
};

export type IndexWatchInput = {
  q: string;
  protocol?: "x402" | "L402" | "MPP";
  health?: "healthy" | "degraded" | "down" | "unknown";
  limit?: number;
};

const DEFAULT_TRIAGE_ENDPOINT = "https://the402.tateprograms.com/api/triage";
const DEFAULT_INDEX_ENDPOINT = "https://402index.io/api/v1/services";
const DEFAULT_TIMEOUT_MS = 8_000;

export function servicePaths() {
  return {
    free_triage_endpoint: envOrDefault("X402_TRIAGE_API_URL", DEFAULT_TRIAGE_ENDPOINT),
    paid_triage_endpoint: "https://the402.tateprograms.com/api/x402/triage",
    paid_index_watch_endpoint: "https://the402.tateprograms.com/api/x402/index-watch",
    service_catalog: "https://tateprograms.com/services.json",
    paid_review: "https://tateprograms.com/x402-five-attack-review.html",
    fix_sprint: "https://tateprograms.com/x402-fix-sprint.html",
    agent_card: "https://the402.tateprograms.com/.well-known/agent-card.json"
  };
}

export async function triageSurface(input: TriageInput): Promise<JsonObject> {
  const body = {
    url: input.url,
    method: input.method || "GET",
    origin: input.origin || undefined
  };

  return postJson(envOrDefault("X402_TRIAGE_API_URL", DEFAULT_TRIAGE_ENDPOINT), body);
}

export async function watch402Index(input: IndexWatchInput): Promise<JsonObject> {
  const params = new URLSearchParams({
    q: input.q,
    protocol: input.protocol || "x402",
    limit: String(clampLimit(input.limit))
  });

  if (input.health) params.set("health", input.health);

  const response = await fetchWithTimeout(`${envOrDefault("X402_INDEX_API_URL", DEFAULT_INDEX_ENDPOINT)}?${params.toString()}`, {
    headers: {
      accept: "application/json",
      "user-agent": "x402-triage-mcp/0.1"
    }
  });

  const data = await readJson(response);
  const services = Array.isArray(data.services)
    ? data.services.slice(0, clampLimit(input.limit)).map(compactIndexService)
    : [];

  return {
    ok: response.ok,
    checked_at: new Date().toISOString(),
    source: "402 Index public API",
    query: {
      q: input.q,
      protocol: input.protocol || "x402",
      health: input.health || null,
      limit: clampLimit(input.limit)
    },
    status: response.status,
    total: typeof data.total === "number" ? data.total : services.length,
    summary: summarizeIndexServices(services),
    findings: buildIndexFindings(services),
    services,
    paid_paths: servicePaths()
  };
}

export function summarizeForText(result: JsonObject): string {
  const lines: string[] = [];
  const ok = typeof result.ok === "boolean" ? result.ok : undefined;
  if (ok !== undefined) lines.push(`ok: ${ok}`);
  if (typeof result.checked_at === "string") lines.push(`checked_at: ${result.checked_at}`);

  const response = isObject(result.response) ? result.response : undefined;
  if (response && typeof response.status === "number") {
    lines.push(`response.status: ${response.status}`);
  } else if (typeof result.status === "number") {
    lines.push(`status: ${result.status}`);
  }

  const x402 = isObject(result.x402) ? result.x402 : undefined;
  if (x402) {
    if (typeof x402.challenge_like === "boolean") lines.push(`x402.challenge_like: ${x402.challenge_like}`);
    if (typeof x402.accepts_count === "number") lines.push(`x402.accepts_count: ${x402.accepts_count}`);
  }

  const summary = isObject(result.summary) ? result.summary : undefined;
  if (summary) {
    lines.push(`summary: ${JSON.stringify(summary)}`);
  }

  const findings = Array.isArray(result.findings) ? result.findings.map(String) : [];
  if (findings.length > 0) {
    lines.push("findings:");
    for (const finding of findings.slice(0, 12)) lines.push(`- ${finding}`);
  }

  const paths = isObject(result.paid_paths) ? result.paid_paths : servicePaths();
  lines.push("paid paths:");
  lines.push(`- review: ${String(paths.paid_review || servicePaths().paid_review)}`);
  lines.push(`- fix_sprint: ${String(paths.fix_sprint || servicePaths().fix_sprint)}`);

  return lines.join("\n");
}

async function postJson(url: string, body: JsonObject): Promise<JsonObject> {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "x402-triage-mcp/0.1"
    },
    body: JSON.stringify(body)
  });

  const data = await readJson(response);
  return {
    ...data,
    paid_paths: servicePaths()
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response: Response): Promise<JsonObject> {
  const text = await response.text();
  const parsed = safeJson(text);

  if (isObject(parsed)) {
    return parsed;
  }

  return {
    ok: response.ok,
    status: response.status,
    body: text.slice(0, 20_000)
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function compactIndexService(service: unknown): JsonObject {
  if (!isObject(service)) return {};

  return {
    id: service.id,
    name: service.name || service.title || service.provider,
    url: service.url || service.endpoint || service.service_url,
    provider: service.provider || service.owner || service.domain,
    protocol: service.protocol,
    health: service.health || service.status,
    payment_valid: service.payment_valid,
    domain_verified: service.domain_verified,
    updated_at: service.updated_at || service.last_seen || service.checked_at
  };
}

function summarizeIndexServices(services: JsonObject[]): JsonObject {
  let healthy = 0;
  let degraded = 0;
  let down = 0;
  let unknown = 0;
  let paymentInvalid = 0;
  let domainUnverified = 0;

  for (const service of services) {
    const health = String(service.health || "").toLowerCase();
    if (health === "healthy") healthy += 1;
    else if (health === "degraded") degraded += 1;
    else if (health === "down") down += 1;
    else unknown += 1;

    if (service.payment_valid === false) paymentInvalid += 1;
    if (service.domain_verified === false) domainUnverified += 1;
  }

  return {
    total: services.length,
    healthy,
    degraded,
    down,
    unknown,
    payment_invalid: paymentInvalid,
    domain_unverified: domainUnverified
  };
}

function buildIndexFindings(services: JsonObject[]): string[] {
  const findings: string[] = [];
  const summary = summarizeIndexServices(services);

  if (summary.total === 0) {
    findings.push("No matching 402 Index services were returned for this query.");
    return findings;
  }

  if (Number(summary.down) > 0) {
    findings.push(`${summary.down} service(s) are marked down in 402 Index.`);
  }
  if (Number(summary.degraded) > 0) {
    findings.push(`${summary.degraded} service(s) are marked degraded in 402 Index.`);
  }
  if (Number(summary.payment_invalid) > 0) {
    findings.push(`${summary.payment_invalid} service(s) do not currently have valid payment requirements according to 402 Index.`);
  }
  if (Number(summary.domain_unverified) > 0) {
    findings.push(`${summary.domain_unverified} service(s) have unverified domains according to 402 Index.`);
  }
  if (findings.length === 0) {
    findings.push("No 402 Index health, payment-validity, or domain-verification blockers were visible in the returned records.");
  }

  return findings;
}

function clampLimit(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 10;
  return Math.min(Math.max(Math.trunc(numberValue), 1), 50);
}

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
