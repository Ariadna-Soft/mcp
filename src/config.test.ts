import { describe, it } from "node:test";
import assert from "node:assert";
import { parseConfig } from "./config.js";

describe("parseConfig", () => {
  it("should return action 'help' when --help flag is provided", () => {
    const res = parseConfig(["node", "index.js", "--help"], {});
    assert.deepStrictEqual(res, { action: "help" });
  });

  it("should return action 'help' when -h flag is provided", () => {
    const res = parseConfig(["node", "index.js", "-h"], {});
    assert.deepStrictEqual(res, { action: "help" });
  });

  it("should return action 'version' when --version flag is provided", () => {
    const res = parseConfig(["node", "index.js", "--version"], {});
    assert.deepStrictEqual(res, { action: "version" });
  });

  it("should return action 'version' when -v flag is provided", () => {
    const res = parseConfig(["node", "index.js", "-v"], {});
    assert.deepStrictEqual(res, { action: "version" });
  });

  it("should parse valid config successfully", () => {
    const argv = ["node", "index.js", "https://api.example.com/sse"];
    const env = { AUTHORIZATION: "Bearer test_token" };
    
    const config = parseConfig(argv, env);
    
    assert.strictEqual(config.action, "run");
    if (config.action === "run") {
      assert.strictEqual(config.targetUrl, "https://api.example.com/sse");
      assert.strictEqual(config.authToken, "Bearer test_token");
    }
  });

  it("should throw error if URL is missing and no flags provided", () => {
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
