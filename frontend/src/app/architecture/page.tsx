"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mermaid from "mermaid";
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  Code01 as Code,
  Database01 as Database,
  LayersTwo01 as Layers,
  RefreshCcw01 as RefreshCw,
  Server01 as Server,
  ShieldTick as Shield,
  Stars01 as Sparkles,
} from "@untitledui/icons";

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#f5effa",
    primaryTextColor: "#33302e",
    primaryBorderColor: "#4b0e68",
    lineColor: "#4b0e68",
    secondaryColor: "#faf8f6",
    tertiaryColor: "#ffffff",
  },
});

function MermaidDiagram({ chart, id }: { chart: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    if (!containerRef.current) return;
    mermaid
      .render(`arch-${id}`, chart)
      .then(({ svg }) => {
        if (active && containerRef.current) {
          containerRef.current.innerHTML = svg;
          const svgEl = containerRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
          }
        }
      })
      .catch((err) => {
        console.error("Mermaid render error:", err);
      });
    return () => {
      active = false;
    };
  }, [chart, id]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto bg-white border border-border rounded-[12px] p-4 sm:p-6 flex justify-center"
    />
  );
}

const SYSTEM_DIAGRAM = `flowchart LR
  FE["Next.js 16 Frontend<br/>localhost:3000"] -->|"api.ts + Bearer JWT"| BE["Express 4 Backend<br/>localhost:4000"]
  BE -->|"supabase-js"| DB[("Supabase PostgreSQL")]
  BE -->|"Fallback"| WBF["whiteboards_db.json"]
  BE -->|"groq-sdk"| GROQ["Groq Cloud LLM"]
  BE -->|"OAuth2 + Calendar API"| GCAL["Google Calendar"]
`;

const AUTH_SEQUENCE = `sequenceDiagram
  participant U as Browser / AuthContext
  participant API as Express /api/auth
  participant DB as Supabase students
  U->>API: POST /login or /register
  API->>DB: Verify bcrypt hash / Insert row
  DB-->>API: Student record
  API-->>U: 7-day JWT (Quill_token)
  U->>API: GET/POST /api/* (Authorization: Bearer JWT)
  API->>API: authMiddleware verifies JWT_SECRET
  API-->>U: Scoped student data
`;

const AI_FLOW = `flowchart TD
  Upload["PDF / MD / TXT / CSV Upload"] -->|"POST /api/ai/parse-document"| Parser["pdf-parse / UTF-8"]
  Parser -->|"Extracted Text"| Context["AI Chat / Flashcards / Quiz / Smart Tools"]
  Context -->|"groq.js"| LLM["Groq LLM"]
  LLM -->|"Structured JSON / Markdown"| UI["Interactive Study UI + Mermaid"]
`;

type Endpoint = {
  group: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  auth: "JWT" | "Public";
  purpose: string;
  file: string;
};

