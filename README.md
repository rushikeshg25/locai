# Locai

Chat with a language model, work through ideas, and revise drafts—all in your browser. Locai runs models on your device through WebGPU, with no account, API key, or model server.

Previously named Local Writer. Existing browser storage keys retain the old prefix so saved chats and preferences continue to work on the same origin.

The app is a static React application. Your browser downloads the model files and performs inference; the web server only serves the app.

## Get started

You need a browser with WebGPU support and hardware acceleration enabled. Open the app over **localhost or HTTPS**. Available GPU memory determines which models your device can run.

### Run with Docker

Clone the repository, then open its directory:

```sh
git clone https://github.com/rushikeshg25/locai.git
cd locai
```

From the repository root:

```sh
docker compose up --build -d --wait
```

Open **http://localhost:4174**.

```sh
# Use a different host port
PORT=8080 docker compose up --build -d --wait

# Stop the app
docker compose down
```

Docker does not need access to your GPU. Models and saved chats live in the browser, not the container. Restarting or rebuilding the container does not delete that browser data. Keep the same hostname and port to reuse it.

### Run with Node.js

Use Node.js 24 and npm, matching the Docker build and CI configuration.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. To build and preview the production app:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

The service worker and offline app cache are enabled in production builds, not the development server.

## Start a conversation

1. Open the model selector beside Send.
2. Choose a model and select **Download model**. The first download needs internet.
3. Wait for the model to be ready, then send a message.

Downloaded models load automatically on startup by default. You can disable **Auto-load downloaded model** in the selector. Sending before a model is ready opens the selector and preserves your draft.

**Downloading and loading are different.** Downloading saves weights in browser storage. Loading prepares those weights in GPU memory. Refreshing the page unloads the running model, so it must load again—even when no weights need downloading. Missing runtime or tokenizer files can still require internet.

## Chat workspace

- **Chat:** ask questions and continue conversations with context from completed turns.
- **Write:** fix grammar, adjust tone, shorten, summarize, format, simplify, expand, or make text more direct or warmer. Compare the original and revised wording.
- **Chat history:** search conversation titles and message text. Collapse the desktop sidebar into an icon rail for Expand, New chat, and Search. Mobile uses a drawer.
- **Reply actions:** copy, edit, reuse as input, or branch from a reply. Retry and edit/resend create a new branch while keeping the original conversation.
- **Attachments:** add plain-text or Markdown reference files. Their contents are included as text, not executed.
- **Display:** light and dark themes, Markdown replies, tables, code blocks with Copy, and streamed responses. Scrolling up pauses automatic following; **Jump to latest** returns to the reply.

New chat keeps the loaded model. Stop preserves partial output and normally leaves the model ready. If cancellation stalls, the worker is unloaded after five seconds.

### Keyboard controls

| Key                        | Action                                                                   |
| -------------------------- | ------------------------------------------------------------------------ |
| Enter                      | Send the draft                                                           |
| Shift+Enter                | Insert a new line                                                        |
| Ctrl+Enter / Command+Enter | Insert a new line at the cursor or replace selected text with a new line |
| Escape                     | Close an open model picker, chat menu, or mobile drawer                  |
| Tab / Shift+Tab            | Move between controls                                                    |

IME composition does not submit a message. Icon controls have accessible labels; model progress and feedback use live status messages. Reply animation respects reduced-motion preferences.

### Writing controls and limits

In Write mode, **Writing preferences** accepts a custom instruction and protected terms such as names or product identifiers. Missing protected terms are flagged for review. Select part of a draft or reply and use **Rewrite selected text** to start a separate writing request.

| Input                    | Limit                                             |
| ------------------------ | ------------------------------------------------- |
| Draft                    | 500 words and 6,000 characters                    |
| Attachments              | Up to 3 UTF-8 `.txt`, `.md`, or `.markdown` files |
| Combined attachment size | 24,000 bytes                                      |

The model context budget can impose a smaller limit. Older turns may be excluded to fit; an oversized newest request is rejected rather than silently truncated. **Context budget** shows a conservative byte-based estimate, not an exact token count.

## Models

All listed models use WebLLM-compatible quantized weights. Qwen 2.5 0.5B is the default because its download is small; it is not a measured quality winner.

| Model         | Approximate weights | Estimated GPU memory |
| ------------- | ------------------- | -------------------- |
| Qwen 2.5 0.5B | 280 MB              | 945 MB               |
| Qwen 2.5 1.5B | 870 MB              | 1.6 GB               |
| Llama 3.2 1B  | 695 MB              | 880 MB               |
| Llama 3.2 3B  | 1.81 GB             | 2.3 GB               |
| Qwen 2.5 3B   | 1.74 GB             | 2.5 GB               |
| Phi 3.5 Mini  | 2.15 GB             | 3.7 GB               |

These are estimates, not device compatibility guarantees. Runtime, tokenizer, browser, and cache overhead are additional. The model IDs and displayed estimates are defined in [`src/models.ts`](src/models.ts); runtime configuration comes from the installed WebLLM registry.

The model dropdown keeps progress and actions separate from the composer:

- **Download model** obtains missing files.
- **Load from device** reuses downloaded weights.
- **Unload** releases the running worker without deleting downloaded files.
- **Delete downloaded model** asks for confirmation, then removes the selected model's cached files. It does not delete chats.
- **Storage & details** shows storage estimates and offers **Keep downloads on device**, which requests persistent storage. The browser decides whether to grant it.

Switching models unloads the current worker. Initial downloads remain explicit; automatic startup loading only begins when the selected weights are detected in cache.

## Privacy, storage, and offline use

