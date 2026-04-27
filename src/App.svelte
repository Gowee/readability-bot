<script>
  const apiExample =
    "/api/readability?url=https%3A%2F%2Fexample.org%2Farticle&format=json";
</script>

<svelte:head>
  <title>Readability Bot</title>
</svelte:head>

<main class="page-shell">
  <section class="hero">
    <p class="eyebrow">Telegram bot + article extraction API</p>
    <h1>Readability Bot</h1>
    <p class="lede">
      Submit any article URL to get a cleaned reading view, a JSON payload from
      Mozilla Readability, or a Telegram-ready Instant View link.
    </p>

    <form class="lookup" action="/api/readability" method="get">
      <label class="sr-only" for="url">Article URL</label>
      <input
        id="url"
        name="url"
        type="url"
        required
        placeholder="https://example.org/article"
        autocomplete="url"
      />
      <button type="submit">Open article</button>
    </form>

    <div class="actions">
      <a href="https://t.me/ReadabBot" target="_blank" rel="noreferrer">
        Open Telegram bot
      </a>
      <a
        href="https://github.com/gowee/readability-bot"
        target="_blank"
        rel="noreferrer"
      >
        Source repository
      </a>
    </div>
  </section>

  <section class="grid">
    <article class="card">
      <p class="card-label">API</p>
      <h2>Readable output</h2>
      <p>
        `GET /api/readability?url=...` returns an extracted article page. Add
        `format=json` for the structured Readability payload.
      </p>
      <code>{apiExample}</code>
    </article>

    <article class="card">
      <p class="card-label">Webhook</p>
      <h2>Telegram integration</h2>
      <p>
        Configure Telegram to POST updates to `/api/webhook` and the function
        will respond with extracted article links and Instant View markup.
      </p>
    </article>

    <article class="card">
      <p class="card-label">Deploy</p>
      <h2>Vercel-first layout</h2>
      <p>
        The frontend is built with Vite, while serverless functions stay under
        `api/` and shared backend logic lives in `lib/server/`.
      </p>
    </article>
  </section>
</main>
