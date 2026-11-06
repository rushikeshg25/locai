export const models = [
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 0.5B",
    downloadMB: 280,
    download: "~280 MB weights",
    memory: "~945 MB GPU memory",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 1.5B",
    downloadMB: 870,
    download: "~870 MB weights",
    memory: "~1.6 GB GPU memory",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    downloadMB: 695,
    download: "~695 MB weights",
    memory: "~880 MB GPU memory",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    downloadMB: 1810,
    download: "~1.81 GB weights",
    memory: "~2.3 GB GPU memory",
  },
  {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 3B",
    downloadMB: 1740,
    download: "~1.74 GB weights",
    memory: "~2.5 GB GPU memory",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi 3.5 Mini",
    downloadMB: 2150,
    download: "~2.15 GB weights",
    memory: "~3.7 GB GPU memory",
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Qwen 3 0.6B",
    downloadMB: 335,
    download: "~335 MB weights",
    memory: "~1.4 GB GPU memory",
  },
] as const;
// Keep the lightweight default first in models; sort only the displayed catalog.
export const modelsBySize = [...models].sort(
  (a, b) => b.downloadMB - a.downloadMB,
);

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
