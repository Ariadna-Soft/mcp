import { describe, it } from "node:test";
import assert from "node:assert";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
  it("should parse valid config successfully", () => {
    const argv = ["node", "index.js", "https://api.example.com/sse"];
    const env = { AUTHORIZATION: "Bearer test_token" };
    
    const config = parseConfig(argv, env);
    
    assert.strictEqual(config.targetUrl, "https://api.example.com/sse");
    assert.strictEqual(config.authToken, "Bearer test_token");
  });

  it("should throw error if URL is missing", () => {
    const argv = ["node", "index.js"];
    const env = { AUTHORIZATION: "Bearer test_token" };
    
    assert.throws(() => parseConfig(argv, env), /Missing target SSE URL/);
  });

  it("should throw error if URL is invalid", () => {
    const argv = ["node", "index.js", "not_a_url"];
    const env = { AUTHORIZATION: "Bearer test_token" };
    
    assert.throws(() => parseConfig(argv, env), /Invalid target URL/);
  });

  it("should throw error if AUTHORIZATION is missing", () => {
    const argv = ["node", "index.js", "https://api.example.com/sse"];
    const env = {};
    
    assert.throws(() => parseConfig(argv, env), /Missing AUTHORIZATION/);
  });
});
