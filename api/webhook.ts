import crypto from "node:crypto";
import { encode as escapeHtml } from "html-entities";
import { checkRateLimit } from "@vercel/firewall";
import { buildReadableMeta } from "../lib/server/readability.js";
import { extractFirstLinkFromText } from "../lib/server/telegram-message.js";
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
  is_bot?: boolean;
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
  caption?: string;
  from?: TelegramUser;
  entities?: TelegramMessageEntity[];
  caption_entities?: TelegramMessageEntity[];
  guest_query_id?: string;
  reply_to_message?: TelegramMessage;
  guest_bot_caller_user?: TelegramUser;
}

interface TelegramMessageEntity {
  type?: string;
  offset?: number;
  length?: number;
  url?: string;
}

interface UrlExtractionDiagnosis {
  source: "message" | "message_caption" | "reply_to_message" | "reply_to_message_caption";
  text: string;
  entities: TelegramMessageEntity[];
  extracted: string | null;
  normalized: string | null;
}

interface RenderedMeta {
  title?: string | null;
  excerpt?: string | null;
  byline?: string | null;
  siteName?: string | null;
}

interface TelegramUpdate {
  inline_query?: TelegramInlineQuery;
  message?: TelegramMessage;
  guest_message?: TelegramMessage;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  try {
    const bot = createTelegramClient(process.env.BOT_TOKEN);
    const currentBotId = extractBotId(process.env.BOT_TOKEN);
    const inlineQuery = request.body?.inline_query;
    const message = request.body?.message;
    const guestMessage = request.body?.guest_message;
    const user = message?.from ?? guestMessage?.guest_bot_caller_user ?? inlineQuery?.from;
    const userId = user?.id;
    const type = inlineQuery ? "inline_query" : guestMessage ? "guest_message" : "message";

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
      try {
        const { meta } = await buildReadableMeta(url, request.headers);
        const renderedMessage = renderMessage(url, meta);
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
        const errorText = String(error instanceof Error ? error.message : error);
        logRequest({
          url,
          fetch_failed: true,
          error: serializeError(error),
        });
        try {
          await bot.answerInlineQuery(
            inlineQuery.id,
            [
              {
                type: "article",
                id: sha256(url),
                title: "⚠️ Error fetching article",
                description: errorText.slice(0, 256),
                input_message_content: {
                  message_text: `⚠️ Failed to fetch the URL:\n${escapeHtml(errorText)}`,
                },
              },
            ],
            { is_personal: true, cache_time: 0 }
          );
        } catch (answerError) {
          console.error(answerError);
        }
      }
    } else if (guestMessage?.text?.trim() && guestMessage.guest_query_id) {
      if (currentBotId && guestMessage.reply_to_message?.from?.id === currentBotId) {
        logRequest({
          ignored: "guest_reply_to_self_message",
        });
        response.status(204).send("");
        return;
      }

      const diagnosis = diagnoseMessageUrlExtraction(guestMessage.reply_to_message, "reply_to_message")
        ?? diagnoseMessageUrlExtraction(guestMessage, "message")
        ?? emptyUrlExtractionDiagnosis("message");
      const url = diagnosis.normalized;
      if (url) {
        logRequest({ url });
        try {
          const { meta } = await buildReadableMeta(url, request.headers);
          await bot.answerGuestQuery(guestMessage.guest_query_id, buildGuestArticleResult(url, meta));
        } catch (error) {
          console.error(error);
          logRequest({
            url,
            extraction: diagnosis,
            fetch_failed: true,
            error: serializeError(error),
          });
          await bot.answerGuestQuery(
            guestMessage.guest_query_id,
            buildGuestErrorResult(
              `error:${guestMessage.guest_query_id}`,
              "⚠️ Error fetching article",
              `⚠️ Failed to fetch the URL with error:\n<pre>${escapeHtml(String(error))}</pre>`
            )
          );
        }
      } else {
        logRequest({ valid_url: false, extraction: diagnosis, guest_message_snapshot: summarizeTelegramMessage(guestMessage) });
        await bot.answerGuestQuery(
          guestMessage.guest_query_id,
          buildGuestErrorResult("invalid-url", "⚠️ Invalid URL", "⚠️ It is not a valid URL.")
        );
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
        const diagnosis = diagnoseMessageUrlExtraction(message, "message")
          ?? emptyUrlExtractionDiagnosis("message");
        const url = diagnosis.normalized;
        if (url) {
          logRequest({ url });
          let rendered: string | undefined;
          try {
            const { meta } = await buildReadableMeta(url, request.headers);
            rendered = renderMessage(url, meta);
          } catch (error) {
            logRequest({
              url,
              extraction: diagnosis,
              fetch_failed: true,
              error: serializeError(error),
            });
            if (message.chat.type === "private") {
              await bot.sendMessage(
                message.chat.id,
                `⚠️ Failed to fetch the URL with error:\n<pre>${escapeHtml(String(error))}</pre>`,
                { parse_mode: "HTML" }
              );
            }
            // Fall through — always respond 20x to the webhook
          }
          if (rendered) {
            await bot.sendMessage(message.chat.id, rendered, {
              disable_web_page_preview: false,
              parse_mode: "HTML",
            });
          }
        } else {
          logRequest({ valid_url: false, extraction: diagnosis });
          if (message.chat.type === "private") {
            await bot.sendMessage(message.chat.id, "⚠️ It is not a valid URL.");
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

function renderMessage(url: string, meta: RenderedMeta): string {
  const readableUrl = escapeHtml(constructReadableUrl(url));
  const ivUrl = escapeHtml(constructIvUrl(url));
  const sourceUrl = escapeHtml(url);
  const label = escapeHtml(meta.title ?? "Untitled Article");
  const source = escapeHtml(meta.byline ?? meta.siteName ?? new URL(url).hostname);
  return `<a href="${ivUrl}"> </a><a href="${readableUrl}">${label}</a>\n${source} (<a href="${sourceUrl}">source</a>)`;
}

function buildGuestArticleResult(url: string, meta: RenderedMeta): Record<string, unknown> {
  return {
    type: "article",
    id: sha256(`guest:${url}`),
    title: meta.title ?? "Untitled Article",
    description: meta.excerpt ?? undefined,
    input_message_content: {
      message_text: renderMessage(url, meta),
      parse_mode: "HTML",
      disable_web_page_preview: false,
    },
  };
}

function buildGuestErrorResult(id: string, title: string, messageText: string): Record<string, unknown> {
  return {
    type: "article",
    id: sha256(`guest:${id}`),
    title,
    input_message_content: {
      message_text: messageText,
      parse_mode: "HTML",
    },
  };
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

function diagnoseUrlExtraction(
  source: "message" | "message_caption" | "reply_to_message" | "reply_to_message_caption",
  text: string,
  entities: TelegramMessageEntity[] | undefined
): UrlExtractionDiagnosis {
  const extracted = extractFirstLinkFromText(text, entities);
  return {
    source,
    text,
    entities: entities ?? [],
    extracted,
    normalized: extracted ? tryFixUrl(extracted) : null,
  };
}

function diagnoseMessageUrlExtraction(
  message: TelegramMessage | undefined,
  source: "message" | "reply_to_message"
): UrlExtractionDiagnosis | null {
  if (message?.text?.trim()) {
    return diagnoseUrlExtraction(
      source,
      message.text,
      message.entities
    );
  }

  if (message?.caption?.trim()) {
    return diagnoseUrlExtraction(
      source === "reply_to_message" ? "reply_to_message_caption" : "message_caption",
      message.caption,
      message.caption_entities
    );
  }

  return null;
}

function summarizeTelegramMessage(message: TelegramMessage | undefined): Record<string, unknown> | null {
  if (!message) {
    return null;
  }

  return {
    has_text: Boolean(message.text),
    has_caption: Boolean(message.caption),
    text: message.text,
    caption: message.caption,
    entities: message.entities ?? [],
    caption_entities: message.caption_entities ?? [],
    reply_to_message: message.reply_to_message
      ? {
          has_text: Boolean(message.reply_to_message.text),
          has_caption: Boolean(message.reply_to_message.caption),
          text: message.reply_to_message.text,
          caption: message.reply_to_message.caption,
          entities: message.reply_to_message.entities ?? [],
          caption_entities: message.reply_to_message.caption_entities ?? [],
        }
      : null,
  };
}

function emptyUrlExtractionDiagnosis(
  source: "message" | "reply_to_message"
): UrlExtractionDiagnosis {
  return {
    source,
    text: "",
    entities: [],
    extracted: null,
    normalized: null,
  };
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function extractBotId(botToken: string | undefined): number | null {
  if (!botToken) {
    return null;
  }

  const botId = Number(botToken.split(":", 1)[0]);
  return Number.isSafeInteger(botId) ? botId : null;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
