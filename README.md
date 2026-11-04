# Local Writer

A local chat and writing workspace. Run small models in the browser with WebGPU, or connect an existing model server on this computer.

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

## Chat and writing

- In Write mode, **Writing preferences** accepts protected terms and a custom instruction. Missing protected terms are flagged; retries and edit/resend retain the original preferences. Preferences are stored with the request only when you save its conversation.
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

## Optional local server

Start Ollama or llama.cpp separately and install a model with its own tools. In Models, select **Local server**, enter the OpenAI-compatible base URL (for example `http://localhost:11434/v1`), choose **Find installed models**, select a model, then connect. Only loopback hosts (`localhost`, `127.0.0.1`, `::1`) are supported; there is no API-key storage.

The server must allow this app's exact origin through CORS. For example, an Ollama process serving the preview can use `OLLAMA_ORIGINS=http://localhost:4174`; use the actual origin in your address bar. Configure your existing service instead of starting a second process on its port. Browser private-network or mixed-content rules can also block access.

The context-window field must match the server's actual configuration. It only controls outgoing history; it does not change server settings. Connect checks that the model exists; the first reply may still require model warm-up. Disconnect ends this app's connection and does not shut down the server.

Protocol references: [Ollama compatibility](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx), [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

## Privacy and saved chats

Chats and drafts are temporary by default. **Save on device** stores the current conversation and later changes in this browser's local storage, including attachments. They are not encrypted by the app. **Make temporary** removes that saved copy while preserving the current tab's copy. Delete removes the selected chat and its saved copy; Export downloads Markdown. Browser site-data controls remove all site storage, including models and saved chats.

If another tab changes saved chats, the affected copies in this tab become temporary to avoid silently overwriting the other tab's changes. Save again deliberately if you want to keep your copy. Browser quota failures leave the live conversation available for export.

Browser inference stays on this device. Local-server mode sends conversation context and attachments to the configured server; that server's own behavior determines further processing or retention. Model downloads contact Hugging Face and the runtime host. There are no accounts or analytics. Clipboard writes require a Copy action. Theme, selected browser model and the automatic-load preference are stored separately from chats.

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

Browser tests use a dedicated preview on port 4175. Override with `E2E_PORT`; use `E2E_CHANNEL=chrome` to test installed Chrome. Local-server browser tests mock the HTTP boundary, while adapter tests exercise split streaming events and cancellation. They do not prove real server or model quality.

See [evaluation instructions](docs/evaluation.md) and the [38 writing cases](docs/evaluation-cases.json) for real-model checks. The 0.5B default is a smaller download, not a measured quality winner. Review facts and meaning before using model output. Web search, tools, voice and executable artifacts are not included.
