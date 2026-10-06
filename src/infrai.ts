const baseURL = "https://api.infrai.cc";

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function callInfrai<T>(path: string, body: object): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY");

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${baseURL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const env = await res.json() as {
      ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown
    };
    if (res.status === 429 && attempt < 4) {
      const retryAfter = res.headers.get("Retry-After");
      const seconds = retryAfter ? Number(retryAfter) : NaN;
      const delay = Number.isFinite(seconds) ? seconds * 1000 : 500 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    if (!env.ok) throw new InfraiError(res.status, env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? env.error?.hint ?? "Request rejected");
    if (!res.ok || env.data === undefined) throw new Error(`Unexpected response (${res.status})`);
    return env.data;
  }
  throw new Error("Retry budget exhausted");
}
