const paths = {
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  simplify: "M4 6h16 M4 12h10 M4 18h6",
  expand: "M4 5h16 M4 12h16 M4 19h16 M12 8v8 M8 12h8",
  direct: "M4 12h16 M14 6l6 6-6 6",
  warmer: "M12 20 3 11a5 5 0 0 1 9-5 5 5 0 0 1 9 5z",
  grammar: "m4 12 4 4L20 4 M4 21h16",
  casual:
    "M21 11a9 9 0 0 1-9 9H4l-3 2 2-6a9 9 0 1 1 18-5 M8 10h.01 M16 10h.01 M8 14q4 4 8 0",
  professional: "M8 7V4h8v3 M3 7h18v14H3z M3 12q9 5 18 0 M12 12v4",
  shorten: "M4 5h16 M4 19h16 M4 12h16 M8 9l-3 3 3 3 M16 9l3 3-3 3",
  summarize: "M4 5h16 M4 10h16 M4 15h10 M4 20h6",
  format: "M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01",
  sun: "M12 3V1 M12 23v-2 M3 12H1 M23 12h-2 M4 4l2 2 M18 18l2 2 M4 20l2-2 M18 6l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7h.01",
  copy: "M9 9h12v12H9z M5 15H3V3h12v2",
  reuse: "M4 7h10a6 6 0 0 1 0 12h-3 M8 3 4 7l4 4",
  clear: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  undo: "M3 10h10a7 7 0 0 1 7 7 M8 5l-5 5 5 5",
  model:
    "M7 7h10v10H7z M9 1v6 M15 1v6 M9 17v6 M15 17v6 M1 9h6 M1 15h6 M17 9h6 M17 15h6",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  send: "M12 20V4 M5 11l7-7 7 7",
  stop: "M6 6h12v12H6z",
  close: "m6 6 12 12 M18 6 6 18",
} as const;
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
