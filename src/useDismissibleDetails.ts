import { useEffect, type RefObject } from "react";

// Non-modal menus close when focus moves elsewhere, so they cannot cover
// the next keyboard target. Native details retains its keyboard semantics.
export function useDismissibleDetails(
  ref: RefObject<HTMLDetailsElement | null>,
) {
  useEffect(() => {
    const outside = (event: Event) => {
      if (
        ref.current &&
        event.target instanceof Node &&
        !ref.current.contains(event.target)
      )
        ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [ref]);
}
