interface TelegramClient {
  answerInlineQuery(inlineQueryId: string, results: unknown[], options?: Record<string, unknown>): Promise<unknown>;
  sendMessage(chatId: string | number, text: string, options?: Record<string, unknown>): Promise<unknown>;
}

export function createTelegramClient(botToken: string | undefined): TelegramClient {
  if (!botToken) {
    throw new Error("BOT_TOKEN is not configured");
  }

  return {
    answerInlineQuery(inlineQueryId: string, results: unknown[], options = {}) {
      return callTelegramApi(botToken, "answerInlineQuery", {
        inline_query_id: inlineQueryId,
        results,
        ...options,
      });
    },
    sendMessage(chatId: string | number, text: string, options = {}) {
      return callTelegramApi(botToken, "sendMessage", {
        chat_id: chatId,
        text,
        ...options,
      });
    },
  };
}

async function callTelegramApi(botToken: string, method: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await safeReadText(response);
    throw new Error(`Telegram API error: ${response.status} ${response.statusText}\n${payload}`);
  }

  const payload: { ok: boolean; description?: string; result?: unknown } = await response.json();
  if (!payload.ok) {
    throw new Error(`Telegram API rejected ${method}: ${payload.description}`);
  }

  return payload.result;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
