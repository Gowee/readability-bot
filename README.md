# Readability Bot

A wrapper around [Readability.js](https://github.com/mozilla/readability).

_Telegram bot: [@Readabbot](https://t.me/readabbot)_

_Web app: https://readability-bot.vercel.app_

## API

**Endpoint**: `/api/readability?url={URL}&format=json` ([e.g.](https://readability-bot.vercel.app/api/readability?url=https%3A%2F%2Fwww.zaobao.com%2Fnews%2Fchina%2Fstory20211002-1199284&format=json))

Returns a self-explanatory JSON inherited from Readability.js.

## Instant View for any\* website

### Bot

The Telegram bot returns "readable" articles with Instant View enabled automatically.

### Web service

It is also possbile to apply a quick Instant View to any\* website programmatically with the help of the web service.
Assuming `ARTICLE_TITLE="Lorem Ipsum"`, `ARTICLE_URL="https://example.org/blog-post/1"` and `CHANNEL` is the ID of channel, which typically is the subscribing channel for a (news/blog/etc.) website:

**JavaScript**:

```js
const readableUrl = `https://readability-bot.vercel.app?url=${encodeURIComponent(
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
  readable_url = f'https://readability-bot.vercel.app?url={percent_encode(ARTICLE_URL, safe="")}';
  iv_url = f'https://t.me/iv?url={percent_encode(readable_url, safe="")}&rhash=71b64d09b0a20d';

  message = f'<a href="{iv_url}"> </a><a href="{article_url}">{articleTitle}</a>';
  bot.send_message(CHANNEL, message, parse_mode="html") # await it?
```

<sup><sub>\*: Almost, with no guarantee. Compatibility issues for specific websites are generally not accepted in this project. Please report those to [readability.js](https://github.com/mozilla/readability), **if applicable**.</sub></sup>

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/gowee/readability-bot&template=svelte)

And, some [environment variables](https://vercel.com/docs/concepts/projects/environment-variables) are expected:
- [`BOT_TOKEN`](https://core.telegram.org/bots/features#botfather): REQUIRED for the bot service. Do not forget to [set the webhook address](https://core.telegram.org/bots/webhooks#how-do-i-set-a-webhook-for-either-type) to `{APP_URL}/api/webhook`.
- `APP_URL`: Optional, inferred automatically from Vercel runtime. e.g. `https://readability-bot.vercel.app`
- `READABILITY_API_URL`: Optional, inferred automatically from Vercel runtime. e.g. `https://readability-bot.vercel.app/api/readability`
- `IV_RHASH`: Optional, [71b64d09b0a20d](rules.iv) is used by default.

### Run locally
`npx vercel dev`
