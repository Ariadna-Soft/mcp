import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createJsonRpcErrorResponse,
  isRequestWithMessageId,
  isSessionLostError,
} from "./index.js";

describe("JSON-RPC resilience helpers", () => {
  describe("createJsonRpcErrorResponse", () => {
    it("should format standard JSON-RPC 2.0 error with custom message and code", () => {
      const response = createJsonRpcErrorResponse(42, "Failed to connect", -32603);
      assert.deepStrictEqual(response, {
        jsonrpc: "2.0",
        id: 42,
        error: {
          code: -32603,
          message: "Failed to connect",
        },
      });
    });

    it("should default to -32603 error code", () => {
      const response = createJsonRpcErrorResponse("req-1", "Internal error");
      assert.deepStrictEqual(response, {
        jsonrpc: "2.0",
        id: "req-1",
        error: {
          code: -32603,
          message: "Internal error",
        },
      });
    });
  });

  describe("isRequestWithMessageId", () => {
    it("should return true for request with numeric id", () => {
      const msg = { jsonrpc: "2.0", id: 1, method: "tools/list" } as const;
      assert.strictEqual(isRequestWithMessageId(msg), true);
    });

    it("should return true for request with string id", () => {
      const msg = { jsonrpc: "2.0", id: "uuid-abc", method: "tools/call" } as const;
      assert.strictEqual(isRequestWithMessageId(msg), true);
    });

    it("should return false for notifications (without id)", () => {
      const msg = { jsonrpc: "2.0", method: "notifications/initialized" } as const;
      assert.strictEqual(isRequestWithMessageId(msg), false);
    });

    it("should return false for null or invalid objects", () => {
      // @ts-expect-error testing invalid runtime payload
      assert.strictEqual(isRequestWithMessageId(null), false);
      // @ts-expect-error testing invalid runtime payload
      assert.strictEqual(isRequestWithMessageId(undefined), false);
      // @ts-expect-error testing invalid runtime payload
      assert.strictEqual(isRequestWithMessageId("not-an-object"), false);
    });
  });

  describe("isSessionLostError (deprecated backward compatibility)", () => {
    it("should return true when error message contains 404", () => {
      const error = new Error("Error POSTing to endpoint (HTTP 404): Could not find session");
      assert.strictEqual(isSessionLostError(error), true);
    });

    it("should return true when error string mentions session not found", () => {
      const error = "Could not find session for ID: 3145f9e5-2898";
      assert.strictEqual(isSessionLostError(error), true);
    });

    it("should return false for unrelated errors", () => {
      const error = new Error("Connection timeout");
      assert.strictEqual(isSessionLostError(error), false);
    });
  });
});
