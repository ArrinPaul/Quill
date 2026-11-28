export interface PasswordStrengthResult {
  score: number; // 0 to 5
  label: string;
  meetsMinimum: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: 0, label: "", meetsMinimum: false };
  }

  const meetsMinimum = password.length >= MIN_PASSWORD_LENGTH;
  let score = 0;
  if (meetsMinimum) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!meetsMinimum) {
    return {
      score: 1,
      label: `Too short (min ${MIN_PASSWORD_LENGTH} characters)`,
      meetsMinimum: false,
    };
  }

  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very strong"];
  return {
    score,
    label: labels[score] || "Weak",
    meetsMinimum: true,
  };
}
