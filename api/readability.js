const { Readability } = require('@mozilla/readability');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

module.exports = async (request, response) => {
    const { url, selector } = request.query;
    const original = await fetch(url);
    const dom = new JSDOM(await original.text(), { url: url });
    const reader = new Readability(selector ? dom.window.document.querySelector(selector) : dom.window.document);
    const article = reader.parse();

    response.send(
        `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${article.title} - ${article.byline} - ${article.siteName}</title>
    <!--<link rel="stylesheet" href="style.css">
    <script src="script.js"></script>-->
  </head>
  <body>
    <h1><a href="${url}">${article.title} - ${article.byline}</a></h1>
    ${article.content}
  </body>
</html>
`);
};
