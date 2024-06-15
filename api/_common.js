export const APP_URL = process.env.APP_URL ?? "https://" + process.env.VERCEL_URL;
export const READABILITY_API_URL = getApiUrlFromEnv();
export const IV_RHASH = process.env.IV_RHASH; // Track rules.iv in Telegram at first
export const BOT_TOKEN = process.env.BOT_TOKEN;

function getApiUrlFromEnv() {
  if (process.env.READABILITY_API_URL) {
    return process.env.READABILITY_API_URL;
  } else if (process.env.VERCEL_URL) {
    return "https://" + process.env.VERCEL_URL + "/api/readability";
  } else {
    return "https://readability-bot.vercel.app/api/readability";
  }
}

export function constructReadableUrl(url) {
  const readableUrl = `${READABILITY_API_URL}?url=${encodeURIComponent(url)}`;
  return readableUrl;
}

export function constructIvUrl(url) {
  const readableUrl = constructReadableUrl(url);
  return `https://t.me/iv?url=${encodeURIComponent(
    readableUrl
  )}&rhash=${IV_RHASH}`;
}
