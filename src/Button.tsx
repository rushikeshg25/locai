import { useId, useRef, useState, type ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
export function Button({
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const id = useId(),
    anchor = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  function show() {
    const rect = anchor.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 232)),
        top: rect.top > 65 ? rect.top - 55 : rect.bottom + 8,
      });
  }
  if (!title) return <button {...props} />;
  return (
    <span
      className="button-hint"
      ref={anchor}
      onPointerEnter={show}
      onPointerLeave={() => setPosition(null)}
      onFocus={show}
      onBlur={() => setPosition(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setPosition(null);
      }}
    >
      <button {...props} aria-describedby={position ? id : undefined} />
      {position &&
        createPortal(
          <span className="tooltip" style={position} id={id} role="tooltip">
            {title}
          </span>,
          document.body,
        )}
    </span>
  );
}
