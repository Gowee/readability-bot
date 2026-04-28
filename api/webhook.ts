import crypto from "node:crypto";
import { checkRateLimit } from "@vercel/firewall";
import { buildReadableMeta } from "../lib/server/readability.js";
import { createTelegramClient } from "../lib/server/telegram.js";
import { constructIvUrl, constructReadableUrl } from "../lib/server/config.js";

const START_MESSAGE = `Just send an article link here.
It will be converted to a readable webpage with Instant View.`;

interface VercelRequest {
  headers: Record<string, string | undefined>;
  body?: TelegramUpdate;
}

interface VercelResponse {
  send(body: string): VercelResponse;
  status(code: number): VercelResponse;
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramInlineQuery {
  id: string;
  query: string;
  from: TelegramUser;
}

interface TelegramMessage {
  chat: { id: number; type: string };
  text?: string;
  from?: TelegramUser;
}

interface TelegramUpdate {
  inline_query?: TelegramInlineQuery;
  message?: TelegramMessage;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  try {
    const bot = createTelegramClient(process.env.BOT_TOKEN);
    const inlineQuery = request.body?.inline_query;
    const message = request.body?.message;
    const user = message?.from ?? inlineQuery?.from;
    const userId = user?.id;
    const type = inlineQuery ? "inline_query" : "message";

    const logRequest = (extra: Record<string, unknown> = {}) => {
      const entry: Record<string, unknown> = {
        type,
        ...(user ? {
          user_id: user.id,
          username: user.username,
          name: [user.first_name, user.last_name].filter(Boolean).join(" ") || undefined,
        } : {}),
        ...extra,
      };
      console.log(JSON.stringify(entry));
    };

    if (userId) {
      const { rateLimited } = await checkRateLimit("telegram_user_request", {
        request: request as unknown as Request,
        rateLimitKey: String(userId),
      });
      if (rateLimited) {
        logRequest({ rate_limited: true });
        response.status(429).send("Too Many Requests");
        return;
      }
    }

    if (inlineQuery?.query?.trim()) {
      const url = tryFixUrl(inlineQuery.query);
      if (!url) {
        logRequest({ url: inlineQuery.query, valid_url: false });
        response.status(200).send("");
        return;
      }
      logRequest({ url });
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
        logRequest();
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
          logRequest({ url });
          let rendered: string;
          try {
            const { meta } = await buildReadableMeta(url, request.headers);
            rendered = renderMessage(url, meta, request);
          } catch (error) {
            if (message.chat.type === "private") {
              await bot.sendMessage(
                message.chat.id,
                `Failed to fetch the URL with error:\n<pre>${String(error)
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
          logRequest({ url: message.text, valid_url: false });
          if (message.chat.type === "private") {
            await bot.sendMessage(message.chat.id, "It is not a valid URL.");
          }
        }
      }
    }
    response.status(204).send("");
  } catch (error) {
    console.error(error);
    response.status(200).send(String(error instanceof Error ? error.message : error));
  }
}

function renderMessage(url: string, meta: { title?: string | null; excerpt?: string | null; byline?: string | null; siteName?: string | null }, request: { headers?: Record<string, string | undefined> }): string {
  const readableUrl = escapeHtml(constructReadableUrl(url, request));
  const ivUrl = escapeHtml(constructIvUrl(url, request));
  const sourceUrl = escapeHtml(url);
  const label = escapeHtml(meta.title ?? "Untitled Article");
  const source = escapeHtml(meta.byline ?? meta.siteName ?? new URL(url).hostname);
  return `<a href="${ivUrl}"> </a><a href="${readableUrl}">${label}</a>\n${source} (<a href="${sourceUrl}">source</a>)`;
}

function tryFixUrl(url: string): string | null {
  try {
    let fixed = url;
    if (!fixed.startsWith("http")) {
      fixed = "http://" + fixed;
    }
    new URL(fixed);
    return fixed;
  } catch {
    return null;
  }
}

function sha256(input: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
