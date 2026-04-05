"use client";

import { useState, useCallback } from "react";
import {
  GraduationCap,
  BookOpen,
  Route,
  CalendarDays,
  LayoutGrid,
  Activity,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import type { FullAuditResult, AgentStep } from "@/lib/types";
import AuditView from "./AuditView";
import PlanView from "./PlanView";
import ScheduleView from "./ScheduleView";
import CalendarView from "./CalendarView";
import AgentLog from "./AgentLog";
import ProfileBar from "./ProfileBar";
import clsx from "clsx";

type Tab = "audit" | "plan" | "schedule" | "calendar";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("audit");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullAuditResult | null>(null);
  const [agentLog, setAgentLog] = useState<AgentStep[]>([]);
  const [error, setError] = useState("");
  const [showLog, setShowLog] = useState(false);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    setAgentLog([]);
    try {
      const data = await api.runAudit();
      setResult(data);
      setAgentLog(data.agent_log || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run audit");
    } finally {
      setLoading(false);
    }
  }, []);

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "audit", label: "Degree Audit", icon: BookOpen },
    { id: "plan", label: "Grad Plan", icon: Route },
    { id: "schedule", label: "Schedule", icon: LayoutGrid },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-gold" />
            <span className="font-semibold text-sm">Academic Copilot</span>
            <span className="text-xs text-muted hidden sm:inline">
              &middot; Arizona State University
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLog((v) => !v)}
              className={clsx(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition cursor-pointer",
                showLog
                  ? "bg-accent/20 border-accent/40 text-accent-light"
                  : "border-card-border text-muted hover:text-foreground"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              Agent Log
              {agentLog.length > 0 && (
                <span className="ml-1 bg-accent/30 text-accent-light text-[10px] px-1.5 py-0.5 rounded-full">
                  {agentLog.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">
        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Profile + Run bar */}
          <ProfileBar onRun={runAudit} loading={loading} hasResult={!!result} />

          {/* Tab nav */}
          <nav className="border-b border-card-border px-4">
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  disabled={!result && t.id !== "audit"}
                  className={clsx(
                    "flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition cursor-pointer",
                    tab === t.id
                      ? "border-accent text-accent-light font-medium"
                      : "border-transparent text-muted hover:text-foreground",
                    !result && t.id !== "audit" && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 p-4 overflow-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-muted text-sm">
                  Running AI agents... This may take a moment.
                </p>
                {agentLog.length > 0 && (
                  <div className="text-xs text-muted mt-2">
                    Latest: {agentLog[agentLog.length - 1]?.action}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 text-danger text-sm">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {tab === "audit" && (
                  <AuditView audit={result?.audit ?? null} onRun={runAudit} />
                )}
                {tab === "plan" && result?.plan && (
                  <PlanView plan={result.plan} />
                )}
                {tab === "schedule" && result?.schedules && (
                  <ScheduleView
                    schedules={result.schedules}
                    onSelectSchedule={(id) => setTab("calendar")}
                  />
                )}
                {tab === "calendar" && result?.schedules && (
                  <CalendarView schedules={result.schedules} />
                )}
              </>
            )}
          </div>
        </main>

        {/* Agent log sidebar */}
        {showLog && (
          <aside className="w-80 border-l border-card-border bg-card/30 overflow-auto">
            <AgentLog steps={agentLog} />
          </aside>
        )}
      </div>
    </div>
  );
}
