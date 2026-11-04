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

- Type checking and production build passed.
- Fifteen unit/component/runtime-adapter tests passed, including stale request isolation, cancellation, timeout, errors, protected terms, copy and undo.
- Two Chromium browser tests passed: desktop/mobile layouts without horizontal overflow; offline app reload without persisted drafts. Startup produced no external requests.
- Real-model test attempted but failed at the capability gate: automated Chromium had no usable WebGPU adapter. No model downloaded. Real inference, offline model reload, latency and quality are unverified.
- `npm audit --omit=dev`: zero vulnerabilities. Full audit: 2 low and 8 moderate development-tool advisories in the Workbox build dependency tree. `npm audit fix` could not resolve them without incompatible changes. Do not expose development tooling to untrusted build inputs.

## Manual quality comparison

Use `evaluation-cases.json` for each model. Record device, browser, model ID, cold download/load time, warm load time, first-token time and completion time. Review output for factual preservation, action compliance, readability and unwanted additions. Run both ordinary inputs and the maximum supported input size.

Provisional gate: at least 27 of 30 outputs are useful without rewriting, no observed changes to names/numbers/dates/negation/commitments, and a 200-word request completes within 15 seconds after model loading on the target laptop. If neither model passes, narrow the supported actions or evaluate another compatible model. Do not label these gates passed without measured results.

Also test interrupted downloads, low storage, cache eviction, GPU loss, multiple open tabs and offline model initialization. A cached weight indicator alone does not prove that tokenizer, config and Wasm files are cached.

## Model sources

- [0.5B model card and Apache-2.0 license](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)
- [1.5B model card and Apache-2.0 license](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct)
- [0.5B browser weights](https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC)
- [1.5B browser weights](https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC)

Download estimates come from tensor manifests: 277,996,288 and 868,547,584 bytes. GPU estimates come from WebLLM's bundled model registry. Runtime, tokenizer, cache and browser overhead are additional. Model assets are downloaded from their hosts, not redistributed in this repository.
