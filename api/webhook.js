const { Readability } = require('@mozilla/readability');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const normalizeUrl = require('normalize-url');
const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAPH_TOKEN = process.env.TELEGRAPH_TOKEN;

const bot = new TelegramBot(token);

module.exports = async (request, response) => {
  const inlineQuery = request.body.inline_query;
  if (inlineQuery) {
    const url = normalizeUrl(inlineQuery.query.url);
    const readableUrl = `https://readability-bot.vercel.com/api/readability?url=` + encodeURIComponent(url);
    const message = `<>`
    bot.answerInlineQuery(inlineQuery.id, [{ type: "article", id: url, title: "Test", url, input_message_content: { message_text: message, parse_mode: "HTML" } }])
    // const original = await fetch(url);
    // const dom = new JSDOM(await original.text(), { url: url });
    // const reader = new Readability(dom.window.document);
    // const article = reader.parse();
    // const pageContent = toTelePageContent(article);


  }

  //   const { url, selector } = request.query;
  //   const original = await fetch(url);
  //   const dom = new JSDOM(await original.text(), { url: url });
  //   const reader = new Readability(selector ? dom.window.document.querySelector(selector) : dom.window.document);
  //   const article = reader.parse();
  //   response.json(toTelePageContent(article));
  // //     `<!DOCTYPE html>
  // // <html lang="en">
  // //   <head>
  // //     <meta charset="utf-8">
  // //     <title>${article.title} - ${article.byline} - ${article.siteName}</title>
  // //     <!--<link rel="stylesheet" href="style.css">
  // //     <script src="script.js"></script>-->
  // //   </head>
  // //   <body>
  // //     <h1>${article.title} - ${article.byline}</h1>
  // //     ${article.content}
  // //   </body>
  // // </html>
  // // `);
};
