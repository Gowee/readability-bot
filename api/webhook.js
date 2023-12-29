const crypto = require("crypto");
const fetch = require("node-fetch");
const TelegramBot = require("node-telegram-bot-api");

const { READABILITY_API_URL, constructIvUrl, BOT_TOKEN } = require("./_common.js");

// process.env.NTBA_FIX_319 = "test"; // https://github.com/yagop/node-telegram-bot-api/issues/540

const START_MESSAGE = `Just send an article link here.
It will be converted to a readable webpage with Instant View.`;

const bot = new TelegramBot(BOT_TOKEN);
console.log(BOT_TOKEN);

module.exports = async (request, response) => {
  try {
    const inlineQuery = request.body.inline_query;
    const message = request.body.message;
    if (inlineQuery && inlineQuery.query.trim()) {
      const url = tryFixUrl(inlineQuery.query);
      if (!url) {
        return;
      }
      const meta = await fetchMeta(url);
      const message = renderMessage(url, meta);
      try {
        await bot.answerInlineQuery(
          inlineQuery.id,
          [
            {
              type: "article",
              id: sha256(url),
              title: meta.title,
              description: meta.excerpt,
              input_message_content: {
                message_text: message,
                disable_web_page_preview: false,
                parse_mode: "HTML",
              },
            },
          ],
          { is_personal: false, cache_time: 900 }
        );
      } catch (_e) {
        // a possible case is expired query
        console.error(_e);
      }
    } else if (message && message.text.trim()) {
      if (message.text.trim() === "/start") {
        await bot.sendMessage(message.chat.id, START_MESSAGE, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Try Inline Mode", switch_inline_query: "" }],
            ],
          },
        });
      } else {
        const url = tryFixUrl(message.text);
        if (url) {
          let rendered;
          try {
            const meta = await fetchMeta(url);
            rendered = renderMessage(url, meta);
          } catch (e) {
            if (message.chat.type === "private") {
              await bot.sendMessage(
                message.chat.id,
                `Failed to fetch the URL with error:\n <pre>${e
                  .toString()
                  .replace("<", "&lt;")
                  .replace(">", "&gt;")
                  .replace("&", "&amp;")
                  .replace('"', "&quot;")}</pre>`,
                { parse_mode: "HTML" }
              );
            }
            return;
          }
          await bot.sendMessage(message.chat.id, rendered, {
            disable_web_page_preview: false,
            parse_mode: "HTML",
          });
        } else {
          if (message.chat.type === "private") {
            await bot.sendMessage(message.chat.id, "It is not a valid URL.");
          }
        }
      }
    }
    response.status(204).send("");
    response = null;
  } catch (e) {
    // mark as success to avoid TG retrying
    response.status(200).send(e.toString());
    console.error(e);
    response = null;
  } finally {
    response && response.status(200).send("early return");
  }
};

function renderMessage(url, meta) {
  const ivUrl = constructIvUrl();
  return `<a href="${ivUrl}"> </a><a href="${readableUrl}">${meta.title ?? "Untitlted Article"
    }</a>\n ${meta.byline ?? meta.siteName ?? new URL(url).hostname
    } (<a href="${url}">source</a>)`;
}

function tryFixUrl(url) {
  try {
    if (!url.startsWith("http")) {
      url = "http://" + url;
    }
    const _ = new URL(url);
    return url;
  } catch (_e) {
    return null;
  }
}

function sha256(input) {
  // https://stackoverflow.com/a/29109842/5488616
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

async function fetchMeta(url) {
  const metaUrl = `${READABILITY_API_URL}?url=${encodeURIComponent(
    url
  )}&format=json`;
  const resp = await fetch(metaUrl);
  if (!resp.ok) {
    let body = "";
    try {
      body = await resp.text();
    } catch (_e) { }
    throw new Error(
      `Upstream HTTP Error: ${response.status} ${response.statusText}\n${body}`
    );
  }
  return await resp.json();
}
