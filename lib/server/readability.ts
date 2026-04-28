import { Readability } from "@mozilla/readability";
import createDOMPurify from "dompurify";
import sniffHTMLEncoding from "html-encoding-sniffer";
import { encode as htmlEntitiesEscape } from "html-entities";
import iconv from "iconv-lite";
import { JSDOM } from "jsdom";

import {
  DEFAULT_USER_AGENT_SUFFIX,
  FALLBACK_USER_AGENT,
  constructIvUrl,
  inferAppUrl,
} from "./config.js";

const MAX_UPSTREAM_BODY_SIZE = 2 * 1024 * 1024; // 2MB

const EASTER_EGG_PAGE = `<!doctype html>
<html lang="en">
  <head><title>Catastrophic Server Error</title></head>
  <body>
    <p>Server is down. (<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Debug</a>)</p>
  </body>
</html>
`;

type VercelRequest = { headers?: Record<string, string | undefined> };

export interface ReadableMeta {
  url: string;
  lang: string | null;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  title: string | null | undefined;
  content: string;
  imageUrl: string | null;
  textContent?: string | null;
  length?: number | null;
  dir?: string | null;
  publishedTime?: string | null;
}

export async function buildReadableMeta(
  url: string,
  requestHeaders: Record<string, string | undefined> = {}
): Promise<{ meta: ReadableMeta; cacheControl: string }> {
  if (!isValidUrl(url)) {
    const error = new Error("Invalid URL") as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  const controller = new AbortController();
  const upstreamResponse = await fetch(url, {
    headers: constructUpstreamRequestHeaders(requestHeaders),
    redirect: "follow",
    signal: controller.signal,
  });

  try {
    const upstreamContentType = upstreamResponse.headers.get("content-type");
    const upstreamContentLength = upstreamResponse.headers.get("content-length");

    validateContentType(upstreamContentType, url);
    validateContentLength(upstreamContentLength, url);

    if (!upstreamResponse.ok) {
      console.log(
        JSON.stringify({
          event: "upstream_http_error",
          url,
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          content_type: upstreamContentType,
          content_length: upstreamContentLength,
        })
      );
      const error = new Error(
        `Upstream HTTP error: ${upstreamResponse.status} ${upstreamResponse.statusText}`
      ) as Error & { statusCode: number };
      error.statusCode = upstreamResponse.status;
      throw error;
    }

    const dom = await createDomFromResponse(upstreamResponse, url);
    const doc = dom.window.document;
    const DOMPurify = createDOMPurify(dom.window);

    fixImgLazyLoadFromDataSrc(doc);

    const hostname = new URL(url).hostname;
    if (hostname === "www.xiaohongshu.com") {
      fixXiaohongshuImages(doc);
    } else if (hostname === "mp.weixin.qq.com") {
      fixWeixinArticle(doc);
    }

    let articleContent: string | null = null;
    if (hostname === "telegra.ph") {
      const telegraPhContent = doc.querySelector(".tl_article_content");
      if (telegraPhContent) {
        telegraPhContent.querySelector("h1")?.remove();
        telegraPhContent.querySelector("address")?.remove();
        articleContent = telegraPhContent.innerHTML;
      }
    }

    const article = new Readability(doc).parse();
    if (!article) {
      const error = new Error("Unable to extract a readable article from the page") as Error & { statusCode: number };
      error.statusCode = 422;
      throw error;
    }

    const ogImage = doc.querySelector(
      'meta[property="og:image"], meta[name="og:image"]'
    ) as HTMLMetaElement | null;

    const meta: ReadableMeta = {
      ...article,
      url,
      lang: extractLang(doc),
      byline: stripRepeatedWhitespace(article.byline),
      siteName: stripRepeatedWhitespace(article.siteName),
      excerpt: stripRepeatedWhitespace(article.excerpt),
      content: DOMPurify.sanitize(articleContent ?? article.content ?? ""),
      imageUrl: ogImage?.content ?? null,
    };

    return {
      meta,
      cacheControl:
        upstreamResponse.headers.get("cache-control") ??
        "public, max-age=0, s-maxage=900, stale-while-revalidate=900",
    };
  } catch (error) {
    controller.abort();
    throw error;
  }
}

export function renderReadablePage(meta: ReadableMeta, request?: VercelRequest): string {
  const appUrl = inferAppUrl(request);
  const generatedAt = new Date().toISOString();
  const langAttr = meta.lang ? ` lang="${meta.lang}"` : "";
  const sourceHost = new URL(meta.url).hostname;
  const siteName = meta.siteName || sourceHost;
  const byline = [meta.byline, siteName].filter(Boolean).join(" • ") || sourceHost;
  const imageMeta = meta.imageUrl
    ? `<meta property="og:image" content="${htmlEntitiesEscape(meta.imageUrl)}" />`
    : "";
  const sourceUrl = htmlEntitiesEscape(meta.url);
  const homeUrl = htmlEntitiesEscape(appUrl);
  const instantViewUrl = htmlEntitiesEscape(constructIvUrl(meta.url, request));

  return `<!doctype html>
<html${langAttr}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${htmlEntitiesEscape(meta.excerpt ?? "")}" />
    <meta name="referrer" content="same-origin" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; media-src https:; frame-src 'none'; base-uri 'none'; form-action 'none';" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${htmlEntitiesEscape(meta.title ?? "Untitled")}" />
    <meta property="og:description" content="${htmlEntitiesEscape(meta.excerpt ?? "")}" />
    <meta property="og:site_name" content="${htmlEntitiesEscape(siteName)}" />
    <meta property="article:author" content="${htmlEntitiesEscape(byline)}" />
    ${imageMeta}
    <title>${htmlEntitiesEscape(meta.title ?? "Untitled")}</title>
    <style>
      :root {
        --max-width: 760px;
        --padding: clamp(1rem, 4vw, 2rem);
        --font-serif: Georgia, "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "PMingLiU", serif;
        --font-sans: system-ui, "PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
        --text: #111;
        --muted: #6b6b6b;
        --line: #e0e0e0;
        --link: #004fc6;
      }

      *, *::before, *::after { box-sizing: border-box; }

      body {
        margin: 0;
        padding: 0 0 3rem;
        background: #fff;
        color: var(--text);
        font-family: var(--font-serif);
        font-size: 1.12rem;
        line-height: 1.8;
        -webkit-font-smoothing: antialiased;
      }

      main {
        width: min(var(--max-width), calc(100vw - var(--padding) * 2));
        margin: 0 auto;
        padding-top: clamp(2rem, 6vw, 4rem);
      }

      /* ── Header ── */
      header {
        margin-bottom: 2.5rem;
        padding-bottom: 1.5rem;
      }

      h1 {
        margin: 0 0 0.6rem;
        font-size: clamp(1.8rem, 4vw, 2.3rem);
        font-weight: 700;
        line-height: 1.35;
        letter-spacing: 0.01em;
      }

      address {
        margin: 0;
        font-family: var(--font-sans);
        font-size: 0.92rem;
        font-style: normal;
        color: var(--muted);
      }

      address a {
        color: inherit;
        text-decoration: none;
      }

      address a:hover {
        text-decoration: underline;
      }

      /* ── Article body ── */
      article {
        font-size: 1.12rem;
        line-height: 1.8;
      }

      article p {
        margin: 1.25rem 0;
      }

      article h2, article h3, article h4 {
        margin: 2rem 0 0.6rem;
        line-height: 1.35;
      }

      article h2 { font-size: 1.5rem; }
      article h3 { font-size: 1.25rem; }

      article a { color: var(--link); }

      article img,
      article video,
      article iframe,
      article figure {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 1.5rem auto;
      }

      article figcaption {
        margin-top: 0.3rem;
        font-family: var(--font-sans);
        font-size: 0.85rem;
        color: var(--muted);
        text-align: center;
      }

      article blockquote {
        margin: 1.5rem 0;
        padding: 0 1rem;
        border-left: 3px solid var(--line);
        color: var(--muted);
      }

      article pre,
      article code {
        font-family: "SF Mono", "Fira Code", monospace;
        font-size: 0.9em;
      }

      article pre {
        overflow-x: auto;
        padding: 1rem;
        background: #f7f7f7;
        border-radius: 6px;
        line-height: 1.5;
      }

      article ul, article ol {
        padding-left: 1.5rem;
      }

      article li {
        margin: 0.4rem 0;
      }

      article table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--font-sans);
        font-size: 0.92rem;
      }

      article th, article td {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--line);
        text-align: left;
      }

      article th {
        background: #f9f9f9;
        font-weight: 600;
      }

      /* ── Footer ── */
      hr {
        margin: 2.5rem 0 1.25rem;
        border: 0;
        border-top: 1px solid var(--line);
      }

      footer {
        font-family: var(--font-sans);
        font-size: 0.82rem;
        color: var(--muted);
      }

      footer a {
        color: inherit;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${htmlEntitiesEscape(meta.title ?? "Untitled")}</h1>
        <address>
          <a rel="author" href="${sourceUrl}" target="_blank">${htmlEntitiesEscape(byline)}</a>
        </address>
      </header>
      <article>${meta.content}</article>
      <hr />
      <footer>
        The article (<a title="Telegram Instant View link" href="${instantViewUrl}">IV</a>) is extracted from
        <a title="Source link" href="${sourceUrl}" target="_blank">${htmlEntitiesEscape(siteName)}</a> by
        <a href="${homeUrl}">readability-bot</a> at <time datetime="${generatedAt}">${generatedAt}</time>.
      </footer>
    </main>
  </body>
</html>`;
}

async function createDomFromResponse(response: Response, url: string): Promise<JSDOM> {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_UPSTREAM_BODY_SIZE) {
    console.log(
      JSON.stringify({
        event: "content_length_exceeded_post_read",
        url,
        actual_size: buffer.length,
        limit: MAX_UPSTREAM_BODY_SIZE,
      })
    );
    const error = new Error(
      `Content too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB. Maximum size is 2MB.`
    ) as Error & { statusCode: number };
    error.statusCode = 413;
    throw error;
  }
  const encoding = sniffHTMLEncoding(buffer, {
    transportLayerEncodingLabel: getCharset(response.headers.get("content-type")),
    defaultEncoding: "UTF-8",
  });
  const html = iconv.decode(buffer, encoding || "utf-8");
  return new JSDOM(html, { url });
}

function constructUpstreamRequestHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const currentUserAgent = headers["user-agent"];
  const userAgent =
    currentUserAgent && !currentUserAgent.includes("node")
      ? `${currentUserAgent} ${DEFAULT_USER_AGENT_SUFFIX}`
      : FALLBACK_USER_AGENT;

  return {
    "user-agent": userAgent,
    referer: "https://www.google.com/?feeling-lucky",
  };
}

function getCharset(contentType: string | null): string | undefined {
  const match = /charset=([^;]+)/i.exec(contentType ?? "");
  return match?.[1]?.trim();
}

function stripRepeatedWhitespace(value: string | null | undefined): string | null {
  return value ? value.replace(/\s+/g, " ").trim() : (value ?? null);
}

function isValidUrl(url: string): boolean {
  try {
    const candidate = new URL(url);
    return candidate.protocol === "http:" || candidate.protocol === "https:";
  } catch {
    return false;
  }
}

function extractLang(doc: Document): string | null {
  return (
    doc.querySelector("html")?.getAttribute("lang") ??
    doc.querySelector("body")?.getAttribute("lang") ??
    null
  );
}

function fixImgLazyLoadFromDataSrc(doc: Document): void {
  for (const image of doc.querySelectorAll<HTMLImageElement>("body img:not([src])[data-src]")) {
    image.src = image.dataset.src || "";
  }
}

