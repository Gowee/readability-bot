const crypto = require("crypto");
const { Readability } = require("@mozilla/readability");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const normalizeUrl = require("normalize-url");
const TelegramBot = require("node-telegram-bot-api");

// import  { Readability } from '@mozilla/readability';
// import fetch from 'node-fetch';
// import { JSDOM } from 'jsdom';
// import normalizeUrl from 'normalize-url';
// import TelegramBot from 'node-telegram-bot-api';

// process.env.NTBA_FIX_319 = "test";
const READABILITY_API_URL = getApiUrlFromEnv();
const IV_RHASH = process.env.IV_RHASH ?? "261b1281223eaa";
const BOT_TOKEN = process.env.BOT_TOKEN;
// console.log("Using API:", READABILITY_API_URL, ", IV RHASH:", IV_RHASH);

// const TELEGRAPH_TOKEN = process.env.TELEGRAPH_TOKEN;

const bot = new TelegramBot(BOT_TOKEN);

module.exports = async (request, response) => {
  try {
    const inlineQuery = request.body.inline_query;
    const message = request.body.message;
    if (inlineQuery && inlineQuery.query.trim()) {
      const url = tryFixUrl(inlineQuery.query);
      if (!url) {
        return;
      }
      const metaUrl = `${READABILITY_API_URL}?url=${encodeURIComponent(
        url
      )}&type=json`;
      const meta = await (await fetch(metaUrl)).json();
      const message = await renderMessage(url, meta);
      try {
        await bot.answerInlineQuery(inlineQuery.id, [
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
        ]);
      } catch (_e) {
        // a possible case is expired query
        console.error(_e);
      }
    } else if (message && message.text.trim()) {
      if (message.text.trim() === "/start") {
        await bot.sendMessage(
          message.chat.id,
          "Just send an article link here. It will be converted to a readable webpage with Instant View."
        );
      } else {
        const url = tryFixUrl(message.text);
        if (url) {
          let rendered;
          try {
            rendered = await renderMessage(url, meta);
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

async function renderMessage(url, meta) {
  const readableUrl = `${READABILITY_API_URL}?url=${encodeURIComponent(url)}`;
  const ivUrl = `https://t.me/iv?url=${encodeURIComponent(
    readableUrl
  )}&rhash=${IV_RHASH}`;
  return `<a href="${ivUrl}"> </a><a href="${readableUrl}">${
    meta.title ?? "Untitlted Article"
  }</a>\n${
    meta.byline ?? meta.siteName ?? new URL(url).hostname
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

function getApiUrlFromEnv() {
  if (process.env.READABILITY_API_URL) {
    return process.env.READABILITY_API_URL;
  } else if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL + "/api/readability";
  } else {
    return "https://readability-bot.vercel.com/api/readability";
  }
}
