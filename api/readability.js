const { Readability } = require('@mozilla/readability');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

module.exports = async (request, response) => {
    const { url, selector } = request.query;
    const original = await fetch(url);
    const dom = new JSDOM(await original.text(), { url: url });
    const reader = new Readability(selector ? dom.window.document.querySelector(selector) : dom.window.document);
    const article = reader.parse();

    response.json(toTelePageContent(article.content));
//     response.send(
//         `<!DOCTYPE html>
// <html lang="en">
//   <head>
//     <meta charset="utf-8">
//     <title>${article.title} - ${article.byline} - ${article.siteName}</title>
//     <!--<link rel="stylesheet" href="style.css">
//     <script src="script.js"></script>-->
//   </head>
//   <body>
//     <h1>${article.title} - ${article.byline}</h1>
//     ${article.content}
//   </body>
// </html>
// `);
};


function toTelePageContent(html) {
  // Ref:
  // https://github.com/jacoduplessis/telegraph/blob/7162616eef54dd2331dc45a750ae1e05a61c1146/telegraph/utils.py#L22
  function ttpc(node) {
    if (!node.tagName) {
      return node.textContent.trim() || null;
    }

    const pageNode = {
      tag: node.tagName,
      attrs: Object.entries(Array.from(node.attributes).map(attr => [attr.name, attr.value])),
    };
    if (node.hasChildNodes()) {
      pageNode.children = [];
      for (const child of node.childNodes) {
        const content = ttpc(child);
        if (content !== null) {
          pageNode.children.push(content);
        }
      }
    }
    return pageNode;
  }
  const dom = new JSDOM(html);
  return ttpc(dom.window.document.querySelector("body")).children;
}
