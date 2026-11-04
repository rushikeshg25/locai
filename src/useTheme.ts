import { useEffect, useState } from "react";
export function useTheme() {
  const [choice, setChoice] = useState<"light" | "dark" | null>(() => {
    try {
      const saved = localStorage.getItem("local-writer-theme");
      return saved === "light" || saved === "dark" ? saved : null;
    } catch {
      return null;
    }
  });
  const [dark, setDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );
  const theme = choice ?? (dark ? "dark" : "light");
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const update = () => setDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setChoice(next);
    try {
      localStorage.setItem("local-writer-theme", next);
    } catch {
      /* The current tab can still change theme if storage is blocked. */
    }
  }
  return { theme, toggleTheme };
}
