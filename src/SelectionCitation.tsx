import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export function SelectionCitation({
  container,
  onCite,
  disabled,
  conversation,
}: {
  container: RefObject<HTMLDivElement | null>;
  onCite: (text: string) => void;
  disabled: boolean;
  conversation: string;
}) {
  const [selected, setSelected] = useState<{
    text: string;
    left: number;
    top: number;
  } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setSelected(null);
    if (disabled) return;
    function update() {
      if (document.activeElement === button.current) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed)
        return setSelected(null);
      const range = selection.getRangeAt(0);
      const element =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      const content = element?.closest(".message-content");
      const text = selection.toString().trim();
      if (!text || !content || !container.current?.contains(content))
        return setSelected(null);
      const rect = range.getBoundingClientRect();
      setSelected({
        text,
        left: Math.max(
          8,
          Math.min(rect.left + rect.width / 2 - 40, innerWidth - 88),
        ),
        top: Math.max(
          8,
          Math.min(
            rect.top >= 60 ? rect.top - 52 : rect.bottom + 8,
            innerHeight - 52,
          ),
        ),
      });
    }
    const hide = () => setSelected(null);
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.activeElement === button.current)
          container.current?.focus();
        hide();
      }
      if (
        event.key === "Tab" &&
        document.activeElement !== button.current &&
        window.getSelection()?.toString().trim() &&
        button.current
      ) {
        event.preventDefault();
        button.current.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (!button.current?.contains(event.target as Node)) hide();
    }
    document.addEventListener("selectionchange", update);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [container, disabled, conversation]);
  return (
    selected &&
    createPortal(
      <button
        ref={button}
        className="selection-cite"
        style={{ left: selected.left, top: selected.top }}
        onBlur={() => setSelected(null)}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          onCite(selected.text);
          window.getSelection()?.removeAllRanges();
          setSelected(null);
        }}
      >
        <span aria-hidden="true">❝</span> Cite
      </button>,
      document.body,
    )
  );
}
