// Activate new app caches without reloading an open draft. The next navigation
// uses the new version; model caches are managed separately by WebLLM.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .catch(() => {
        window.dispatchEvent(new Event("offline-cache-failed"));
      });
  });
}
