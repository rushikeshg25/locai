# Locai

AI chat that runs in your browser, on your device.

Ask questions, explore ideas, and improve your writing with local language models. No account, API key, or inference server required.

Locai uses **WebGPU** through **WebLLM** to run models locally. It does not browse the web or search for live information.

## Features

- **One chat interface** for questions, writing, brainstorming, and explanations.
- **Local inference** with downloadable models.
- **Automatic model loading** when the selected model is already downloaded.
- **Saved conversations** with generated titles, conversation search, rename, pin, and delete.
- **A fresh chat on startup**, with previous conversations available in the sidebar.
- **Reasoning support** for Qwen 3, with thinking separated from the final answer.
- **Text and Markdown attachments** for reference material.
- **Select-to-cite** to quote part of a message in your next request.
- **Retry, edit and resend, and branching** without overwriting the original conversation.
- **Markdown responses**, code copying, light and dark themes, and keyboard controls.
- **Markdown export** and an optional temporary-chat mode.

## Requirements

Use a desktop browser with:

- WebGPU support and hardware acceleration enabled.
- Enough GPU memory for the selected model.
- Access through **HTTPS or localhost**.
- Internet access for the initial model download.

**Mobile is not supported yet.** Mobile devices show an availability notice instead of starting the chat application.

Model compatibility depends on your browser, GPU, drivers, and available memory.

## Run locally

### Docker

```sh
git clone https://github.com/rushikeshg25/locai.git
cd locai
docker compose up --build -d --wait
```

Open **http://localhost:4174**.

Docker Compose starts the app. Docker does not need GPU access: inference runs in your browser.

To use another port:

```sh
PORT=8080 docker compose up --build -d --wait
```

To stop the services:

```sh
docker compose stop
```

Models and conversations live in browser storage, not in the containers. Keep the same hostname, port, and browser profile to reuse them.

### Node.js

Use **Node.js 24** and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite.

