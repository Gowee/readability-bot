const DEFAULT_APP_URL = "https://readability-bot.vercel.app";
const DEFAULT_USER_AGENT_SUFFIX =
  process.env.VERCEL_URL
    ? `readability-bot/2.0 (+${process.env.VERCEL_URL})`
    : "readability-bot/2.0";
const FALLBACK_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15 " +
  DEFAULT_USER_AGENT_SUFFIX;

export function inferAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return DEFAULT_APP_URL;
}

export function constructReadableUrl(url: string): string {
  const apiUrl = process.env.READABILITY_API_URL ?? `${inferAppUrl()}/api/readability`;
  return `${apiUrl}?url=${encodeURIComponent(url)}`;
}

export function constructIvUrl(url: string): string {
  return `https://t.me/iv?url=${encodeURIComponent(
    constructReadableUrl(url)
  )}&rhash=${process.env.IV_RHASH ?? ""}`;
}

export { DEFAULT_USER_AGENT_SUFFIX, FALLBACK_USER_AGENT };