function fixXiaohongshuImages(doc: Document): void {
  const target = doc.querySelector("#detail-desc") ?? doc.querySelector("body");
  if (!target) {
    return;
  }

  const container = doc.createElement("span");
  target.prepend(container);

  for (const ogImage of doc.querySelectorAll<HTMLMetaElement>(
    'meta[property="og:image"], meta[name="og:image"]'
  )) {
    const imageUrl = ogImage.content;
    if (!imageUrl) {
      continue;
    }

    const paragraph = doc.createElement("p");
    const image = doc.createElement("img");
    image.src = imageUrl;
    paragraph.append(image);
    container.append(paragraph);
  }
}

function fixWeixinArticle(doc: Document): void {
  const content = doc.querySelector("#js_content, .rich_media_content");
  if (content) {
    content.removeAttribute("style");
  }
}

function validateContentType(contentType: string | null, url: string): void {
  if (!contentType) return;
  const mimeType = contentType.split(";")[0]!.trim().toLowerCase();
  if (mimeType.startsWith("text/")) return;
  if (mimeType === "application/xhtml+xml") return;
  console.log(
    JSON.stringify({
      event: "content_type_rejected",
      url,
      content_type: contentType,
    })
  );
  const error = new Error(
    `Unsupported content type: ${contentType}. Only text and HTML content types are supported.`
  ) as Error & { statusCode: number };
  error.statusCode = 415;
  throw error;
}

function validateContentLength(contentLength: string | null, url: string): void {
  if (!contentLength) return;
  const length = parseInt(contentLength, 10);
  if (isNaN(length) || length <= MAX_UPSTREAM_BODY_SIZE) return;
  console.log(
    JSON.stringify({
      event: "content_length_exceeded",
      url,
      content_length: length,
      limit: MAX_UPSTREAM_BODY_SIZE,
    })
  );
  const error = new Error(
    `Content too large: ${(length / 1024 / 1024).toFixed(1)}MB. Maximum size is 2MB.`
  ) as Error & { statusCode: number };
  error.statusCode = 413;
  throw error;
}

export { EASTER_EGG_PAGE };
