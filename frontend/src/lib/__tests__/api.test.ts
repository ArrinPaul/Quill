import { describe, it, expect } from "vitest";
import { resolveApiBaseUrl } from "../api";

describe("resolveApiBaseUrl", () => {
  it("falls back to http://localhost:4000 when undefined (local dev)", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("http://localhost:4000");
  });

  it("returns empty string for same-origin /api rewrites when NEXT_PUBLIC_BACKEND_URL is ''", () => {
    expect(resolveApiBaseUrl("")).toBe("");
  });

  it("returns the configured URL when provided", () => {
    expect(resolveApiBaseUrl("https://quill-backend.onrender.com")).toBe(
      "https://quill-backend.onrender.com"
    );
  });
});
