import { DEFAULT_USER_AGENT_SUFFIX } from "./config.js";

const CHATJIMMY_URL = "https://chatjimmy.ai/api/chat";
const TIMEOUT_MS = 3_000;
const MAX_INPUT_CHARS = 8_000;

export async function generateSummary(
  textContent: string | null | undefined
): Promise<string | null> {
  if (!textContent || textContent.trim().length === 0) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const truncated = textContent.slice(0, MAX_INPUT_CHARS);

    const response = await fetch(CHATJIMMY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": DEFAULT_USER_AGENT_SUFFIX,
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `Summarize this article concisely in its original language:\n\n${truncated}`,
          },
        ],
        chatOptions: {
          selectedModel: "llama3.1-8B",
          systemPrompt:
            "You summarize articles. Rules:\n" +
            "- Write in the SAME language as the article (e.g. Chinese article → Chinese summary).\n" +
            "- Output ONLY the summary text. No preamble, no meta-commentary, no labels.\n" +
            "- Keep it to 2-3 sentences.",
          topK: 8,
        },
        attachment: null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(
        JSON.stringify({
          event: "summary_api_error",
          status: response.status,
          statusText: response.statusText,
        })
      );
      return null;
    }

    const raw = await response.text();
    const cleaned = stripPreamble(
      raw.replace(/<\|stats\|>[\s\S]*<\|\\?\/stats\|>/g, "").trim()
    );
    return cleaned.length > 0 ? cleaned : null;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.log(
        JSON.stringify({ event: "summary_timeout", timeout_ms: TIMEOUT_MS })
      );
    } else {
      console.log(
        JSON.stringify({
          event: "summary_error",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Strip common LLM preamble phrases that smaller models sometimes emit despite
// being told not to. Case-insensitive; stops after stripping at most one prefix.
function stripPreamble(text: string): string {
  const patterns = [
    /^Here is a (?:concise |\d[-, \d]*sentence )?summary (?:of the article|of the text)?:?\s*/i,
    /^Summary:?\s*/i,
    /^The article (?:is about|discusses|describes):?\s*/i,
  ];
  for (const pat of patterns) {
    text = text.replace(pat, "");
  }
  return text;
}
