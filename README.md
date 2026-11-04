# Local Writer

A private browser writing assistant. Text is processed on your device using WebGPU.

## Development

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

No backend, API keys, analytics, or automatic text persistence. Initial model downloads require internet access. Model quality varies; review output before using it.

## Features

Fix grammar, change tone, shorten, summarize, format, simplify, expand, or make writing more direct or warmer up to 500 words / 6,000 characters. Grammar changes have a word-level review. Results are editable, copyable, and reusable with one-step input undo.

## Device and privacy

Use a recent desktop browser with WebGPU and hardware acceleration. HTTPS or localhost is required. Click **Download / load model** to authorize model downloads; nothing downloads automatically. The small model needs about 280 MB of weights and approximately 945 MB GPU memory; the larger model about 870 MB of weights and 1.6 GB GPU memory, plus runtime overhead.

Text stays in browser memory. There are no accounts, analytics, text uploads, or saved drafts. Clipboard writes happen only when you press Copy. Model downloads contact Hugging Face and the runtime host. Model prompts are guidance, not guarantees: review meaning, facts and protected terms.

Clear removes editor text, review snapshots, undo history and unloads the worker. Stopping terminates the worker; load the cached model again to continue. Remove model cache deletes the selected model through WebLLM. To remove all application storage, use your browser's site-data controls. Browser cache eviction or missing runtime assets can prevent offline use. Updates take effect after existing tabs close, preserving active drafts.

## Validation and limitations

See [evaluation instructions and current results](docs/evaluation.md) and [30 quality cases](docs/evaluation-cases.json). Real model inference and quality need verification on a WebGPU-capable device. App tests use fake inference for deterministic interaction checks; they do not prove model quality.

`npm run test:e2e` checks the built app with Chromium. `npm run format:check` checks formatting. GitHub Actions runs type checks, unit/component tests, build, browser tests and a production dependency audit. No deployment is configured.

For a local runtime mirror, set `VITE_RUNTIME_BASE_URL` to a trailing-slash URL
in `.env.local`, then rebuild. Place the exact Wasm files named by the installed
WebLLM configuration at that URL. Model weights still download from Hugging Face.
Without this setting, WebLLM uses its default runtime host.
