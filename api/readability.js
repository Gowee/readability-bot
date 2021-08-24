const { Readability } = require('@mozilla/readability');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

module.exports = async (request, response) => {
  const { url, selector } = request.query;
  const original = await fetch(url);
  const dom = new JSDOM(await original.text(), { url: url });
  const reader = new Readability(selector ? dom.window.document.querySelector(selector) : dom.window.document);
  const article = reader.parse();
  console.log(article);
  response.send(render(Object.assign({url}, article)));
};

function render(params) {
  const { title, byline, siteName, content, url, excerpt } = params;
  const genDate = new Date();
  return `<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none';">
  <meta http-equiv="Content-Security-Policy" content="frame-src 'none';">
  <meta name="description" content="${excerpt}">
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

    .byline .seperator::before {
      content: "\\2022";
      /* padding: 0 7px; */
    }

    .article-header {
      padding-bottom: 1.5rem;
    }

    .article-body {
      padding-top: 1.5rem;
      padding-bottom: 1.0rem;
    }

    .page-footer {
      padding-top: 1.0rem;
      padding-bottom: 1.0rem;
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
        <!--<a rel="author" href="" target="_blank">${byline}</a>-->
        ${byline || "?"}
        <span class="seperator"></span>
        <a href="${url}" target="_blank">${siteName || "(source)"}</a>
      </address>
    </header>
    <article class="section article-body is-size-5 content">
      ${content}  
    </article>

    <hr />
    <footer class="section page-footer is-size-7">
      <small>The article is scraped and extracted from <a href="${url}" target="_blank">${siteName}</a> by <a href="https://readability-bot.vercel.com/">readability-bot</a> at <time datetime="${genDate.toISOString()}">${genDate.toString()}</time>.</small>
    </footer>
  </main>
</body>

</html>`
}