#!/usr/bin/env node

/**
 * SmallMetrics MCP SSE to Stdio Proxy
 * 
 * This script connects to the SmallMetrics Django MCP server via SSE,
 * and proxies all JSON-RPC messages back and forth through standard IO,
 * allowing clients like Claude Desktop, Cursor, or Antigravity IDE to consume it natively.
 */

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

/**
 * Creates a JSON-RPC 2.0 error response for a failed request.
 *
 * @param id - Request ID from the incoming message
 * @param message - Human-readable error description
 * @param code - JSON-RPC error code (default: -32603 Internal error)
 * @returns Formatted JSONRPCMessage
 */
export function createJsonRpcErrorResponse(
  id: string | number,
  message: string,
  code = -32603
): JSONRPCMessage {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

/**
 * Checks if a message is a JSON-RPC request that expects a response.
 *
 * @param message - The incoming JSON-RPC message
 * @returns True if message has a valid id (number or string)
 */
export function isRequestWithMessageId(
  message: JSONRPCMessage
): message is JSONRPCMessage & { id: string | number } {
  return (
    typeof message === "object" &&
    message !== null &&
    "id" in message &&
    (typeof (message as { id?: unknown }).id === "string" ||
      typeof (message as { id?: unknown }).id === "number")
  );
}

/**
 * Checks if an error represents an expired or lost session on the MCP server (HTTP 404).
 *
 * @param error - The caught error
 * @returns True if the session was not found on the backend
 */
export function isSessionLostError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("404") || message.includes("Could not find session");
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

    // Prevent zombie processes: when IDE parent closes stdin, terminate immediately
    process.stdin.on("end", () => {
      console.error("Stdin stream ended by parent process. Exiting.");
      process.exit(0);
    });
    process.stdin.on("close", () => {
      console.error("Stdin stream closed. Exiting.");
      process.exit(0);
    });

    // Pipe messages from IDE to Django with immediate error response handling
    stdioTransport.onmessage = async (message: JSONRPCMessage) => {
      try {
        await sseTransport.send(message);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Failed to send message to SSE:", errorMsg);

        // If this message expects a response (has id), immediately return a JSON-RPC error
        // to prevent the IDE from hanging for 3 minutes waiting for a response.
        if (isRequestWithMessageId(message)) {
          const errorResponse = createJsonRpcErrorResponse(
            message.id,
            `SmallMetrics MCP error: ${errorMsg}`
          );
          await stdioTransport.send(errorResponse).catch((sendErr: unknown) => {
            console.error("Failed to deliver JSON-RPC error to stdio:", sendErr);
          });
        }

        // If the backend session has expired or the server was restarted (HTTP 404),
        // continuing to run with this dead session will cause all future calls to fail.
        // Terminate the process cleanly so the IDE host process can launch a fresh instance.
        if (isSessionLostError(err)) {
          console.error(
            "MCP session was lost on backend (HTTP 404). Terminating proxy to allow IDE to reinitialize clean session."
          );
          process.exit(1);
        }
      }
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
      // If authentication failed, exit immediately so the user can fix the token
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        console.error("Authentication failed against SmallMetrics API. Check your AUTHORIZATION token.");
        process.exit(1);
      }
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

const isMainModule = (): boolean => {
  if (!process.argv[1]) return false;
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const invokedFile = realpathSync(process.argv[1]);
    return currentFile === invokedFile;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  main().catch((error) => {
    console.error("Fatal proxy error:", error);
    process.exit(1);
  });
}
