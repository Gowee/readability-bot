# Readability Bot

A Vercel app that combines:
- a simple web entrance
- a readable article extraction API
- a Telegram webhook for bot updates

_Telegram bot: [@Readabbot](https://t.me/readabbot)_

_Web app: https://readability-bot.vercel.app_

## Project structure

```text
api/           Vercel serverless functions
lib/server/    shared backend logic used by the API handlers
public/        static assets copied as-is by Vite
src/           Svelte frontend
```

## API

**Endpoint**: `/api/readability?url={URL}&format=json` ([e.g.](https://readability-bot.vercel.app/api/readability?url=https%3A%2F%2Fwww.zaobao.com%2Fnews%2Fchina%2Fstory20211002-1199284&format=json))

Returns either:
- HTML: a cleaned article page
- JSON: the extracted Readability payload when `format=json`

**Optional parameters:**

- `?summary=0` — Disable AI-generated summary (enabled by default). Example:
  `https://readability-bot.vercel.app/api/readability?url=...&summary=0`

  When enabled, the API generates a 2-3 sentence summary of the article text
  using an external LLM. The summary appears as a styled block in the HTML view
  and as the `summary` field in the JSON response. If the LLM is unavailable,
  the summary is silently omitted.

## Instant View for any\* website

### Bot

The Telegram bot returns "readable" articles with Instant View enabled automatically.

### Web service

It is also possbile to apply a quick Instant View to any\* website programmatically with the help of the web service.
Assuming `ARTICLE_TITLE="Lorem Ipsum"`, `ARTICLE_URL="https://example.org/blog-post/1"` and `CHANNEL` is the ID of channel, which typically is the subscribing channel for a (news/blog/etc.) website:

**JavaScript**:

```js
const readableUrl = `https://readability-bot.vercel.app/api/readability?url=${encodeURIComponent(
  ARTICLE_URL
)}`;
const ivUrl = `https://t.me/iv?url=${encodeURIComponent(
  readableUrl
)}&rhash=71b64d09b0a20d`;

const message = `<a href="${ivUrl}"> </a><a href="${articleUrl}">${ARTICLE_TITLE}</a>`;
bot.sendMessage(CHANNEL, message, (parseMode = "html"));
```

**Python**:

```py
  import urllib.parse import quote as percent_encode
  # ... ...
  readable_url = f'https://readability-bot.vercel.app/api/readability?url={percent_encode(ARTICLE_URL, safe="")}';
  iv_url = f'https://t.me/iv?url={percent_encode(readable_url, safe="")}&rhash=71b64d09b0a20d';

  message = f'<a href="{iv_url}"> </a><a href="{article_url}">{articleTitle}</a>';
  bot.send_message(CHANNEL, message, parse_mode="html") # await it?
```

<sup><sub>\*: Almost, with no guarantee. Instant View may fail to render when the source
page has deeply nested HTML structures, or when Telegram is unable to fetch
external media (e.g. hotlink-protected images). Compatibility issues about
Instant View rendering are welcome in this project; issues about the article
extraction itself should go to
[readability.js](https://github.com/mozilla/readability).</sub></sup>

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/gowee/readability-bot&template=svelte)

Set these [environment variables](https://vercel.com/docs/concepts/projects/environment-variables):
- [`BOT_TOKEN`](https://core.telegram.org/bots/features#botfather): REQUIRED for the bot service. Do not forget to [set the webhook address](https://core.telegram.org/bots/webhooks#how-do-i-set-a-webhook-for-either-type) to `{APP_URL}/api/webhook`.
- `APP_URL`: Optional, inferred automatically from request headers on Vercel.
- `READABILITY_API_URL`: Optional, inferred automatically as `{APP_URL}/api/readability`.
- `IV_RHASH`: Required for Instant View to render. Create a custom IV template by tracking an article link of the deployed instance in [instantview.telegram.org](https://instantview.telegram.org/my/), apply [rules.iv](rules.iv) as the template rules, and pick the rhash value at the end of the preview link. The template editor there also shows detailed IV rendering errors, which is useful for debugging failures.

### Run locally

```bash
npm install
npm run dev
```

### Deploy

```bash
npx vercel deploy --prod
```
