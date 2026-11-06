// Some Chromium runtimes fail while streaming redirected model shards into Cache
// Storage. Retry only that network failure, buffering one shard before storing it.
export function installModelCacheFallback() {
  const add = Cache.prototype.add;
  Cache.prototype.add = async function (input: RequestInfo | URL) {
    try {
      await add.call(this, input);
    } catch (error) {
      const request = new Request(input);
      const url = new URL(request.url);
      if (
        !(error instanceof DOMException) ||
        error.name !== "NetworkError" ||
        url.hostname !== "huggingface.co" ||
        !/\/params_shard_\d+\.bin$/.test(url.pathname)
      )
        throw error;
      const response = await fetch(request);
      if (!response.ok)
        throw new Error(
          `Model download failed (${response.status}): ${url.pathname}`,
        );
      const bytes = await response.arrayBuffer();
      // The new response is already in memory, avoiding the failing network stream.
      await this.put(
        request,
        new Response(bytes, {
          status: response.status,
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
    }
  };
}
