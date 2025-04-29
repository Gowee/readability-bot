const { Readability } = require("@mozilla/readability");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { encode: htmlEntitiesEscape } = require("html-entities");
const createDOMPurify = require("dompurify");

const { APP_URL, constructIvUrl, DEFAULT_USER_AGENT_SUFFIX, FALLBACK_USER_AGENT } = require("./_common.js");

module.exports = async (request, response) => {
  if ((request.headers["user-agent"] ?? "").includes("readability-bot")) {
    response.send(EASTER_EGG_PAGE);
    return;
  }
  let { url, /*selector,*/ type, format } = request.query;
  if (!format) {
    format = type; // the type param will be deprecated in favor of format
  }
  if (!url & (format !== "json")) {
    response.redirect(APP_URL);
    return;
  }
  let meta, upstreamResponse;
  try {
    if (!isValidUrl(url)) {
      response.status(400).send("Invalid URL");
      return;
    }
    const headers = constructUpstreamRequestHeaders(request.headers);
    console.debug("RH: ", headers);
    upstreamResponse = await fetch(url, {
      headers,
    });
    console.debug("UP: ", upstreamResponse);
    const dom = new JSDOM(await upstreamResponse.textConverted(), { url: url });
    const DOMPurify = createDOMPurify(dom.window);
    const doc = dom.window.document;
    fixImgLazyLoadFromDataSrc(doc);
    if ((new URL(url)).hostname === "www.xiaohongshu.com") {
      fixXiaohongshuImages(doc);
    }
    else if ((new URL(url)).hostname === "mp.weixin.qq.com") {
      fixWeixinArticle(doc);
    }

    let article_content = null;
    if ((new URL(url)).hostname === "telegra.ph") {
      const ac = doc.querySelector(".tl_article_content");
      if (ac) {
        // CSS rules in https://telegra.ph/css/core.min.css
        ac.querySelector("h1").style.display = "none";
        ac.querySelector("address").style.display = "none";

        article_content = ac.innerHTML;
      }
    }

    const reader = new Readability(
      /*selector ? doc.querySelector(selector) :*/ doc
    );
    const article = reader.parse();
    const lang = extractLang(doc);
    // some stupid websites like xiaohongshu.com use the non-standard "name" attr
    const ogImage = doc.querySelector('meta[property="og:image"], meta[name="og:image"]');
    meta = Object.assign({ url, lang }, article);
    meta.byline = stripRepeatedWhitespace(meta.byline);
    meta.siteName = stripRepeatedWhitespace(meta.siteName);
    meta.excerpt = stripRepeatedWhitespace(meta.excerpt);
    meta.content = DOMPurify.sanitize(article_content ?? meta.content);
    meta.imageUrl = (ogImage || {}).content;
  } catch (e) {
    console.error(e);
    response.status(500).send(e.toString());
    return;
  }
  response.setHeader('cache-control', upstreamResponse.headers["cache-control"] ?? "public, max-age=900");
  if (format === "json") {
    console.debug(meta);
    response.json(meta);
  } else {
    response.send(render(meta));
  }
};

