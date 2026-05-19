# x402-triage-mcp

[![ci](https://github.com/TateLyman/x402-triage-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/TateLyman/x402-triage-mcp/actions/workflows/ci.yml)

MCP server for no-payment x402 surface triage, 402 Index health checks, and paid review handoff.

It exposes three MCP tools:

- `triage_x402_surface` checks one public x402, MPP, Pay.sh, OpenAPI, manifest, or HTTP 402 endpoint through the Tate Programs public triage API.
- `watch_402_index` searches public 402 Index metadata for provider health, payment-validity, and domain-verification signals.
- `x402_paid_paths` returns the paid x402 API endpoints, service catalog, AgentCard, and fixed-scope review links.

The tools do not send `X-PAYMENT`, wallet signatures, API keys, private credentials, or paid calls.

Tool page: https://tateprograms.com/x402-surface-check.html

Paid x402 API catalog: https://tateprograms.com/services.json

AgentCard: https://the402.tateprograms.com/.well-known/agent-card.json

## Install

Run directly with `npx`:

```bash
npx --yes x402-triage-mcp
```

## MCP Config

Add this server to an MCP client that supports stdio servers:

```json
{
  "mcpServers": {
    "x402-triage": {
      "command": "npx",
      "args": ["--yes", "--package", "x402-triage-mcp", "x402-triage-mcp"]
    }
  }
}
```

STDIO MCP client config launches a local command. Review the `command`, `args`, and any `env` values before running generated configs, and pin versions when repeatability matters.

## Tools

### `triage_x402_surface`

```json
{
  "url": "https://api.example.com/.well-known/x402",
  "method": "GET",
  "origin": "https://app.example.com"
}
```

Returns status, payment headers, parsed challenge summary, attack-class checks, findings, and paid handoff paths.

### `watch_402_index`

```json
{
  "q": "example.com",
  "protocol": "x402",
  "limit": 10
}
```

Returns matching public 402 Index records, health summary, visible launch blockers, and paid handoff paths.

### `x402_paid_paths`

Returns:

- `https://the402.tateprograms.com/api/x402/triage`
- `https://the402.tateprograms.com/api/x402/index-watch`
- `https://tateprograms.com/services.json`
- `https://tateprograms.com/x402-five-attack-review.html`
- `https://tateprograms.com/x402-fix-sprint.html`

## Safety Boundary

Use this server only on public launch surfaces that you own or are authorized to inspect. Do not submit private URLs, tokenized URLs, customer data, wallet seed phrases, or production secrets.

## Development

```bash
npm install
npm run check
```
