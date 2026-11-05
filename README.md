# Local Writer

A private chat and writing workspace powered entirely by browser models. WebGPU runs inference on your device; no model server, account, API key or separate app is required.

## Run

Use Node.js 24 LTS and npm (CI uses Node 24).

```sh
npm ci
npm run dev
```

For a production preview:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

Open the URL printed by Vite. Updates activate after existing app tabs close, so an update does not discard an active draft.

## Docker

```sh
docker compose up --build -d
```

Open http://localhost:4174. Set `PORT=8080` before the command to use a different host port. Stop with `docker compose down`. Containers do not need GPU access: inference and model caching still happen in your browser. Saved chats stay in browser storage, not a Docker volume. Keep the same hostname and port to reuse existing browser data.

The multi-stage image builds with Node 24 and serves static files with Nginx as a non-root user. Compose uses a read-only filesystem with temporary runtime storage. It binds to localhost; use an HTTPS reverse proxy for access from another machine because browser WebGPU requires a secure context.

Local `.env` files, downloaded `*.local` runtime folders, Git history and logs are excluded from the image. The default build uses WebLLM's runtime host. To use an existing external runtime mirror, pass its URL at build time:

```sh
VITE_RUNTIME_BASE_URL=https://your-runtime-host.example/ docker compose build
docker compose up -d
```

This value is public client configuration, not a secret. Changing it requires rebuilding. No model weights are bundled in the image.

## Chat and writing

- In Write mode, **Writing preferences** accepts protected terms and a custom instruction. Missing protected terms are flagged; retries and edit/resend retain the original preferences. Preferences are stored with the request only when you save its conversation.
- The desktop sidebar searches conversation titles and messages. On narrow screens, use the Conversation selector.
- **Chat** is the default. Completed turns provide context for follow-up questions. **Write** offers ten editing actions, with original/revised word-level comparison.
- Enter sends; Shift+Enter inserts a newline. The composer grows with the draft and respects IME composition.
- Replies render Markdown, tables and code with a copy button. Generated HTML is disabled and remote images are not fetched.
- Copy, edit a reply, reuse it as input, or branch from it. Retry and edit/resend create branches and preserve the original conversation. Each reply identifies its model.
- New chat keeps the loaded model. Stop preserves partial output and normally keeps the model ready. If cancellation stalls, the worker is unloaded after five seconds.
- Select text in a draft or reply and choose **Rewrite selected text** to copy that selection into Write mode. The original message remains unchanged.
- Attach up to three UTF-8 `.txt`, `.md` or `.markdown` files, 24 KB combined. This file limit does not override the model context limit. Files are reference text, not executable content.
- Drafts accept up to 500 words / 6,000 characters. Context checks may impose a lower limit, especially with attachments. The Context budget disclosure explains the conservative byte estimate and excluded older messages. Oversized newest messages are rejected, never silently cut.
- Streaming follows the latest reply only while you are near the bottom. Scroll up to read earlier messages; **Jump to latest** returns to the response.

## Models and downloads

Open **Models** beside Send. Browser models need HTTPS or localhost, a WebGPU-capable browser, and hardware acceleration. Model selection is remembered. Initial model downloads are explicit; optional automatic loading starts only if the selected weights are cached. Missing runtime/config/tokenizer files can still need internet.

| Model         | Approximate weights | Estimated GPU memory |
| ------------- | ------------------- | -------------------- |
| Qwen 2.5 0.5B | 280 MB              | 945 MB               |
| Qwen 2.5 1.5B | 870 MB              | 1.6 GB               |

Runtime and browser overhead are additional. The picker distinguishes downloaded weights from a model loaded in memory, shows estimated site storage, and can request persistent browser storage. Unload frees the worker; Remove model cache deletes the selected WebLLM model files. Browser eviction, interrupted downloads, or missing runtime files can prevent offline use.

Loading reports runtime progress, elapsed time and a stalled-update hint. The runtime does not expose byte progress for every phase, so an indeterminate bar is deliberate. Stop cancels loading; use Models to retry. Initialization times out after ten minutes and generation after two minutes.

If the runtime host is slow, set `VITE_RUNTIME_BASE_URL` to a trailing-slash URL in ignored `.env.local`, place the exact Wasm files named by the installed WebLLM configuration at that URL, and rebuild. Weights still come from Hugging Face. Without this setting, WebLLM uses its default runtime host. Do not commit downloaded model assets.

## Privacy and saved chats

Chats and drafts are temporary by default. **Save on device** stores the current conversation and later changes in this browser's local storage, including attachments. They are not encrypted by the app. **Make temporary** removes that saved copy while preserving the current tab's copy. Delete removes the selected chat and its saved copy; Export downloads Markdown. Browser site-data controls remove all site storage, including models and saved chats.

If another tab changes saved chats, the affected copies in this tab become temporary to avoid silently overwriting the other tab's changes. Save again deliberately if you want to keep your copy. Browser quota failures leave the live conversation available for export.

Messages and attachments are processed in this browser. Model downloads contact Hugging Face and the runtime host. There are no accounts or analytics. Clipboard writes require a Copy action. Theme, selected browser model and the automatic-load preference are stored separately from chats.

## Checks and model quality

```sh
npm run format:check
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

Browser tests use a dedicated preview on port 4175. Override with `E2E_PORT`; use `E2E_CHANNEL=chrome` to test installed Chrome. Chat browser tests replace the inference worker with a controlled fixture while exercising the production WebLLM client. They do not prove real inference, GPU compatibility or model quality.

See [evaluation instructions](docs/evaluation.md) and the [38 writing cases](docs/evaluation-cases.json) for real-model checks. The 0.5B default is a smaller download, not a measured quality winner. Review facts and meaning before using model output. Web search, tools, voice and executable artifacts are not included.

The browser-only conversion is paused after five of ten requested commits. See [the next-session checklist](docs/next-session.md).
