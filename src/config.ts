/**
 * Configuration and CLI parsing for SmallMetrics MCP client.
 */

/**
 * Result of parsing command line arguments and environment variables.
 */
export type ConfigResult =
  | { action: "help" }
  | { action: "version" }
  | { action: "run"; targetUrl: string; authToken: string };

/**
 * Parses command-line arguments and process environment.
 * 
 * Supports:
 * - `--help` or `-h`: returns action "help"
 * - `--version` or `-v`: returns action "version"
 * - `<targetUrl>` with AUTHORIZATION env var: returns action "run"
 * 
 * @param argv Command line arguments (process.argv)
 * @param env Process environment variables (process.env)
 * @returns ConfigResult discriminated union
 */
export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): ConfigResult {
  const args = argv.slice(2);

  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help" };
  }

  // Check for version flag
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }

  const targetUrl = args[0];
  if (!targetUrl) {
    throw new Error(
      "Missing target SSE URL.\n" +
      "Usage: npx -y @smallmetrics/mcp-client <sse_url>\n" +
      "Try 'smallmetrics-mcp --help' for more options."
    );
  }

  try {
    new URL(targetUrl);
  } catch {
    throw new Error(`Invalid target URL: ${targetUrl}`);
  }

  const authToken = env.AUTHORIZATION;
  if (!authToken) {
    throw new Error(
      "Missing AUTHORIZATION environment variable.\n" +
      "Provide your SmallMetrics personal access token via AUTHORIZATION='Bearer <token>'."
    );
  }

  return { action: "run", targetUrl, authToken };
}
