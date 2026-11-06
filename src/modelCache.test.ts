import { afterEach, expect, it, vi } from "vitest";
import { installModelCacheFallback } from "./modelCache";
const url =
  "https://huggingface.co/mlc-ai/test/resolve/main/params_shard_6.bin";
afterEach(() => vi.unstubAllGlobals());
function setup(error?: Error) {
  const add = error
    ? vi.fn().mockRejectedValue(error)
    : vi.fn().mockResolvedValue(undefined);
  const put = vi.fn().mockResolvedValue(undefined);
  class CacheMock {
    add = add;
    put = put;
  }
  CacheMock.prototype.add = add;
  vi.stubGlobal("Cache", CacheMock);
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetchMock);
  installModelCacheFallback();
  return { cache: { add: CacheMock.prototype.add, put }, add, put, fetchMock };
}
it("buffers a model shard after the native cache stream fails", async () => {
  const { cache, put } = setup(
    new DOMException("stream failed", "NetworkError"),
  );
  await cache.add(url);
  expect(put).toHaveBeenCalledOnce();
  expect([...new Uint8Array(await put.mock.calls[0][1].arrayBuffer())]).toEqual(
    [1, 2, 3],
  );
});
it("leaves successful native writes unchanged", async () => {
  const { cache, fetchMock } = setup();
  await cache.add(url);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("does not hide quota errors or intercept unrelated URLs", async () => {
  for (const [error, address] of [
    [new DOMException("full", "QuotaExceededError"), url],
    [new DOMException("network", "NetworkError"), "https://example.com/file"],
  ] as const) {
    const { cache, fetchMock } = setup(error);
    await expect(cache.add(address)).rejects.toBe(error);
    expect(fetchMock).not.toHaveBeenCalled();
  }
});
