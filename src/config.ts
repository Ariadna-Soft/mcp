export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): { targetUrl: string; authToken: string } {
  const targetUrl = argv[2];
  if (!targetUrl) {
    throw new Error("Missing target SSE URL. Usage: npx @smallmetrics/mcp-client <sse_url>");
  }

  try {
    new URL(targetUrl);
  } catch {
    throw new Error(`Invalid target URL: ${targetUrl}`);
  }

  const authToken = env.AUTHORIZATION;
  if (!authToken) {
    throw new Error("Missing AUTHORIZATION environment variable.");
  }

  return { targetUrl, authToken };
}
