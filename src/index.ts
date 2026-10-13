#!/usr/bin/env node

/**
 * SmallMetrics MCP SSE to Stdio Proxy
 * 
 * This script connects to the SmallMetrics Django MCP server via SSE,
 * and proxies all JSON-RPC messages back and forth through standard IO,
 * allowing clients like Claude Desktop or Antigravity IDE to consume it natively.
 */

import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { parseConfig } from "./config.js";

async function main() {
  let targetUrl: string;
  let authToken: string;

  try {
    const config = parseConfig(process.argv, process.env);
    targetUrl = config.targetUrl;
    authToken = config.authToken;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
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
      stdioTransport.close();
      process.exit(0);
    };

    stdioTransport.onclose = () => {
      console.error("Stdio connection closed by IDE.");
      sseTransport.close();
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
