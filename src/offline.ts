// Updates wait until all tabs close, so an update never discards a draft.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        window.dispatchEvent(new Event("offline-cache-failed"));
      });
  });
}
