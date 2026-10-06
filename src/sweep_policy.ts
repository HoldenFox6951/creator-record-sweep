import { z } from "zod";

export const sweepRequest = z.object({
  sweep_id: z.string().min(1),
  as_of: z.string().datetime(),
  bucket: z.string().min(1),
  records: z.array(z.object({
    kind: z.enum(["digital_asset_delivery", "subscriber_update", "content_processing"]),
    object_key: z.string().min(1),
    expires_at: z.string().datetime(),
    state: z.enum(["complete", "pending"])
  })).max(1000)
});

export type SweepRequest = z.infer<typeof sweepRequest>;

export function expiredKeys(input: SweepRequest): string[] {
  const cutoff = Date.parse(input.as_of);
  return [...new Set(input.records
    .filter(record => record.state === "complete" && Date.parse(record.expires_at) <= cutoff)
    .map(record => record.object_key))].sort();
}
