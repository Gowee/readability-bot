const DEFAULT_APP_URL = "https://readability-bot.vercel.app";
const DEFAULT_USER_AGENT_SUFFIX = "readability-bot/2.0";
const FALLBACK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15 " +
  DEFAULT_USER_AGENT_SUFFIX;

export function inferAppUrl(request?: { headers?: Record<string, string | undefined> }): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  const host =
    request?.headers?.["x-forwarded-host"] ??
    request?.headers?.host ??
    process.env.VERCEL_URL;

  if (!host) {
    return DEFAULT_APP_URL;
  }

  const protocol = request?.headers?.["x-forwarded-proto"] ?? "https";
  return `${protocol}://${host}`;
}

export function getReadabilityApiUrl(request?: { headers?: Record<string, string | undefined> }): string {
  return process.env.READABILITY_API_URL ?? `${inferAppUrl(request)}/api/readability`;
}

export function constructReadableUrl(url: string, request?: { headers?: Record<string, string | undefined> }): string {
  return `${getReadabilityApiUrl(request)}?url=${encodeURIComponent(url)}`;
}

export function constructIvUrl(url: string, request?: { headers?: Record<string, string | undefined> }): string {
  return `https://t.me/iv?url=${encodeURIComponent(
    constructReadableUrl(url, request)
  )}&rhash=${process.env.IV_RHASH ?? ""}`;
}

export { DEFAULT_USER_AGENT_SUFFIX, FALLBACK_USER_AGENT };
