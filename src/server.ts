#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { servicePaths, summarizeForText, triageSurface, watch402Index } from "./api.js";

const server = new McpServer({
  name: "x402-triage-mcp",
  version: readPackageVersion()
});

server.registerTool(
  "triage_x402_surface",
  {
    title: "Triage x402 payment surface",
    description: [
      "Run a no-payment external pass against one public x402, MPP, Pay.sh, OpenAPI, manifest, or HTTP 402 endpoint.",
      "The tool calls the Tate Programs public triage API and returns status, payment headers, parsed challenge shape, attack-class checks, cache/CORS notes, and paid review handoff.",
      "It does not send X-PAYMENT, wallet signatures, API keys, private tokens, or paid calls."
    ].join(" "),
    inputSchema: {
      url: z.string().url().describe("Public HTTPS manifest, OpenAPI file, paid endpoint, or discovery URL to review."),
      method: z.enum(["GET", "POST", "OPTIONS"]).default("GET").describe("No-payment probe method. Use POST only for endpoints that intentionally expose a public paid POST route."),
      origin: z.string().url().optional().describe("Optional browser Origin for CORS/payment-header readability checks.")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url, method, origin }) => {
    const result = await triageSurface({ url, method, origin });

    return {
      content: [
        {
          type: "text",
          text: summarizeForText(result)
        }
      ],
      structuredContent: result
    };
  }
);

server.registerTool(
  "watch_402_index",
  {
    title: "Watch 402 Index listings",
    description: [
      "Look up public 402 Index service records by provider, domain, endpoint URL, or search term.",
      "Use this before listing, outreach, launch review, or re-check work to spot down services, invalid payment requirements, and unverified domains.",
      "This is public metadata only and does not send payment headers or paid calls."
    ].join(" "),
    inputSchema: {
      q: z.string().min(1).describe("402 Index search term, provider name, domain, service URL, or endpoint URL."),
      protocol: z.enum(["x402", "L402", "MPP"]).default("x402").describe("Protocol filter."),
      health: z.enum(["healthy", "degraded", "down", "unknown"]).optional().describe("Optional health filter."),
      limit: z.number().min(1).max(50).default(10).describe("Maximum records to return.")
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ q, protocol, health, limit }) => {
    const result = await watch402Index({ q, protocol, health, limit });

    return {
      content: [
        {
          type: "text",
          text: summarizeForText(result)
        }
      ],
      structuredContent: result
    };
  }
);

server.registerTool(
  "x402_paid_paths",
  {
    title: "Return x402 paid API paths",
    description: "Return the Tate Programs paid x402 API endpoints, service catalog, AgentCard, and fixed-scope review handoff URLs.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async () => {
    const paths = servicePaths();

    return {
      content: [
        {
          type: "text",
          text: [
            "x402 paid paths:",
            `- paid_triage_endpoint: ${paths.paid_triage_endpoint}`,
            `- paid_index_watch_endpoint: ${paths.paid_index_watch_endpoint}`,
            `- service_catalog: ${paths.service_catalog}`,
            `- paid_review: ${paths.paid_review}`,
            `- fix_sprint: ${paths.fix_sprint}`
          ].join("\n")
        }
      ],
      structuredContent: paths
    };
  }
);

server.registerResource(
  "usage",
  "x402-triage://usage",
  {
    title: "x402 Triage MCP usage",
    description: "How to use x402-triage-mcp safely.",
    mimeType: "text/markdown"
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: [
          "# x402 Triage MCP",
          "",
          "Use this server on public x402, MPP, Pay.sh, OpenAPI, manifest, or registry surfaces that you own or are authorized to inspect.",
          "",
          "Typical calls:",
          "",
          "```json",
          "{\"url\":\"https://api.example.com/.well-known/x402\",\"method\":\"GET\",\"origin\":\"https://app.example.com\"}",
          "```",
          "",
          "```json",
          "{\"q\":\"example.com\",\"protocol\":\"x402\",\"limit\":10}",
          "```",
          "",
          "The tools do not send payment headers, wallet signatures, private credentials, or paid calls."
        ].join("\n")
      }
    ]
  })
);

function readPackageVersion(): string {
  const packageJsonUrl = new URL("../../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: unknown };

  return typeof packageJson.version === "string" ? packageJson.version : "unknown";
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
