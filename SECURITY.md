# Security

`x402-triage-mcp` is a defensive MCP server for public x402 launch-surface triage.

Use it only on public manifests, public OpenAPI files, public registry listings, or endpoints you are authorized to inspect. The tools do not send payment headers, wallet signatures, private keys, API keys, or paid calls.

Do not submit private endpoints, tokens in URLs, wallet seed phrases, production secrets, or non-public customer data.

Payment safety checks are advisory and read-only. Real agent-commerce systems should enforce spend cap controls, user approval, recipient allowlist or destination validation, nonce or idempotency replay protection, callback signature verification for webhooks or settlement records, metadata filter and redaction rules for PII or personal data, and a receipt or audit trail with transaction id evidence.

Report security concerns to hello@tateprograms.com.
