"use client";

import { useState, useCallback, useEffect } from "react";
import {
  GraduationCap,
  BookOpen,
  Route,
  CalendarDays,
  LayoutGrid,
  Activity,
  Loader2,
  LogOut,
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

const PREVIEW_STEPS: AgentStep[] = [
  {
    agent: "orchestrator",
    action: "Assembling the advising workflow",
    status: "pending",
    detail: "Loading the student profile, constraints, and available tools.",
  },
  {
    agent: "requirements_agent",
    action: "Retrieving ASU degree requirements",
    status: "pending",
    detail: "Pulling the program audit structure and source trail.",
  },
  {
    agent: "credit_eval_agent",
    action: "Evaluating completed, AP, and transfer credit",
    status: "pending",
    detail: "Mapping past work to fulfilled and review-needed requirements.",
  },
  {
    agent: "planning_agent",
    action: "Generating the semester-by-semester plan",
    status: "pending",
    detail: "Checking bottlenecks, prerequisites, and graduation risk.",
  },
  {
    agent: "section_ranking_agent",
    action: "Ranking next-term schedule options",
    status: "pending",
    detail: "Balancing commute, professor quality, timing, and modality.",
  },
  {
    agent: "orchestrator",
    action: "Packaging recommendations for the dashboard",
    status: "pending",
    detail: "Finalizing the explainable demo output.",
  },
];

interface DashboardProps {
  onReset?: () => void;
}

export default function Dashboard({ onReset }: DashboardProps) {
  const [tab, setTab] = useState<Tab>("audit");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullAuditResult | null>(null);
  const [agentLog, setAgentLog] = useState<AgentStep[]>([]);
  const [error, setError] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const activeStep = agentLog.find((step) => step.status === "in_progress");

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    setAgentLog(PREVIEW_STEPS);
    try {
      const data = await api.runAudit();
      setResult(data);
      setAgentLog(data.agent_log || []);
      setSelectedScheduleId(data.schedules?.[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run audit");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      return;
    }

    let active = true;
    let current = 0;
    setAgentLog(
      PREVIEW_STEPS.map((step, index) => ({
        ...step,
        status: index === 0 ? "in_progress" : "pending",
      }))
    );

    const timer = window.setInterval(() => {
      if (!active) return;
      current = Math.min(current + 1, PREVIEW_STEPS.length - 1);
      setAgentLog(
        PREVIEW_STEPS.map((step, index) => ({
          ...step,
          status: index < current ? "completed" : index === current ? "in_progress" : "pending",
        }))
      );
    }, 900);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loading]);

  const handleSelectSchedule = useCallback(async (id: string) => {
    setSelectedScheduleId(id);
    try {
      await api.selectSchedule(id);
    } catch {
      // Keep the UX moving even if persistence fails locally.
    }
    setTab("calendar");
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
            {onReset && (
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-card-border text-muted hover:text-foreground transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                New Profile
              </button>
            )}
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
                    Latest: {activeStep?.action || agentLog[agentLog.length - 1]?.action}
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
                    selectedScheduleId={selectedScheduleId}
                    onSelectSchedule={handleSelectSchedule}
                  />
                )}
                {tab === "calendar" && result?.schedules && (
                  <CalendarView
                    schedules={result.schedules}
                    selectedScheduleId={selectedScheduleId}
                    onSelectSchedule={setSelectedScheduleId}
                  />
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