Messages and attachments are processed in this browser. Model downloads contact Hugging Face and the runtime host. There are no accounts or analytics, and no inference backend receives your messages. Generated HTML is disabled, and model-generated remote images are not fetched.

| Data                                        | Where it lives        | How long it stays                                  |
| ------------------------------------------- | --------------------- | -------------------------------------------------- |
| Unsaved chats and drafts                    | Current tab memory    | Lost on reload or when the tab closes              |
| Saved conversations and attachments         | Browser local storage | Until deleted or browser data is cleared           |
| Model files                                 | Browser cache         | Until deleted, evicted, or browser data is cleared |
| Theme, selected model, auto-load preference | Browser local storage | Until changed or browser data is cleared           |
| App files                                   | Service-worker cache  | Updated as new app versions activate               |

Use the header's **Chat options** menu to **Save on device**, **Export** as Markdown, or **Delete** a conversation. Saved chats include later changes. **Make temporary** removes the saved copy while keeping the current tab's copy. Saved data is not encrypted by the app.

If another tab changes a saved chat, this tab marks its affected copy temporary to avoid silently overwriting that change. You can explicitly save it again or export it.

Offline use needs both the cached production app and all required model files. A downloaded-weights label alone does not guarantee that runtime, config, and tokenizer files are cached. Different hostnames, ports, browser profiles, and private windows have separate storage.

App updates activate in the background without forcing a page reload. After activation, a normal reload uses the updated app. Unsaved drafts still disappear on a reload you initiate. Updating the app does not intentionally clear model caches or saved chats.

## Troubleshooting

| Symptom                          | What to check                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| WebGPU unavailable               | Use a WebGPU-capable browser with hardware acceleration enabled, on localhost or HTTPS. GPU and driver support still matter.                 |
| Model loads after every refresh  | Expected: GPU memory is recreated. **Downloaded on this device** means weights are saved; auto-load handles preparation.                     |
| Model shows Not downloaded again | Check the hostname, port, browser profile, private browsing, cleared site data, or storage eviction.                                         |
| Progress appears stalled         | Open Models for the current phase and elapsed time. Some runtime phases do not report byte progress. Stop and retry if needed.               |
| A larger model fails to load     | Try a smaller model and close other GPU-heavy tabs or applications. Check available browser storage too.                                     |
| Offline startup fails            | Complete an online model load first. Weights may be cached while other required files are missing.                                           |
| An older UI appears              | Allow the service-worker update to finish, then reload. Avoid clearing all site data as a first step: it removes models and saved chats too. |
| A chat disappeared               | Chats are temporary unless saved. Check the same origin/profile, or import its contents manually from an earlier Markdown export.            |

Model initialization times out after ten minutes; generation times out after two minutes. Local models can make mistakes. Review facts, names, numbers, and meaning before using their output.

## Deployment and runtime configuration

The Docker image builds with Node 24 and serves static files through non-root Nginx. Compose uses a read-only container filesystem, temporary runtime storage, and a localhost-only port binding. For access from another machine, put it behind an HTTPS reverse proxy.

No model weights are bundled in the image. Local environment files, downloaded `*.local` folders, logs, and Git history are excluded from the Docker build context.

To use a runtime mirror, set `VITE_RUNTIME_BASE_URL` to a trailing-slash URL that serves the exact Wasm filenames expected by the installed WebLLM configuration. The host must permit browser access. This changes the runtime location, not the Hugging Face weight sources.

For Node/Vite builds, put the value in ignored `.env.local` and rebuild. For Docker:

```sh
VITE_RUNTIME_BASE_URL=https://your-runtime-host.example/ docker compose build
docker compose up -d --wait
```

This is public, build-time client configuration. Do not put credentials in it. Docker does not copy local runtime folders into the image; the mirror must already be reachable separately.

## Development and verification

```sh
npm ci
npm run format:check
npm run check
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm audit --omit=dev
```

Run `npm run format` to apply formatting. Browser tests start their own production preview on port 4175; build first. Use `E2E_PORT` to change that port or `E2E_CHANNEL=chrome` to use installed Chrome.

The default suite covers UI behavior, cache updates, storage, model deletion, keyboard controls, and layout stability. Inference tests use a controlled worker fixture. They do not establish real GPU compatibility, inference speed, or model quality.

For the opt-in real-model test:

```sh
npm run build
RUN_MODEL=1 E2E_CHANNEL=chrome npx playwright test e2e/model.spec.ts
```

This downloads the default model and requires a usable WebGPU adapter in the automated browser. See [`docs/evaluation.md`](docs/evaluation.md) for output collection and quality review using [`docs/evaluation-cases.json`](docs/evaluation-cases.json).

### Code map

| Area                                  | Main files                                                          |
| ------------------------------------- | ------------------------------------------------------------------- |
| Chat workspace and model UI           | `src/App.tsx`, `src/ConversationSidebar.tsx`, `src/ModelPicker.tsx` |
| Model catalog and inference worker    | `src/models.ts`, `src/inference.ts`, `src/inference.worker.ts`      |
| Loading, generation, and cancellation | `src/useWriter.ts`                                                  |
| Prompts, writing actions, and context | `src/prompts.ts`, `src/actions.ts`                                  |
| Conversation storage and attachments  | `src/conversations.ts`, `src/storage.ts`                            |
| Offline app registration and caching  | `src/offline.ts`, `vite.config.ts`                                  |
| Unit/component and browser tests      | `src/*.test.*`, `e2e/`                                              |

The app currently has no web search, external tools, voice, executable artifacts, or account sync. Model assets remain on their respective hosts and carry their own terms; this repository is marked `UNLICENSED` in `package.json`.
