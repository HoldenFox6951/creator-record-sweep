import assert from "node:assert/strict";
import { test } from "node:test";
import { expiredKeys, sweepRequest } from "./sweep_policy.js";

test("only completed, expired creator records are selected once", () => {
  const input = sweepRequest.parse({
    sweep_id: "sweep-2026-09-20", as_of: "2026-09-20T00:00:00Z", bucket: "creator-archive",
    records: [
      { kind: "digital_asset_delivery", object_key: "downloads/old.zip", expires_at: "2026-09-19T00:00:00Z", state: "complete" },
      { kind: "subscriber_update", object_key: "updates/old.json", expires_at: "2026-09-20T00:00:00Z", state: "complete" },
      { kind: "content_processing", object_key: "jobs/active.json", expires_at: "2026-09-18T00:00:00Z", state: "pending" },
      { kind: "digital_asset_delivery", object_key: "downloads/old.zip", expires_at: "2026-09-19T00:00:00Z", state: "complete" },
      { kind: "subscriber_update", object_key: "updates/fresh.json", expires_at: "2026-09-21T00:00:00Z", state: "complete" }
    ]
  });
  assert.deepEqual(expiredKeys(input), ["downloads/old.zip", "updates/old.json"]);
});