const ENDPOINTS: Endpoint[] = [
  { group: "Auth", method: "POST", path: "/api/auth/check-email", auth: "Public", purpose: "Check if email is available during signup", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "POST", path: "/api/auth/register", auth: "Public", purpose: "Create student with bcrypt hash & issue 7d JWT", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "POST", path: "/api/auth/login", auth: "Public", purpose: "Verify credentials & issue 7d JWT", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "POST", path: "/api/auth/forgot-password", auth: "Public", purpose: "Generate 15m single-use password reset JWT", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "POST", path: "/api/auth/reset-password", auth: "Public", purpose: "Verify reset JWT & update password_hash", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "GET", path: "/api/auth/me", auth: "JWT", purpose: "Fetch current authenticated student profile", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "PUT", path: "/api/auth/me", auth: "JWT", purpose: "Update name, branch, year, subjects", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "PUT", path: "/api/auth/password", auth: "JWT", purpose: "Change password after verifying current password", file: "backend/src/routes/auth.js" },
  { group: "Auth", method: "DELETE", path: "/api/auth/me", auth: "JWT", purpose: "Delete student account and related records", file: "backend/src/routes/auth.js" },

  { group: "Tasks", method: "GET", path: "/api/tasks", auth: "JWT", purpose: "List all tasks ordered by deadline", file: "backend/src/routes/tasks.js" },
  { group: "Tasks", method: "GET", path: "/api/tasks/today", auth: "JWT", purpose: "List tasks due today", file: "backend/src/routes/tasks.js" },
  { group: "Tasks", method: "GET", path: "/api/tasks/upcoming", auth: "JWT", purpose: "List tasks due in the next 7 days", file: "backend/src/routes/tasks.js" },
  { group: "Tasks", method: "POST", path: "/api/tasks", auth: "JWT", purpose: "Create task with deadline & reminder time", file: "backend/src/routes/tasks.js" },
  { group: "Tasks", method: "PUT", path: "/api/tasks/:id", auth: "JWT", purpose: "Update task details or completion status", file: "backend/src/routes/tasks.js" },
  { group: "Tasks", method: "DELETE", path: "/api/tasks/:id", auth: "JWT", purpose: "Delete a task", file: "backend/src/routes/tasks.js" },

  { group: "Notices", method: "GET", path: "/api/notices", auth: "JWT", purpose: "Fetch student notices", file: "backend/src/routes/notices.js" },
  { group: "Notices", method: "POST", path: "/api/notices", auth: "JWT", purpose: "Summarize notice via Groq AI and save", file: "backend/src/routes/notices.js" },

  { group: "Attendance", method: "GET", path: "/api/attendance", auth: "JWT", purpose: "List subject attendance records", file: "backend/src/routes/attendance.js" },
  { group: "Attendance", method: "POST", path: "/api/attendance", auth: "JWT", purpose: "Upsert subject total/attended classes & threshold", file: "backend/src/routes/attendance.js" },
  { group: "Attendance", method: "DELETE", path: "/api/attendance/:id", auth: "JWT", purpose: "Delete an attendance record", file: "backend/src/routes/attendance.js" },

  { group: "AI", method: "GET", path: "/api/ai/tip", auth: "Public", purpose: "Get a quick AI study tip", file: "backend/src/routes/ai.js" },
  { group: "AI", method: "POST", path: "/api/ai/parse-document", auth: "JWT", purpose: "Extract text from PDF, TXT, MD, CSV, JSON", file: "backend/src/routes/ai.js" },
  { group: "AI", method: "POST", path: "/api/ai/chat", auth: "JWT", purpose: "Conversational AI study assistant", file: "backend/src/routes/ai.js" },
  { group: "AI", method: "POST", path: "/api/ai/flashcards", auth: "JWT", purpose: "Generate flashcards from notes", file: "backend/src/routes/ai.js" },
  { group: "AI", method: "POST", path: "/api/ai/quiz", auth: "JWT", purpose: "Generate MCQ / True-False / Short Answer quiz", file: "backend/src/routes/ai.js" },
  { group: "AI", method: "POST", path: "/api/ai/grade-short-answer", auth: "JWT", purpose: "AI-grade a student short-answer response", file: "backend/src/routes/ai.js" },
  { group: "AI", method: "POST", path: "/api/ai/attendance-alert", auth: "JWT", purpose: "AI attendance risk analysis per subject", file: "backend/src/routes/ai.js" },
  { group: "AI", method: "POST", path: "/api/ai/tool/:toolSlug", auth: "JWT", purpose: "Run Smart Tools (summarize, schedule, concept map, etc.)", file: "backend/src/routes/ai.js" },

  { group: "Study Data", method: "GET", path: "/api/flashcards/decks", auth: "JWT", purpose: "List saved flashcard decks & cards", file: "backend/src/routes/flashcards.js" },
  { group: "Study Data", method: "POST", path: "/api/flashcards/decks", auth: "JWT", purpose: "Create a flashcard deck", file: "backend/src/routes/flashcards.js" },
  { group: "Study Data", method: "PATCH", path: "/api/flashcards/:id/status", auth: "JWT", purpose: "Update flashcard mastery status", file: "backend/src/routes/flashcards.js" },
  { group: "Study Data", method: "GET", path: "/api/quizzes", auth: "JWT", purpose: "List saved quizzes", file: "backend/src/routes/quizzes.js" },
  { group: "Study Data", method: "POST", path: "/api/quizzes", auth: "JWT", purpose: "Save a generated quiz", file: "backend/src/routes/quizzes.js" },
  { group: "Study Data", method: "PATCH", path: "/api/quizzes/:id/submit", auth: "JWT", purpose: "Submit quiz score & answers", file: "backend/src/routes/quizzes.js" },

  { group: "Whiteboards", method: "GET", path: "/api/whiteboards", auth: "JWT", purpose: "List whiteboards (Supabase or local JSON fallback)", file: "backend/src/routes/whiteboards.js" },
  { group: "Whiteboards", method: "POST", path: "/api/whiteboards", auth: "JWT", purpose: "Create new whiteboard", file: "backend/src/routes/whiteboards.js" },
  { group: "Whiteboards", method: "PUT", path: "/api/whiteboards/:id", auth: "JWT", purpose: "Auto-save shapes, layers, and viewport", file: "backend/src/routes/whiteboards.js" },
  { group: "Whiteboards", method: "DELETE", path: "/api/whiteboards/:id", auth: "JWT", purpose: "Delete a whiteboard", file: "backend/src/routes/whiteboards.js" },

  { group: "Google & Calendar", method: "GET", path: "/api/auth/google/url", auth: "Public", purpose: "Get OAuth URL to link Google Calendar (requires state)", file: "backend/src/routes/google.js" },
  { group: "Google & Calendar", method: "GET", path: "/api/auth/google/status", auth: "JWT", purpose: "Check if Google Calendar is connected", file: "backend/src/routes/google.js" },
  { group: "Google & Calendar", method: "GET", path: "/api/auth/google/calendar/events", auth: "JWT", purpose: "Fetch upcoming Google Calendar events", file: "backend/src/routes/google.js" },
  { group: "Google & Calendar", method: "GET", path: "/api/calendar/feed/:student_id", auth: "Public", purpose: "Export student deadlines as ICS calendar feed", file: "backend/src/routes/calendar.js" },

  { group: "Gamification", method: "GET", path: "/api/achievements", auth: "JWT", purpose: "Compute XP, level, and 7 academic badges", file: "backend/src/routes/achievements.js" },
  { group: "Gamification", method: "POST", path: "/api/activity/ping", auth: "JWT", purpose: "Update daily study streak", file: "backend/src/routes/activity.js" },
  { group: "Gamification", method: "POST", path: "/api/activity/focus", auth: "JWT", purpose: "Log focus timer minutes", file: "backend/src/routes/activity.js" },
  { group: "Gamification", method: "GET", path: "/api/activity/stats", auth: "JWT", purpose: "Get streak days and total focus hours", file: "backend/src/routes/activity.js" },
];

