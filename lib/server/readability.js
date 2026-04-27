const { Readability } = require("@mozilla/readability");
const createDOMPurify = require("dompurify");
const sniffHTMLEncoding = require("html-encoding-sniffer");
const { encode: htmlEntitiesEscape } = require("html-entities");
const iconv = require("iconv-lite");
const { JSDOM } = require("jsdom");

const {
  DEFAULT_USER_AGENT_SUFFIX,
  FALLBACK_USER_AGENT,
  constructIvUrl,
  inferAppUrl,
} = require("./config");

const EASTER_EGG_PAGE = `<!doctype html>
<html lang="en">
  <head><title>Catastrophic Server Error</title></head>
  <body>
    <p>Server is down. (<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Debug</a>)</p>
  </body>
</html>
`;

async function buildReadableMeta(url, requestHeaders = {}) {
  if (!isValidUrl(url)) {
    const error = new Error("Invalid URL");
    error.statusCode = 400;
    throw error;
  }

  const upstreamResponse = await fetch(url, {
    headers: constructUpstreamRequestHeaders(requestHeaders),
    redirect: "follow",
  });

  if (!upstreamResponse.ok) {
    const error = new Error(
      `Upstream HTTP error: ${upstreamResponse.status} ${upstreamResponse.statusText}`
    );
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

  let articleContent = null;
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
    const error = new Error("Unable to extract a readable article from the page");
    error.statusCode = 422;
    throw error;
  }

  const ogImage = doc.querySelector(
    'meta[property="og:image"], meta[name="og:image"]'
  );

  const meta = {
    ...article,
    url,
    lang: extractLang(doc),
    byline: stripRepeatedWhitespace(article.byline),
    siteName: stripRepeatedWhitespace(article.siteName),
    excerpt: stripRepeatedWhitespace(article.excerpt),
    content: DOMPurify.sanitize(articleContent ?? article.content),
    imageUrl: ogImage?.content,
  };

  return {
    meta,
    cacheControl:
      upstreamResponse.headers.get("cache-control") ??
      "public, max-age=0, s-maxage=900, stale-while-revalidate=900",
  };
}

function renderReadablePage(meta, request) {
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
        color-scheme: light;
        --bg: #f4efe7;
        --card: #fffdf9;
        --ink: #16120f;
        --muted: #6a5f54;
        --line: #d8cec1;
        --accent: #a04d1a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at top, rgba(160, 77, 26, 0.09), transparent 28rem),
          linear-gradient(180deg, #f8f3ec 0%, var(--bg) 100%);
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
      }
      main {
        width: min(52rem, calc(100vw - 2rem));
        margin: 0 auto;
        padding: 3rem 0 4rem;
      }
      .shell {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 1.5rem;
        box-shadow: 0 1.25rem 3rem rgba(22, 18, 15, 0.08);
        overflow: hidden;
      }
      header, article, footer {
        padding-left: clamp(1.25rem, 4vw, 3rem);
        padding-right: clamp(1.25rem, 4vw, 3rem);
      }
      header { padding-top: 2.5rem; padding-bottom: 1.5rem; }
      h1 {
        margin: 0;
        font-size: clamp(2.1rem, 5vw, 3.3rem);
        line-height: 1.1;
      }
      address {
        margin-top: 0.9rem;
        color: var(--muted);
        font-style: normal;
      }
      article {
        padding-top: 1rem;
        padding-bottom: 2rem;
        font-size: 1.08rem;
        line-height: 1.75;
      }
      article img, article video, article iframe {
        max-width: 100%;
      }
      article a { color: var(--accent); }
      footer {
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 0.92rem;
        padding-top: 1rem;
        padding-bottom: 1.5rem;
      }
      footer a { color: inherit; }
    </style>
  </head>
  <body>
    <main>
      <div class="shell">
        <header>
          <h1>${htmlEntitiesEscape(meta.title ?? "Untitled")}</h1>
          <address>
            <a rel="author" href="${sourceUrl}" target="_blank">${htmlEntitiesEscape(byline)}</a>
          </address>
        </header>
        <article>${meta.content}</article>
        <footer>
          The article (<a href="${instantViewUrl}">IV</a>) is extracted from
          <a href="${sourceUrl}" target="_blank">${htmlEntitiesEscape(siteName)}</a> by
          <a href="${homeUrl}">readability-bot</a> at <time datetime="${generatedAt}">${generatedAt}</time>.
        </footer>
      </div>
    </main>
  </body>
</html>`;
}

async function createDomFromResponse(response, url) {
  const buffer = Buffer.from(await response.arrayBuffer());
  const encoding = sniffHTMLEncoding(buffer, {
    transportLayerEncodingLabel: getCharset(response.headers.get("content-type")),
    defaultEncoding: "UTF-8",
  });
  const html = iconv.decode(buffer, encoding || "utf-8");
  return new JSDOM(html, { url });
}

function constructUpstreamRequestHeaders(headers) {
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

function getCharset(contentType) {
  const match = /charset=([^;]+)/i.exec(contentType ?? "");
  return match?.[1]?.trim();
}

function stripRepeatedWhitespace(value) {
  return value ? value.replace(/\s+/g, " ").trim() : value;
}

function isValidUrl(url) {
  try {
    const candidate = new URL(url);
    return candidate.protocol === "http:" || candidate.protocol === "https:";
  } catch {
    return false;
  }
}

function extractLang(doc) {
  return (
    doc.querySelector("html")?.getAttribute("lang") ??
    doc.querySelector("body")?.getAttribute("lang") ??
    null
  );
}

function fixImgLazyLoadFromDataSrc(doc) {
  for (const image of doc.querySelectorAll("body img:not([src])[data-src]")) {
    image.src = image.dataset.src;
  }
}

function fixXiaohongshuImages(doc) {
  const target = doc.querySelector("#detail-desc") ?? doc.querySelector("body");
  if (!target) {
    return;
  }

  const container = doc.createElement("span");
  target.prepend(container);

  for (const ogImage of doc.querySelectorAll(
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

function fixWeixinArticle(doc) {
  const content = doc.querySelector("#js_content, .rich_media_content");
  if (content) {
    content.removeAttribute("style");
  }
}

module.exports = {
  EASTER_EGG_PAGE,
  buildReadableMeta,
  renderReadablePage,
};
