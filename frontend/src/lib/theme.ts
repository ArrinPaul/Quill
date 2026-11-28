export const THEME_EVENT = "quill-theme-change";

export function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("Quill_theme", next ? "dark" : "light");
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}