For a production build:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4175
```

The Node.js setup does not require Docker.

The service worker is enabled in production builds, not during development.

## Using Locai

### Choose a model

Open the model selector beside Send and select a model. Locai loads it immediately, downloading missing files when necessary.

- Download progress appears beside the model.
- Selecting a failed or stopped model retries loading.
- Selecting an already-loaded model does not reload it.
- Switching models releases the previous model.
- The bin icon deletes that model’s cached files after confirmation. Chats remain intact.

The selected downloaded model loads automatically when you reopen Locai.

**Loading again does not necessarily mean downloading again.** Downloaded weights stay in browser storage, but each visit must prepare them in GPU memory. Missing runtime or tokenizer files may still need internet.

### Chat and write

Type your request directly:

> Explain database indexes with a small example.

> Make this message more professional: …

> Summarize the attached notes into five action items.

There is no separate writing mode. Chat sends your messages and conversation history without an application persona or system prompt.

### Manage conversations

Chats save automatically after the first message. Opening or refreshing Locai starts a new chat; saved conversations remain in the sidebar.

Hover or keyboard-focus a conversation to reveal:

- **Three-dot menu:** Rename, Pin/Unpin, and Delete.
- **Pin button:** Keep a conversation at the top of the list.

Titles are generated from the first message when possible. Manually assigned titles are preserved.

Use the header’s **Chat options** menu to export a conversation as Markdown or make it temporary. Switching chats preserves each unsent draft, its attachments, and pending edits in the current tab. Temporary chats and unsent drafts disappear when the page reloads or closes.

### Attachments and citations

Attach up to three UTF-8 `.txt`, `.md`, or `.markdown` files, with a combined size of **24,000 bytes**.

Select text in a message and choose **Cite** to append it as a quote to your draft.

Drafts are limited to **500 words and 6,000 characters**. The model’s context budget may impose a smaller limit.

### Context limits

Input limits use a conservative byte-based budget. Older conversation turns may be excluded to fit. An oversized newest request is rejected rather than silently truncated.

## Models

| Model         | Approximate weights | Estimated GPU memory |
| ------------- | ------------------: | -------------------: |
| Phi 3.5 Mini  |             2.15 GB |               3.7 GB |
| Llama 3.2 3B  |             1.81 GB |               2.3 GB |
| Qwen 2.5 3B   |             1.74 GB |               2.5 GB |
| Qwen 2.5 1.5B |              870 MB |               1.6 GB |
| Llama 3.2 1B  |              695 MB |               880 MB |
| Qwen 3 0.6B   |              335 MB |               1.4 GB |
| Qwen 2.5 0.5B |              280 MB |               945 MB |

Qwen 2.5 0.5B is the default. These estimates exclude some runtime and browser overhead and do not guarantee device compatibility.

Model definitions are maintained in [`src/features/models/models.ts`](src/features/models/models.ts).

### Reasoning

Qwen 3 0.6B supports a **Reasoning** toggle in the model selector.

Thinking appears in a separate, collapsed section. Only the final answer is reused as conversation history. Thinking text is model output, not a verified explanation.

Reasoning uses more of the available context and can take longer. A model may reach its output limit or timeout before producing a final answer.

## Web access

Locai does not fetch web pages or search results. Pasting a URL does not let the model read that page, and answers are not checked against live information.

To use outside information, paste the relevant text or attach a text/Markdown file, then ask a question about it. For example:

> Using the notes below, summarize the main points and identify anything uncertain.

Older saved conversations keep their source links and exports. Retrying an old search response now runs local inference without repeating the search.

The Docker setup serves only the app; it no longer starts SearXNG or exposes a search proxy.

## Privacy and storage

Messages and attachments are processed locally for model inference.

Network access is used for:

- Model and runtime downloads.
- Source links you choose to open.

Generated HTML is disabled, and model-generated remote images are not fetched automatically.

| Data                              | Storage               |
| --------------------------------- | --------------------- |
| Saved chats and attachments       | Browser local storage |
| Downloaded model files            | Browser cache         |
| Theme and selected model          | Browser local storage |
| Temporary chats and unsent drafts | Current tab memory    |
| Production app files              | Service-worker cache  |

Saved conversations are **not encrypted by Locai**. Clearing site data removes chats and downloads. Browsers may also evict cached model files.

Different origins, ports, browser profiles, and private windows have separate storage. There is no account sync.

Offline use requires the production app and all model dependencies to be cached. A downloaded-weights label alone does not guarantee that every runtime file is available offline.

## Keyboard controls

| Shortcut                   | Action                         |
| -------------------------- | ------------------------------ |
| Enter                      | Send                           |
| Shift+Enter                | New line                       |
| Ctrl+Enter / Command+Enter | New line                       |
| Tab / Shift+Tab            | Move between controls          |
| Escape                     | Dismiss an open menu or dialog |

IME composition does not submit a message. Controls have accessible labels and visible focus states.

## Troubleshooting

| Issue                           | What to try                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| WebGPU unavailable              | Enable hardware acceleration and use a supported desktop browser over HTTPS or localhost. |
| Model loads after every refresh | Expected: cached weights must be prepared in GPU memory again.                            |
| Model downloads again           | Check the browser profile, hostname, port, cleared site data, or cache eviction.          |
| Download appears stuck          | Check the model’s progress ring. Stop and select the model again to retry.                |
| Large model fails to load       | Try a smaller model and close other GPU-heavy applications or tabs.                       |
| Old interface appears           | Allow the service worker to update, then reload. Avoid clearing all site data first.      |
| Chat is missing                 | Check the same browser profile and origin, and whether the chat was temporary.            |

Model loading times out after ten minutes. Generation times out after two minutes.

## Development

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

Browser tests start a temporary production preview on port `4175`. Override it with `E2E_PORT`, or use installed Chrome with `E2E_CHANNEL=chrome`.

Default inference tests use a controlled worker fixture. They verify application behavior, not real-device GPU compatibility or model quality.

To run the opt-in real-model test:

```sh
npm run build
RUN_MODEL=1 E2E_CHANNEL=chrome npx playwright test e2e/model.spec.ts
```

This downloads a model and requires WebGPU in the automated browser.

See [`docs/evaluation.md`](docs/evaluation.md) for model-output evaluation.

### Project structure

| Area                      | Files                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Chat workspace            | `src/app/App.tsx`, `src/features/chat/ConversationSidebar.tsx`                                                    |
| Model selection           | `src/features/models/ModelPicker.tsx`, `src/features/models/models.ts`                                            |
| Inference and lifecycle   | `src/features/models/inference.ts`, `src/features/models/inference.worker.ts`, `src/features/models/useWriter.ts` |
| Persona and context       | `src/features/prompts/prompts.ts`                                                                                 |
| Conversations and storage | `src/features/chat/conversations.ts`, `src/features/chat/storage.ts`                                              |
| Mobile notice             | `src/platform/MobileNotice.tsx`                                                                                   |
| Offline app caching       | `src/platform/offline.ts`, `vite.config.ts`                                                                       |
| Tests                     | `src/**/*.test.*`, `e2e/`                                                                                         |

## Limitations

Locai does not currently support mobile model execution, voice input, account sync, executable artifacts, live web search, or full-page browsing.

Local models can make mistakes. Review important facts, names, numbers, and generated code before using them.

## License

This repository is currently marked `UNLICENSED`. Downloaded models and runtime assets remain subject to their respective licenses and terms.
