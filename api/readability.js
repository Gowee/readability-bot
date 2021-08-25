const { Readability } = require("@mozilla/readability");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");

const APP_URL = process.env.VERCEL_URL ?? "https://readability-bot.vercel.com/";

module.exports = async (request, response) => {
  const { url, /*selector,*/ type } = request.query;
  const original = await fetch(url, {
    headers: { "User-Agent": request.headers["User-Agent"] },
  });
  const dom = new JSDOM(await original.textConverted(), { url: url });
  const doc = dom.window.document;
  const reader = new Readability(
    /*selector ? doc.querySelector(selector) :*/ doc
  );
  const article = reader.parse();
  const lang =
    doc.querySelector("html").getAttribute("lang") ??
    doc.querySelector("body").getAttribute("lang");
  const meta = Object.assign({ url, lang }, article);
  meta.byline = stripRepeatedWhitespace(meta.byline);
  meta.siteName = stripRepeatedWhitespace(meta.siteName);
  meta.excerpt = stripRepeatedWhitespace(meta.excerpt);
  if (type === "json") {
    response.json(meta);
  } else {
    response.send(render(meta));
  }
};

function render(params) {
  let { lang, title, byline: author, siteName, content, url, excerpt } = params;
  const genDate = new Date();
  const langAttr = lang ? `lang="${lang}"` : "";
  const byline = [author, siteName].filter((v) => v).join(" • ") || new URL(url).hostname;
  siteName = siteName || new URL(url).hostname;
  const ogSiteName = siteName
    ? `<meta property="og:site_name" content="${siteName}">`
    : "";
  const ogAuthor = byline
    ? `<meta property="article:author" content="${byline}">`
    : "";
  return `<!DOCTYPE html>
<html ${langAttr}>

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none';">
  <meta http-equiv="Content-Security-Policy" content="frame-src 'none';">
  <meta name="description" content="${excerpt}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title}">
  ${ogSiteName}
  <meta property="og:description" content="${excerpt}">
  ${ogAuthor}
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.3/css/bulma.min.css">
  <title>${title}</title>
  <style>
    * {
      font-family: serif;
    }

    p {
      line-height: 1.5;
    }

    p:not(:first-child) {
      margin-top: 1.5rem;

    }

    p:not(:last-child) {
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
      padding-top: 1.5rem;
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
        ${title}
      </h1>
      <address class="subtitle byline" >
        <a rel="author" href="${url}" target="_blank">
        ${byline}
        </a>
      </address>
    </header>
    <article class="section article-body is-size-5 content">
      ${content}  
    </article>

    <hr />
    <footer class="section page-footer is-size-7">
      <small>The article is scraped and extracted from <a href="${url}" target="_blank">${siteName}</a> by <a href="${APP_URL}">readability-bot</a> at <time datetime="${genDate.toISOString()}">${genDate.toString()}</time>.</small>
    </footer>
  </main>
</body>

</html>
`;
}

function stripRepeatedWhitespace(s) {
  if (s) {
    return s.replace(/\s+/g, " ");
  } else {
    return s;
  }
}
