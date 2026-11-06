import {
  useId,
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
export function Button({
  title,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const touchFocus = useRef(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!visible || !anchor.current || !tooltip.current) return;
    const a = anchor.current.getBoundingClientRect();
    const t = tooltip.current.getBoundingClientRect();
    setPosition({
      left: Math.max(
        8,
        Math.min(a.left + (a.width - t.width) / 2, innerWidth - t.width - 8),
      ),
      top: Math.max(
        8,
        Math.min(
          a.top >= t.height + 16 ? a.top - t.height - 8 : a.bottom + 8,
          innerHeight - t.height - 8,
        ),
      ),
    });
  }, [visible, title]);
  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [visible]);
  if (!title) return <button {...props} />;
  return (
    <span
      className="button-hint"
      ref={anchor}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setVisible(true);
      }}
      onPointerLeave={() => setVisible(false)}
      onPointerDown={(event) => {
        touchFocus.current = event.pointerType === "touch";
        setVisible(false);
      }}
      onFocus={() => {
        if (!touchFocus.current) setVisible(true);
        touchFocus.current = false;
      }}
      onBlur={() => setVisible(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setVisible(false);
      }}
    >
      <button
        {...props}
        aria-describedby={
          [props["aria-describedby"], visible ? id : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {visible &&
        createPortal(
          <span
            ref={tooltip}
            className="tooltip"
            style={position}
            id={id}
            role="tooltip"
          >
            {title}
          </span>,
          anchor.current?.closest("dialog") ?? document.body,
        )}
    </span>
  );
}