const TABLES = [
  { name: "students", keyFields: "id, name, email, password_hash, branch, year, subjects[]" },
  { name: "tasks", keyFields: "id, student_id, title, subject, deadline, reminder_time, status" },
  { name: "notices", keyFields: "id, student_id, notice_text, ai_summary, event_date, event_title" },
  { name: "attendance", keyFields: "id, student_id, subject, total_classes, attended_classes, threshold" },
  { name: "preferences", keyFields: "id, user_id, settings (JSONB: streak, focus_minutes, google tokens)" },
  { name: "whiteboards", keyFields: "id, student_id, title, data (JSONB), thumbnail" },
  { name: "flashcard_decks / flashcards", keyFields: "id, student_id, title / deck_id, front, back, status" },
  { name: "quizzes", keyFields: "id, student_id, title, questions (JSONB), score" },
];

const METHOD_COLORS: Record<Endpoint["method"], string> = {
  GET: "bg-emerald-50 text-emerald-700 border-emerald-200",
  POST: "bg-primary/10 text-primary border-primary/20",
  PUT: "bg-amber-50 text-amber-700 border-amber-200",
  PATCH: "bg-blue-50 text-blue-700 border-blue-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
};

export default function ArchitectureDashboardPage() {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [lastChecked, setLastChecked] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"overview" | "auth" | "ai">("overview");
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [search, setSearch] = useState("");

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  const checkHealth = async () => {
    setBackendStatus("checking");
    try {
      const res = await fetch(`${backendUrl}/api/health`, { cache: "no-store" });
      if (res.ok) {
        setBackendStatus("online");
        setLastChecked(new Date().toLocaleTimeString());
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const groups = ["All", ...Array.from(new Set(ENDPOINTS.map((e) => e.group)))];
  const filteredEndpoints = ENDPOINTS.filter((e) => {
    const matchesGroup = selectedGroup === "All" || e.group === selectedGroup;
    const matchesSearch =
      !search.trim() ||
      e.path.toLowerCase().includes(search.toLowerCase()) ||
      e.purpose.toLowerCase().includes(search.toLowerCase()) ||
      e.file.toLowerCase().includes(search.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-[8px] border border-border hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              App
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center">
                <img src="/logo-quill.png" alt="Quill Logo" className="w-5 h-5 object-contain" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight">Quill System Architecture</h1>
                <p className="text-xs text-muted-foreground">Live service map, API explorer & extension guide</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                backendStatus === "online"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : backendStatus === "offline"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Backend: {backendStatus === "online" ? `Online (${lastChecked})` : backendStatus}
            </div>
            <button
              type="button"
              onClick={checkHealth}
              aria-label="Refresh backend health"
              className="p-2 rounded-[8px] border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-border rounded-[12px] p-5 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <Layers className="w-4 h-4" />
              Frontend (Port 3000)
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Next.js 16 App Router, React 19, Tailwind CSS, Zustand, custom <code>api.ts</code> client with Bearer JWT.
            </p>
          </div>
          <div className="bg-white border border-border rounded-[12px] p-5 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <Server className="w-4 h-4" />
              Backend (Port 4000)
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Express.js REST API across 12 route modules, JWT + bcryptjs auth, Multer + pdf-parse, Groq SDK.
            </p>
          </div>
          <div className="bg-white border border-border rounded-[12px] p-5 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <Database className="w-4 h-4" />
              Data & Persistence
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Supabase PostgreSQL via <code>@supabase/supabase-js</code> + local JSON fallback for whiteboards.
            </p>
          </div>
          <div className="bg-white border border-border rounded-[12px] p-5 shadow-xs">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
              <Shield className="w-4 h-4" />
              Auth & Integrations
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pure email/password JWT auth, password reset/change, and per-user Google Calendar OAuth2 sync.
            </p>
          </div>
        </section>

        {/* Interactive Diagrams */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Architecture & Data Flow</h2>
              <p className="text-xs text-muted-foreground">Switch views to inspect how requests flow through Quill</p>
            </div>
            <div className="flex bg-muted/60 p-1 rounded-[10px] border border-border">
              {[
                { id: "overview", label: "System Map" },
                { id: "auth", label: "Auth Sequence" },
                { id: "ai", label: "AI Pipeline" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-[8px] transition-colors ${
                    activeTab === t.id
                      ? "bg-white text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "overview" && <MermaidDiagram id="system" chart={SYSTEM_DIAGRAM} />}
          {activeTab === "auth" && <MermaidDiagram id="auth" chart={AUTH_SEQUENCE} />}
          {activeTab === "ai" && <MermaidDiagram id="ai" chart={AI_FLOW} />}
        </section>

        {/* API Explorer */}
        <section className="bg-white border border-border rounded-[12px] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" />
                Backend API Explorer ({filteredEndpoints.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Base URL: <code>{backendUrl}</code>
              </p>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter endpoints, purpose, or file..."
              aria-label="Filter API endpoints"
              className="w-full md:w-72 px-3 py-2 border border-border rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGroup(g)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedGroup === g
                    ? "bg-primary text-white border-primary"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto border border-border rounded-[10px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground uppercase">
                <tr>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Endpoint</th>
                  <th className="py-2.5 px-3">Auth</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">Source File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEndpoints.map((ep) => (
                  <tr key={`${ep.method}-${ep.path}`} className="hover:bg-muted/20">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold border ${METHOD_COLORS[ep.method]}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-foreground whitespace-nowrap">{ep.path}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${ep.auth === "JWT" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {ep.auth}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{ep.purpose}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{ep.file}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Database Tables & Extension Guide */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-border rounded-[12px] p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Supabase Tables
            </h2>
            <div className="space-y-2.5">
              {TABLES.map((t) => (
                <div key={t.name} className="p-3 rounded-[10px] bg-background border border-border">
                  <div className="font-mono text-xs font-bold text-primary">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.keyFields}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-border rounded-[12px] p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              How to Add a New Service or Feature
            </h2>
            <ol className="space-y-3 text-xs text-muted-foreground">
              <li className="flex gap-2.5">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block">1. Database Table (Supabase)</strong>
                  Add a migration in <code>sql/</code> with <code>student_id UUID REFERENCES public.students(id)</code>.
                </div>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block">2. Backend Service & Route</strong>
                  Add business logic in <code>backend/src/services/</code>, create a router in <code>backend/src/routes/</code> protected by <code>authMiddleware</code>, and mount it in <code>backend/src/index.js</code>.
                </div>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block">3. Frontend Page & Navigation</strong>
                  Create a page under <code>frontend/src/app/(dashboard)/dashboard/&lt;feature&gt;/page.tsx</code>, call the backend via <code>api.get/post</code> from <code>src/lib/api.ts</code>, and add a link in <code>Sidebar.tsx</code>.
                </div>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground block">4. AI Capabilities (Optional)</strong>
                  Add prompt helpers in <code>backend/src/services/groq.js</code> and expose them via <code>backend/src/routes/ai.js</code>.
                </div>
              </li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}