function render(meta) {
  let { lang, title, byline: author, siteName, content, url, excerpt, imageUrl } = meta;
  const genDate = new Date();
  const langAttr = lang ? `lang="${lang}"` : "";
  const byline =
    [author, siteName].filter((v) => v).join(" • ") || new URL(url).hostname;
  siteName = siteName || new URL(url).hostname;
  const ogSiteName = siteName
    ? `<meta property="og:site_name" content="${htmlEntitiesEscape(siteName)}">`
    : "";
  const ogAuthor = byline
    ? `<meta property="article:author" content="${htmlEntitiesEscape(byline)}">`
    : "";
  const ogImage = imageUrl ? `<meta property="og:image" content="${htmlEntitiesEscape(imageUrl)}"/>`
    : "";

  return `<!DOCTYPE html>
<html ${langAttr}>

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="same-origin">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none';">
  <meta http-equiv="Content-Security-Policy" content="frame-src 'none';">
  <meta name="description" content="${htmlEntitiesEscape(excerpt)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${htmlEntitiesEscape(title)}">
  ${ogSiteName}
  <meta property="og:description" content="${htmlEntitiesEscape(excerpt)}">
  ${ogAuthor}
  ${ogImage}
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.3/css/bulma.min.css">
  <title>${htmlEntitiesEscape(title)}</title>
  <style>
    * {
      font-family: serif;
    }

    p {
      line-height: 1.5;
    }

    p {
      margin-top: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .byline {
      padding-top: 0.5rem;
      font-style: normal;
    }

    .byline a {
      text-decoration: none;
      color: #79828B;
    }

    .byline .seperator {
      /* content: "\\2022"; */
      padding: 0 5px;
    }

    .article-header {
      padding-bottom: 1.5rem;
    }

    .article-body {
      padding-top: 0rem;
      padding-bottom: 0rem;
    }

    .page-footer {
      padding-top: 0rem;excerpt
      padding-bottom: 1.0rem;
    }

    hr {
      marginLeft: 1rem;
      marginRight: 1rem;
    }
  </style>
</head>

<body>
  <main class="container is-max-desktop">
    <header class="section article-header">
      <h1 class="title">
        ${htmlEntitiesEscape(title)}
      </h1>
      <address class="subtitle byline" >
        <a rel="author" href="${url}" target="_blank">
        ${htmlEntitiesEscape(byline)}
        </a>
      </address>
    </header>
    <article class="section article-body is-size-5 content">
      ${content}
    </article>

    <hr />
    <footer class="section page-footer is-size-7">
      <small>The article(<a title="Telegram Intant View link" href="${constructIvUrl(url)}">IV</a>) is scraped and extracted from <a title="Source link" href="${url}" target="_blank">${htmlEntitiesEscape(
    siteName
  )}</a> by <a href="${APP_URL}">readability-bot</a> at <time datetime="${genDate.toISOString()}">${genDate.toString()}</time>.</small>
    </footer>
  </main>
</body>

</html>
`;
}

function constructUpstreamRequestHeaders(headers) {
  let ua = headers["user-agent"];
  if (ua && ua.indexOf("node-fetch") === -1) {
    ua += " " + DEFAULT_USER_AGENT_SUFFIX;
  }
  else {
    ua = FALLBACK_USER_AGENT;
  }
  return {
    "user-agent": ua,
    "referer": "https://www.google.com/?feeling-lucky"
    /*"x-real-ip": headers["x-real-ip"],
    "x-forwarded-for":
      headers["x-real-ip"] + ", " + (headers["x-forwarded-for"] ?? ""),*/
  };
}

function stripRepeatedWhitespace(s) {
  if (s) {
    return s.replace(/\s+/g, " ");
  } else {
    return s;
  }
}

function isValidUrl(url) {
  try {
    const _ = new URL(url);
    return true;
  } catch (_e) {
    return false;
  }
}

const EASTER_EGG_PAGE = `<html>
<head><title>Catastrophic Server Error</title></head>
<body>
  <p>Server is down. (<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">🛠︎ Debug</a>)</p>
</body>
</html>
`;

function extractLang(doc) {
  // Some malformed HTMLs may confuse querySelector.
  return (
    (doc.querySelector("html") &&
      doc.querySelector("html").getAttribute("lang")) ??
    (doc.querySelector("body") &&
      doc.querySelector("body").getAttribute("lang"))
  );
}

function fixImgLazyLoadFromDataSrc(doc) {
  // sample page: https://mp.weixin.qq.com/s/U07oNCwtiAMGnBvYZXPuMg
  console.debug(doc.querySelectorAll("body img:not([src])[data-src]"));
  for (const img of doc.querySelectorAll("body img:not([src])[data-src]")) {
    img.src = img.dataset.src;
  }
}

function fixXiaohongshuImages(doc) {
  // sample page:
  // https://www.xiaohongshu.com/explore/66a589ef000000002701c69e
  const target = doc.querySelector("#detail-desc") ?? doc.querySelector("body");
  // some magic to make readability.js and telegra.ph happy together
  const container = doc.createElement("span");
  target.prepend(container);
  for (const ogImage of doc.querySelectorAll('meta[property="og:image"], meta[name="og:image"]')) {
    const url = ogImage.content;
    // console.log("xhsImg", url);
    const imgP = doc.createElement("p");
    const img = doc.createElement("img");
    img.src = url;
    imgP.append(img);
    container.append(imgP);
  }
}

function fixWeixinArticle(doc) {
  // sample page: https://mp.weixin.qq.com/s/ayHC7MpG6Jpiogzp-opQFw
  const jc = doc.querySelector("#js_content, .rich_media_content");
  if (jc) {
    jc.style = ""; // remove visibility: hidden
  }
}
