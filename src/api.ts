export type ApiRetryOptions = {
  retries?: number;
  delayMs?: number;
  retryOnStatus?: number[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function sleepMs(ms: number) {
  return sleep(ms);
}


function buildHeaders(base?: HeadersInit, extra?: Record<string, string>) {
  const h = new Headers(base);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) h.set(k, v);
  }
  return h;
}

export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: ApiRetryOptions = {}
): Promise<T> {
  const {
    retries = 6,
    delayMs = 2000,
    retryOnStatus = [408, 425, 429, 500, 502, 503, 504],
  } = opts;

  let lastErr: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const headers = buildHeaders(init.headers, undefined);

      const res = await fetch(input, {
        ...init,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        if (retryOnStatus.includes(res.status) && attempt < retries) {
          await sleep(delayMs * Math.pow(2, attempt));
          continue;
        }
        let errText = '';
        try {
          errText = await res.text();
        } catch {}
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      const msg = String((err as any)?.message || err);
      const shouldRetry = attempt < retries;

      if (!shouldRetry) break;

      // Retry on network errors / timeouts
      if (
        msg.includes('Abort') ||
        msg.includes('fetch') ||
        msg.includes('Network') ||
        msg.includes('failed')
      ) {
        await sleep(delayMs * Math.pow(2, attempt));
        continue;
      }

      // For any other error, still retry a couple times
      await sleep(delayMs * Math.pow(2, attempt));
    }
  }

  throw lastErr;
}

