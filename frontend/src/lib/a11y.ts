import type { KeyboardEvent } from "react";

/** Lets Enter / Space activate a clickable non-button element, ignoring events from its children. */
export function activateOnKey(e: KeyboardEvent<HTMLElement>) {
  if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  e.currentTarget.click();
}
