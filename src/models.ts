export const models = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Small · Qwen 2.5 0.5B', download: '~280 MB weights', memory: '~945 MB GPU memory' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Larger · Qwen 2.5 1.5B', download: '~880 MB weights', memory: '~1.6 GB GPU memory' },
] as const;
export async function checkGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu || !window.isSecureContext) return false;
  try { return Boolean(await gpu.requestAdapter()); } catch { return false; }
}
