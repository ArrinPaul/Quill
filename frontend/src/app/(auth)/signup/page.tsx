"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from "@untitledui/icons";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { api } from "@/lib/api";

const branches = ["CSE", "IT", "ECE", "EEE", "ME", "CE", "Other"];
const years = [1, 2, 3, 4];

export default function SignupPage() {
  const { register } = useAuth();
  
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    branch: "",
    year: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(""); // Clear error on change
  };

  const handleNext = async () => {
    setError("");
    if (step === 1) {
      if (!form.email || !form.password || !form.confirmPassword) {
        setError("Please fill all fields");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }

      setLoading(true);
      try {
        await api.post("/api/auth/check-email", { email: form.email });
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Email already registered");
      } finally {
        setLoading(false);
      }
    } else if (step === 2) {
      if (!form.name || !form.branch || !form.year) {
        setError("Please fill all personal info");
        return;
      }
      setLoading(true);
      try {
        await register({
          name: form.name,
          email: form.email,
          password: form.password,
          branch: form.branch,
          year: Number(form.year),
        }, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    setError("");
    setStep((prev) => prev - 1);
  };

  return (
    <div className="bg-card rounded-[10px] border border-border p-5 sm:p-6 shadow-sm w-full">
      {/* Progress Indicator */}
      <div className="flex gap-2 mb-4">
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
        <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ letterSpacing: "-0.02em" }}>
            {step === 1 ? "Account Credentials" : "Personal Info"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {step === 1 ? "Step 1 of 2" : "Step 2 of 2"}
          </p>
        </div>
        {step > 1 && (
          <button onClick={handleBack} className="p-1.5 text-muted-foreground hover:bg-accent rounded-full transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded-[10px] text-xs text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={step < 3 ? (e) => { e.preventDefault(); handleNext(); } : (e) => e.preventDefault()} className="space-y-3">
        
        {/* STEP 1: CREDENTIALS */}
        {step === 1 && (
          <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 pr-10 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthMeter password={form.password} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
        )}

        {/* STEP 2: PERSONAL INFO */}
        {step === 2 && (
          <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                className="w-full px-3 py-1.5 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="John Doe"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="branch" className="block text-sm font-medium text-foreground mb-1">
                  Branch
                </label>
                <select
                  id="branch"
                  name="branch"
                  value={form.branch}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-card"
                  required
                >
                  <option value="">Select</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="year" className="block text-sm font-medium text-foreground mb-1">
                  Year
                </label>
                <select
                  id="year"
                  name="year"
                  value={form.year}
                  onChange={handleChange}
                  className="w-full px-3 py-1.5 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-card"
                  required
                >
                  <option value="">Select</option>
                  {years.map((y) => (
                    <option key={y} value={y}>Year {y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 mt-4 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary/90 transition-standard disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            step === 1 ? "Checking..." : "Creating account..."
          ) : step === 1 ? (
            <>Next <ArrowRight className="w-4 h-4" /></>
          ) : (
            <>Create Account <Check className="w-4 h-4" /></>
          )}
        </button>
      </form>

      {step === 1 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
