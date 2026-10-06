import { createHash } from "node:crypto";
import { callInfrai } from "./infrai.js";

const task = process.env.SWEEP_URL;
if (!task) throw new Error("Set SWEEP_URL");

const idempotencyKey = createHash("sha256").update(`creator-record-sweep:${task}`).digest("hex");
const job = await callInfrai<{ job_id: string }>("/v1/cron/create", {
  task,
  name: "creator-record-sweep",
  cron_expr: "0 3 * * *",
  timezone: "UTC",
  idempotency_key: idempotencyKey
});

console.log(job.job_id);
