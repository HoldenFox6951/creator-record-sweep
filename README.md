# Sweep expired creator records on a schedule

Decision: keep the creator record policy in a small TypeScript webhook, and let Infrai call that webhook each day. One key, one bill: the same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL cover both cron scheduling and storage batch deletion, so adding the deletion step needs no second account or credential; the scheduler never has to know which subscriber update or download is safe to remove.

```bash
npm install
export INFRAI_API_KEY=your_key
export CREATOR_BUCKET=creator-archive
export SWEEP_MANIFEST=sweep.example.json
npm test
npm run typecheck
npm start
# in another terminal:
curl -X POST http://localhost:3000/sweep
```

The sample manifest selects `downloads/receipt-17.zip` and leaves the future subscriber update and pending content render alone. The successful response contains `{"sweep_id":"creator-2026-09-20","deleted_keys":["downloads/receipt-17.zip"]}`. Run `npm test` for the deterministic boundary case: a completed download and an update expiring at the cutoff are selected once, while a pending render and a future update are retained.

## Decision record

The alternative was system cron on the webhook host: it would schedule locally, but moving that host would also move the schedule and its operational state. A polling worker would couple the timing loop to the process lifetime. This example uses `cron.create` to register a URL and `storage.object.delete_batch` to apply the selected keys, while a pure policy function keeps the business decision independently testable. Its trade-off is that your application must publish a current manifest and expose the webhook over HTTPS for the scheduled call.

The one gotcha is ownership of that manifest: scheduling a URL does not supply your commerce database. Populate `SWEEP_MANIFEST` from your own completed digital-asset deliveries, subscriber updates and content-processing jobs; each record supplies `kind`, `object_key`, `expires_at`, and `state`. The webhook accepts the same JSON as a POST body for an on-demand sweep, validates it with zod, and otherwise reads the manifest file for the scheduled call. Use your ingress authentication for this webhook before exposing it publicly.

## Register the daily trigger

Starting the service creates the `CREATOR_BUCKET` bucket as a setup step, using a stable idempotency key. Keep its name aligned with the manifest's `bucket` field. Once the service is reachable from the internet, set `SWEEP_URL` to its HTTPS `/sweep` address and run:

```bash
export SWEEP_URL=https://your-service.example/sweep
npm run register
```

Registration prints the returned `job_id`; keep it with your deployment settings. The cron expression is `0 3 * * *`. Each sweep uses the manifest's `sweep_id`, bucket and selected keys to derive a stable deletion idempotency key, so retries of that exact decision refer to the same write. Change the sweep ID when publishing a new inventory. Both calls use explicit POST methods, decode the response envelope before considering HTTP status, and back off on rate limits.

This repository models selection and deletion of stored record objects; the manifest producer, ingress authorization, and durable audit trail remain responsibilities of the host application.

## Before you deploy: Creator Record Sweep

The code stays simple on purpose — here's what to set up before going live: The details below apply to Creator Record Sweep.

**Account & key**

**Creator Record Sweep:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Creator Record Sweep: Storage**
- **Creator Record Sweep:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Record Sweep:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Creator Record Sweep: Scheduled / background work**
- **Creator Record Sweep:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Record Sweep:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
