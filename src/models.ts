export const models = [
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Small · Qwen 2.5 0.5B",
    download: "~280 MB weights",
    memory: "~945 MB GPU memory",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Larger · Qwen 2.5 1.5B",
    download: "~870 MB weights",
    memory: "~1.6 GB GPU memory",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Compact · Llama 3.2 1B",
    download: "~695 MB weights",
    memory: "~880 MB GPU memory",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Larger · Llama 3.2 3B",
    download: "~1.81 GB weights",
    memory: "~2.3 GB GPU memory",
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "Larger · Qwen 2.5 3B",
    download: "~1.74 GB weights",
    memory: "~2.5 GB GPU memory",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Larger · Phi 3.5 Mini",
    download: "~2.15 GB weights",
    memory: "~3.7 GB GPU memory",
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Reasoning · Qwen 3 0.6B",
    download: "~335 MB weights",
    memory: "~1.4 GB GPU memory",
  },
] as const;
export function supportsReasoning(model: string) {
  return model === "Qwen3-0.6B-q4f16_1-MLC";
}
export async function checkGPU(): Promise<boolean> {
  const gpu = (
    navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
  ).gpu;
  if (!gpu || !window.isSecureContext) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}
