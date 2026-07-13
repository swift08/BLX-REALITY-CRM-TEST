import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/blx-logo.png";
import { Eye, EyeOff, Sparkles, ShieldCheck, Sun, Moon } from "lucide-react";
async function callApi(action: string, payload: any = {}) {
  const res = await fetch("/api/crm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "API request failed");
  }
  return res.json();
}

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · BLX Realty CRM" }] }),
  beforeLoad: async () => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("blx-realty-session") : null;
    if (saved) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("blx_theme");
      if (saved) return saved as "light" | "dark";
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    }
    return "light";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      localStorage.setItem("blx_theme", theme);
    }
  }, [theme]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        if (!email.trim()) throw new Error("Please enter your email.");
        toast.success("Security verification token dispatched!");
        toast.info("Reset Token generated: BLX-MOCK-12345", { duration: 8000 });
        setResetToken("BLX-MOCK-12345");
        setMode("reset");
        return;
      }

      if (mode === "reset") {
        if (resetToken !== "BLX-MOCK-12345")
          throw new Error("Invalid security verification token.");
        if (password.length < 6) throw new Error("New password must be at least 6 characters.");
        toast.success("Password reset verified! Please sign in with your new credentials.");
        setMode("signin");
        setPassword("");
        return;
      }

      if (mode === "signup") {
        await callApi("signUp", {
          email,
          password,
          name,
          role: "sales_executive",
        });
        toast.success("Account created successfully! Please sign in.");
        setMode("signin");
      } else {
        const data = await callApi("signIn", {
          email,
          password,
        });
        if (data.session) {
          localStorage.setItem("blx-realty-session", JSON.stringify(data.session));
          const role = data.session.user?.user_metadata?.role || "super_admin";
          localStorage.setItem("blx-realty-active-role", role);
        }
        toast.success("Welcome back!");
        navigate({ to: "/" });
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex items-center justify-center relative overflow-hidden font-sans p-4 sm:p-8 transition-colors duration-300">
      {/* Theme Toggle Button */}
      <div className="absolute top-6 right-6 z-20">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          className="h-9 w-9 rounded-xl bg-white/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-white/5 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm transition-all duration-300"
        >
          {theme === "light" ? (
            <Moon className="h-4.5 w-4.5 text-slate-800" />
          ) : (
            <Sun className="h-4.5 w-4.5 text-yellow-400" />
          )}
        </Button>
      </div>

      {/* Premium glowing backdrops */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[100px] animate-pulse duration-[8000ms]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-900/3 dark:bg-indigo-900/5 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[100px] animate-pulse duration-[8000ms] delay-4000" />
      </div>

      {/* Embedded keyframe styles for spinning 3D logo crystal cube and floating components */}
      <style>{`
        @keyframes spin-3d {
          0% { transform: rotateX(-20deg) rotateY(0deg); }
          100% { transform: rotateX(-20deg) rotateY(360deg); }
        }
        @keyframes floating {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      {/* Main Glassmorphism panel split structure */}
      <div className="w-full max-w-5xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-2xl relative z-10 grid lg:grid-cols-12 min-h-[600px] transition-all duration-300">
        {/* Left Side: Dynamic Branding & Rotating 3D crystal structure */}
        <div className="lg:col-span-6 flex flex-col justify-between p-8 sm:p-12 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/5 relative overflow-hidden bg-slate-50/20 dark:bg-slate-950/20">
          {/* Subtle diagonal background mesh line */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.01)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          <div className="flex items-center gap-3 relative z-10">
            <div className="h-10 w-10 rounded-xl bg-white/10 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 backdrop-blur-md grid place-items-center">
              <img src={logo} alt="BLX Realty" className="h-7 w-7 object-contain" />
            </div>
            <div className="text-left">
              <div className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                BLX Realty
              </div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-indigo-500 dark:text-indigo-400 font-bold">
                CRM Operating System
              </div>
            </div>
          </div>

          {/* Interactive CSS 3D Crystal representation */}
          <div className="my-8 relative z-10 flex flex-col items-center">
            <div className="w-48 h-48 [perspective:1000px] flex items-center justify-center animate-[floating_5s_infinite_ease-in-out]">
              <div className="w-24 h-24 relative [transform-style:preserve-3d] animate-[spin-3d_18s_infinite_linear] hover:[animation-play-state:paused] cursor-pointer">
                {/* 3D Glass Prism Sides */}
                <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-200/40 dark:border-white/20 rounded-xl backdrop-blur-md grid place-items-center [transform:translateZ(48px)]">
                  <img
                    src={logo}
                    alt="BLX"
                    className="h-10 w-10 object-contain drop-shadow-[0_4px_12px_rgba(99,102,241,0.5)]"
                  />
                </div>
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-white/10 rounded-xl [transform:rotateY(90deg)_translateZ(48px)] grid place-items-center">
                  <Sparkles className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-200/20 dark:border-white/20 rounded-xl backdrop-blur-md [transform:rotateY(180deg)_translateZ(48px)]" />
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-white/10 rounded-xl [transform:rotateY(-90deg)_translateZ(48px)] grid place-items-center">
                  <ShieldCheck className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div className="absolute inset-0 bg-indigo-600/10 dark:bg-indigo-600/30 border border-indigo-200/30 rounded-xl [transform:rotateX(90deg)_translateZ(48px)]" />
                <div className="absolute inset-0 bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200/50 dark:border-white/10 rounded-xl [transform:rotateX(-90deg)_translateZ(48px)]" />
              </div>
            </div>

            {/* Visual crystal platform shadow */}
            <div className="w-32 h-2.5 bg-indigo-500/10 rounded-full blur-md mt-2 animate-pulse" />
          </div>

          <div className="max-w-md text-left relative z-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
              Manage the complete homebuyer journey.
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Every lead tracked. Every interaction recorded. Direct inventory control & real-time
              booking analytics.
            </p>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider relative z-10 text-left">
            © {new Date().getFullYear()} BLX REALTY. ALL RIGHTS RESERVED.
          </div>
        </div>

        {/* Right Side: Glassmorphism Login Card Form */}
        <div className="lg:col-span-6 flex items-center justify-center p-8 sm:p-12 relative">
          <div className="w-full max-w-md space-y-6">
            <div className="text-left">
              <h1 className="text-2xl font-display font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                {mode === "signin" && "Welcome back"}
                {mode === "signup" && "Create your account"}
                {mode === "forgot" && "Reset Password Recovery"}
                {mode === "reset" && "Update Password"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                {mode === "signin" && "Sign in to manage your leads and bookings."}
                {mode === "signup" && "Start tracking leads with the BLX Realty CRM."}
                {mode === "forgot" && "Recover your credentials using a secure token."}
                {mode === "reset" && "Enter the security token and type your new password."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="name"
                    className="text-slate-600 dark:text-slate-300 text-xs font-semibold"
                  >
                    Full name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Aisha Khan"
                    required
                    className="bg-white dark:bg-slate-950/40 border-slate-200 dark:border-white/10 text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-indigo-500/50 focus:ring-indigo-500/20 h-10 rounded-xl text-xs transition-all duration-200"
                  />
                </div>
              )}

              {mode !== "reset" && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-slate-600 dark:text-slate-300 text-xs font-semibold"
                  >
                    Email address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@blxrealty.com"
                    required
                    className="bg-white dark:bg-slate-950/40 border-slate-200 dark:border-white/10 text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-indigo-500/50 focus:ring-indigo-500/20 h-10 rounded-xl text-xs transition-all duration-200"
                  />
                </div>
              )}

              {mode === "reset" && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="reset-token-input"
                    className="text-slate-600 dark:text-slate-300 text-xs font-semibold"
                  >
                    Verification Token
                  </Label>
                  <Input
                    id="reset-token-input"
                    name="reset-token"
                    placeholder="BLX-MOCK-XXXXX"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    className="bg-white dark:bg-slate-950/40 border-slate-200 dark:border-white/10 text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-indigo-500/50 focus:ring-indigo-500/20 h-10 rounded-xl text-xs transition-all duration-200"
                  />
                </div>
              )}

              {(mode === "signin" || mode === "signup" || mode === "reset") && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="password"
                      className="text-slate-600 dark:text-slate-300 text-xs font-semibold"
                    >
                      {mode === "reset" ? "New Password" : "Password"}
                    </Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="bg-white dark:bg-slate-950/40 border-slate-200 dark:border-white/10 text-slate-950 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-indigo-500/50 focus:ring-indigo-500/20 h-10 rounded-xl pr-10 text-xs transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold h-10 rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 border-0 cursor-pointer"
                disabled={busy}
              >
                {busy ? "Signing in..." : ""}
                {!busy && mode === "signin" && "Sign in"}
                {!busy && mode === "signup" && "Create account"}
                {!busy && mode === "forgot" && "Send Verification Token"}
                {!busy && mode === "reset" && "Reset Password"}
              </Button>
            </form>

            <div className="text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex flex-col gap-3">
              {(mode === "signin" || mode === "signup") && (
                <div>
                  {mode === "signin" ? "New to BLX Realty?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
                  >
                    {mode === "signin" ? "Create an account" : "Sign in"}
                  </button>
                </div>
              )}
              {mode !== "signin" && (
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors self-center flex items-center gap-1"
                >
                  ← Back to Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
