import { useTheme } from "./useTheme";

export function isMobileDevice() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function MobileNotice() {
  useTheme();
  return (
    <main className="mobile-notice">
      <img src="/icons/locai.svg" width="40" height="40" alt="" />
      <h1>Locai isn’t available on mobile yet.</h1>
      <p>
        Local AI models need GPU support and memory that many phones don’t
        provide. Please use a desktop browser.
      </p>
    </main>
  );
}
