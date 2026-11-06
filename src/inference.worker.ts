import { installModelCacheFallback } from "./modelCache";
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";
installModelCacheFallback();
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event) => handler.onmessage(event);
