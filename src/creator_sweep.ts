import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ZodError } from "zod";
import { callInfrai, InfraiError } from "./infrai.js";
import { expiredKeys, sweepRequest } from "./sweep_policy.js";

const bucket = process.env.CREATOR_BUCKET;
if (!bucket) throw new Error("Set CREATOR_BUCKET");

async function serve(): Promise<void> {
  createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/sweep") {
      res.writeHead(404).end();
      return;
    }
    try {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1_000_000) { res.writeHead(413).end(); return; }
      }
      const source = raw.trim() && raw.trim() !== "{}" ? raw : await readFile(process.env.SWEEP_MANIFEST ?? "sweep.json", "utf8");
      const input = sweepRequest.parse(JSON.parse(source));
      if (input.bucket !== bucket) { res.writeHead(400).end(JSON.stringify({ error: "Bucket mismatch" })); return; }
      const keys = expiredKeys(input);
      if (keys.length) {
        const fingerprint = createHash("sha256").update(JSON.stringify([input.sweep_id, input.bucket, keys])).digest("hex");
        await callInfrai(`/v1/storage/object/delete_batch/${encodeURIComponent(input.bucket)}`, {
          keys, idempotency_key: fingerprint
        });
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ sweep_id: input.sweep_id, deleted_keys: keys }));
    } catch (error) {
      const status = error instanceof ZodError || error instanceof SyntaxError ? 400
        : error instanceof InfraiError && error.status >= 400 && error.status < 500 ? error.status : 502;
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }));
    }
  }).listen(Number(process.env.PORT ?? 3000), () => console.log("Sweep webhook listening"));
}

await callInfrai("/v1/storage/bucket/create", {
  name: bucket,
  idempotency_key: createHash("sha256").update(`creator-record-sweep:${bucket}`).digest("hex")
});
await serve();
