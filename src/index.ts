#!/usr/bin/env node

/**
 * SmallMetrics MCP SSE to Stdio Proxy
 * 
 * This script connects to the SmallMetrics Django MCP server via SSE,
 * and proxies all JSON-RPC messages back and forth through standard IO,
 * allowing clients like Claude Desktop, Cursor, or Antigravity IDE to consume it natively.
 */

import { readFileSync } from "node:fs";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { parseConfig } from "./config.js";

/**
 * Reads the package version from package.json located adjacent to dist/.
 */
function getPackageVersion(): string {
  try {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const content = readFileSync(pkgUrl, "utf-8");
    const parsed = JSON.parse(content) as { version?: string };
    return parsed.version ?? "1.0.0";
  } catch {
    return "1.0.0";
  }
}

/**
 * Prints helpful CLI documentation to stdout.
 */
function printHelp(): void {
  console.log(`
SmallMetrics MCP Client (SSE to Stdio Proxy)

Usage:
  npx -y @smallmetrics/mcp-client <sse_url>
  smallmetrics-mcp <sse_url>

Arguments:
  <sse_url>    Target Server-Sent Events (SSE) endpoint of SmallMetrics MCP server
               (e.g., https://api.smallmetrics.ai/api/v1/mcp/sse)

Options:
  -h, --help       Show this help message and exit
  -v, --version    Show version number and exit

Environment Variables:
  AUTHORIZATION    Required Bearer token for authenticating with the SmallMetrics API
                   Format: "Bearer <your_pat_or_service_token>"
  DEBUG            Set to "true" or "1" for verbose connection logs

Examples:
  AUTHORIZATION="Bearer sm_pat_..." npx -y @smallmetrics/mcp-client https://api.smallmetrics.ai/api/v1/mcp/sse

For more documentation, visit: https://github.com/Ariadna-Soft/mcp
`);
}

async function main(): Promise<void> {
  let targetUrl: string;
  let authToken: string;

  try {
    const config = parseConfig(process.argv, process.env);

    if (config.action === "help") {
      printHelp();
      process.exit(0);
    }

    if (config.action === "version") {
      console.log(getPackageVersion());
      process.exit(0);
    }

    targetUrl = config.targetUrl;
    authToken = config.authToken;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }

  try {
    const url = new URL(targetUrl);
    
    // Initialize SSE Client Transport (Connecting to Django Backend)
    const sseTransport = new SSEClientTransport(url, {
      requestInit: {
        headers: {
          "Authorization": authToken,
        }
      }
    });

    // Initialize Stdio Server Transport (Connecting to IDE/Claude)
    const stdioTransport = new StdioServerTransport();

    // Pipe messages from IDE to Django
    stdioTransport.onmessage = (message: JSONRPCMessage) => {
      sseTransport.send(message).catch((err: unknown) => {
        console.error("Failed to send message to SSE:", err);
      });
    };

    // Pipe messages from Django to IDE
    sseTransport.onmessage = (message: JSONRPCMessage) => {
      stdioTransport.send(message).catch((err: unknown) => {
        console.error("Failed to send message to Stdio:", err);
      });
    };

    // Handle closures
    sseTransport.onclose = () => {
      console.error("SSE connection closed by backend.");
      stdioTransport.close().catch(() => {});
      process.exit(0);
    };

    stdioTransport.onclose = () => {
      console.error("Stdio connection closed by IDE.");
      sseTransport.close().catch(() => {});
      process.exit(0);
    };

    // Handle errors
    sseTransport.onerror = (error: Error) => {
      console.error("SSE Transport Error:", error.message);
    };

    stdioTransport.onerror = (error: Error) => {
      console.error("Stdio Transport Error:", error.message);
    };

    // Start transports: SSE first so backend is connected before IDE starts sending
    await sseTransport.start();
    await stdioTransport.start();

    // Graceful shutdown on OS signals (Ctrl+C, termination)
    const handleSignal = () => {
      stdioTransport.close().catch(() => {});
      sseTransport.close().catch(() => {});
      process.exit(0);
    };

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
    
    // Log success (masking token for security context)
    const maskedToken = authToken.length > 15 ? authToken.substring(0, 15) + "..." : "***";
    console.error(`Successfully connected to ${targetUrl} (Auth: ${maskedToken})`);

  } catch (error: unknown) {
    console.error("Failed to initialize MCP proxy:");
    console.error(error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal proxy error:", error);
  process.exit(1);
});
