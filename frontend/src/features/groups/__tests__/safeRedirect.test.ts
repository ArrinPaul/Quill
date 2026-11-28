import { describe, it, expect } from "vitest";
import { getSafeRedirect } from "../safeRedirect";

describe("getSafeRedirect", () => {
  it("returns fallback when empty or missing", () => {
    expect(getSafeRedirect(null)).toBe("/dashboard");
    expect(getSafeRedirect(undefined)).toBe("/dashboard");
    expect(getSafeRedirect("")).toBe("/dashboard");
    expect(getSafeRedirect("   ")).toBe("/dashboard");
  });

  it("allows safe relative paths", () => {
    expect(getSafeRedirect("/join/ABCDEF23456789AB")).toBe("/join/ABCDEF23456789AB");
    expect(getSafeRedirect("/dashboard/groups?tab=members")).toBe("/dashboard/groups?tab=members");
  });

  it("rejects external, protocol-relative, and backslash URLs", () => {
    expect(getSafeRedirect("https://evil.com")).toBe("/dashboard");
    expect(getSafeRedirect("http://evil.com/join/123")).toBe("/dashboard");
    expect(getSafeRedirect("//evil.com")).toBe("/dashboard");
    expect(getSafeRedirect("/\\evil.com")).toBe("/dashboard");
    expect(getSafeRedirect("javascript:alert(1)")).toBe("/dashboard");
  });
});
