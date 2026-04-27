const crypto = require("crypto");
const { buildReadableMeta } = require("../lib/server/readability");
const { createTelegramClient } = require("../lib/server/telegram");
const { constructIvUrl, constructReadableUrl } = require("../lib/server/config");

const START_MESSAGE = `Just send an article link here.
It will be converted to a readable webpage with Instant View.`;

module.exports = async (request, response) => {
  try {
    const bot = createTelegramClient(process.env.BOT_TOKEN);
    const inlineQuery = request.body?.inline_query;
    const message = request.body?.message;

    if (inlineQuery?.query?.trim()) {
      const url = tryFixUrl(inlineQuery.query);
      if (!url) {
        response.status(200).send("");
        return;
      }
      const { meta } = await buildReadableMeta(url, request.headers);
      const renderedMessage = renderMessage(url, meta, request);
      try {
        await bot.answerInlineQuery(
          inlineQuery.id,
          [
            {
              type: "article",
              id: sha256(url),
              title: meta.title ?? "<UNTITLED>",
              description: meta.excerpt,
              input_message_content: {
                message_text: renderedMessage,
                disable_web_page_preview: false,
                parse_mode: "HTML",
              },
            },
          ],
          { is_personal: false, cache_time: 900 }
        );
      } catch (error) {
        console.error(error);
      }
    } else if (message?.text?.trim()) {
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
            const { meta } = await buildReadableMeta(url, request.headers);
            rendered = renderMessage(url, meta, request);
          } catch (error) {
            if (message.chat.type === "private") {
              await bot.sendMessage(
                message.chat.id,
                `Failed to fetch the URL with error:\n<pre>${error
                  .toString()
                  .replaceAll("&", "&amp;")
                  .replaceAll("<", "&lt;")
                  .replaceAll(">", "&gt;")
                  .replaceAll('"', "&quot;")}</pre>`,
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
  } catch (error) {
    console.error(error);
    response.status(200).send(error.message ?? String(error));
  }
};

function renderMessage(url, meta, request) {
  const readableUrl = escapeHtml(constructReadableUrl(url, request));
  const ivUrl = escapeHtml(constructIvUrl(url, request));
  const sourceUrl = escapeHtml(url);
  const label = escapeHtml(meta.title ?? "Untitled Article");
  const source = escapeHtml(meta.byline ?? meta.siteName ?? new URL(url).hostname);
  return `<a href="${ivUrl}"> </a><a href="${readableUrl}">${label}</a>\n${source} (<a href="${sourceUrl}">source</a>)`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
