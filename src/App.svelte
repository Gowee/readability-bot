<script>
	import { onMount } from "svelte";
	let inputRef = null;
	onMount(() => {
		inputRef.focus();
	});
</script>

<main>
	<div class="wrapper">
		<h1>Readability Bot</h1>
		<form action="/api/readability" method="get">
			<div class="form-row">
				<input
					name="url"
					type="url"
					required
					placeholder='Link to an "unreadable" article'
					bind:this={inputRef}
				/>
				<button type="submit">Read</button>
			</div>
		</form>
		<nav>
			Telegram:
			<a href="https://t.me/ReadabBot" target="_blank" rel="noreferrer">@ReadabBot</a>
			<span aria-hidden="true">|</span>
			<a href="https://github.com/gowee/readability-bot" target="_blank" rel="noreferrer">Source</a>
		</nav>
		<footer>
			<small>
				The
				<a href="https://github.com/gowee/readability-bot" target="_blank" rel="noreferrer">service</a>
				is powered by
				<a href="https://github.com/mozilla/readability" target="_blank" rel="noreferrer">Readability.js</a>
				and hosted on
				<a href="https://vercel.com/" target="_blank" rel="noreferrer">Vercel</a>.
			</small>
		</footer>
	</div>
</main>

<style>
	main {
		display: flex;
		justify-content: center;
		padding: 5rem 1.25rem 1.5rem;
	}

	.wrapper {
		width: min(40rem, 100%);
		text-align: center;
	}

	h1 {
		margin: 0 0 2.5rem;
		color: #ff3e00;
		text-transform: uppercase;
		font-size: clamp(2.2em, 8vw, 3.6em);
		font-weight: 100;
		letter-spacing: 0.02em;
	}

	.form-row {
		display: flex;
		gap: 0.5rem;
		margin: 0 auto;
		max-width: 40rem;
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0.7rem 1.2rem;
		border: 1px solid #ccc;
		border-radius: 999px;
		font: inherit;
		font-size: 1rem;
		text-align: center;
		outline: none;
	}

	input:focus {
		border-color: #ff3e00;
		box-shadow: 0 0 0 2px rgba(255, 62, 0, 0.15);
	}

	button {
		padding: 0.7rem 1.6rem;
		border: 1px solid #3273dc;
		border-radius: 999px;
		background: transparent;
		color: #3273dc;
		font: inherit;
		font-size: 1rem;
		cursor: pointer;
		white-space: nowrap;
	}

	button:hover {
		background: #3273dc;
		color: #fff;
	}

	nav {
		margin-top: 1.5rem;
		color: #666;
		font-size: 0.95rem;
	}

	nav a {
		color: inherit;
	}

	nav span {
		padding: 0 4px;
	}

	footer {
		margin-top: 2rem;
		color: #999;
		font-size: 0.8rem;
	}

	footer a {
		color: inherit;
	}
</style>
