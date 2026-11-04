# Model evaluation and release gate

The default 0.5B model is a provisional low-download choice, not a quality winner. Compare it with 1.5B on the target device before presenting this app as production-ready.

## Repeatable checks

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
RUN_MODEL=1 npx playwright test e2e/model.spec.ts
```

The last check downloads approximately 280 MB plus runtime/tokenizer files. It requires a usable WebGPU adapter. It checks generation without network requests and a subsequent offline reload and generation. A nonempty result does not establish writing quality.

## Current evidence (2026-11-04)

- Type checks and the production build pass. The WebLLM bundle remains large; Vite reports a size warning.
- Unit/component tests cover conversation context, cancellation, stale output, safe Markdown, opt-in storage, attachments, server stream parsing and errors.
- Chrome browser tests exercise desktop/mobile light and dark layouts, offline app reload, model-picker dismissal, a growing composer, conversational requests, attachments, branches and saved-chat reload. Server responses in these checks are controlled fixtures.
- This machine's automated Chrome reports no usable WebGPU adapter. Real browser-model inference, offline model reload, speed and quality remain unverified. Those tests are explicit opt-ins and skipped in the normal suite.

## Collect real outputs

Build the app, then run on a machine whose automated browser exposes WebGPU:

```sh
RUN_EVAL=1 EVAL_MODEL=small npx playwright test e2e/evaluation.spec.ts
RUN_EVAL=1 EVAL_MODEL=large npx playwright test e2e/evaluation.spec.ts
```

Use `E2E_CHANNEL=chrome` if using installed Chrome. Each run loads the selected model and exercises all 38 writing cases through the production interface. The Playwright test attaches JSON containing outputs, model size, browser user agent, load time, first displayed text time and completion time. Every output starts as `unreviewed`; the test does not grade meaning or claim quality. Timing includes UI overhead. Each run uses a fresh browser profile, so it is a cold-load test; measure warm loads separately.

Also manually test Chat with a follow-up that depends on a previous answer, a model switch, a stopped answer, and a long thread that excludes old context. Confirm that the model acknowledges uncertainty instead of fabricating missing context.

## Manual quality comparison

Use `evaluation-cases.json` for each model. Record device, browser, model ID, cold download/load time, warm load time, first-token time and completion time. Review output for factual preservation, action compliance, readability and unwanted additions. Run both ordinary inputs and the maximum supported input size.

Provisional gate: at least 35 of 38 outputs are useful without rewriting, no observed changes to names/numbers/dates/negation/commitments, and a 200-word request completes within 15 seconds after model loading on the target laptop. If neither model passes, narrow the supported actions or evaluate another compatible model. Do not label these gates passed without measured results.

Also test interrupted downloads, low storage, cache eviction, GPU loss, multiple open tabs and offline model initialization. A cached weight indicator alone does not prove that tokenizer, config and Wasm files are cached.

## Model sources

- [0.5B model card and Apache-2.0 license](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)
- [1.5B model card and Apache-2.0 license](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)
- [0.5B browser weights](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC)
- [1.5B browser weights](https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC)

Download estimates come from tensor manifests: 277,996,288 and 868,547,584 bytes. GPU estimates come from WebLLM's bundled model registry. Runtime, tokenizer, cache and browser overhead are additional. Model assets are downloaded from their hosts, not redistributed in this repository.
