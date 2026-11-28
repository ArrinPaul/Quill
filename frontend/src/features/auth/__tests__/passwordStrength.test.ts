import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength } from "../lib/passwordStrength";

describe("evaluatePasswordStrength", () => {
  it("returns empty score for empty input", () => {
    expect(evaluatePasswordStrength("")).toEqual({
      score: 0,
      label: "",
      meetsMinimum: false,
    });
  });

  it("flags passwords shorter than 8 characters as not meeting minimum", () => {
    const res = evaluatePasswordStrength("Ab1!xyz");
    expect(res.meetsMinimum).toBe(false);
    expect(res.score).toBe(1);
    expect(res.label).toContain("8");
  });

  it("scores weak, fair, strong, and very strong passwords >= 8 characters", () => {
    expect(evaluatePasswordStrength("abcdefgh").meetsMinimum).toBe(true);
    expect(evaluatePasswordStrength("abcdefgh").score).toBe(1);
    expect(evaluatePasswordStrength("Abcdefg1").score).toBe(3);
    expect(evaluatePasswordStrength("Abcdefg1!").score).toBe(4);
    expect(evaluatePasswordStrength("Abcdefghijk1!").score).toBe(5);
    expect(evaluatePasswordStrength("Abcdefghijk1!").label).toBe("Very strong");
  });
});
