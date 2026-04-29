import {
  EASTER_EGG_PAGE,
  buildReadableMeta,
  renderReadablePage,
} from "../lib/server/readability.js";
import { generateSummary } from "../lib/server/summary.js";
import { getVersionInfo } from "../lib/server/meta.js";

interface VercelRequest {
  headers: Record<string, string | undefined>;
  query: Record<string, string | undefined>;
}

interface VercelResponse {
  send(body: string): VercelResponse;
  json(body: unknown): VercelResponse;
  status(code: number): VercelResponse;
  setHeader(key: string, value: string): void;
  redirect(url: string): void;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if ((request.headers["user-agent"] ?? "").includes("readability-bot")) {
    response.send(EASTER_EGG_PAGE);
    return;
  }
  const { url, type } = request.query;
  const format = request.query.format ?? type;

  if (!url && format !== "json") {
    response.redirect("/");
    return;
  }

  try {
    const { meta, upstreamCacheControl } = await buildReadableMeta(url!, request.headers);
    response.setHeader(
      "cache-control",
      upstreamCacheControl ?? "public, max-age=0, s-maxage=900, stale-while-revalidate=900"
    );

    if (request.query.summary !== "0") {
      meta.summary = await generateSummary(meta.textContent);
      if (meta.summary) {
        meta.summaryAttribution = { name: "Chat Jimmy", url: "https://chatjimmy.ai" };
      }
    }

    meta.version = getVersionInfo();

    if (format === "json") {
      response.status(200).json(meta);
      return;
    }

    response.setHeader("content-type", "text/html; charset=utf-8");
    response.status(200).send(renderReadablePage(meta));
  } catch (error: unknown) {
    console.error(error);
    const err = error as Error & { statusCode?: number };
    response.status(err.statusCode ?? 500).send(err.message ?? String(error));
    return;
  }
}
