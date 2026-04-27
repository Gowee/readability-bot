function createTelegramClient(botToken) {
  if (!botToken) {
    throw new Error("BOT_TOKEN is not configured");
  }

  return {
    answerInlineQuery(inlineQueryId, results, options = {}) {
      return callTelegramApi(botToken, "answerInlineQuery", {
        inline_query_id: inlineQueryId,
        results,
        ...options,
      });
    },
    sendMessage(chatId, text, options = {}) {
      return callTelegramApi(botToken, "sendMessage", {
        chat_id: chatId,
        text,
        ...options,
      });
    },
  };
}

async function callTelegramApi(botToken, method, body) {
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

  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(`Telegram API rejected ${method}: ${payload.description}`);
  }

  return payload.result;
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

module.exports = {
  createTelegramClient,
};
