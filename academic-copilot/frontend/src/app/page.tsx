"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  BookOpen,
  Map,
  Brain,
  User,
  Loader2,
  Route,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import Dashboard from "@/components/Dashboard";
import Onboarding from "@/components/Onboarding";

type Mode = "landing" | "onboarding" | "dashboard";

export default function Home() {
  const [mode, setMode] = useState<Mode>("landing");
  const [checking, setChecking] = useState(true);

  // Check if profile already exists
  useEffect(() => {
    api
      .getProfile()
      .then((p) => {
        if (p && !("not_setup" in p && p.not_setup)) {
          // Profile exists, go straight to dashboard
          setMode("dashboard");
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (mode === "onboarding") {
    return <Onboarding onComplete={() => setMode("dashboard")} />;
  }

  if (mode === "dashboard") {
    return <Dashboard onReset={() => { api.resetProfile(); setMode("landing"); }} />;
  }

  return (
    <div className="min-h-screen px-4 py-6 md:py-10">
      <div className="max-w-7xl mx-auto">
        <div className="glass-panel rounded-[2rem] overflow-hidden">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="px-6 py-10 md:px-12 md:py-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-maroon/10 border border-maroon/20 text-xs font-medium text-maroon mb-6">
                <Sparkles className="w-3.5 h-3.5" />
                Hackathon demo tuned for one polished ASU advising journey
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-maroon/10 border border-maroon/20">
                  <GraduationCap className="w-10 h-10 text-maroon" />
                </div>
                <div className="p-3 rounded-2xl bg-gold/20 border border-gold/40">
                  <Brain className="w-10 h-10 text-foreground" />
                </div>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[0.95] mb-5">
                Academic Copilot
                <span className="block text-maroon">for Arizona State University</span>
              </h1>

              <p className="text-lg text-muted max-w-2xl mb-8">
                An explainable AI academic advisor that audits degree progress,
                spots prerequisite bottlenecks, builds a graduation roadmap,
                ranks next-term schedules, and exports the final plan to Google Calendar.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {[
                  { icon: BookOpen, label: "Degree Audit", desc: "Fulfilled vs. unmet requirements" },
                  { icon: Route, label: "Grad Plan", desc: "Multi-path semester roadmap" },
                  { icon: Map, label: "Commute Ranker", desc: "Time + professor + campus fit" },
                  { icon: ShieldAlert, label: "Risk Panel", desc: "Timeline blockers called out early" },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="glass-panel rounded-2xl p-4 text-left"
                  >
                    <f.icon className="w-5 h-5 mb-3 text-accent-light" />
                    <div className="text-sm font-semibold">{f.label}</div>
                    <div className="text-xs text-muted mt-1">{f.desc}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-start gap-3">
                <button
                  onClick={() => {
                    api.resetProfile().then(() => setMode("onboarding"));
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-maroon hover:bg-maroon/92 text-white font-semibold rounded-2xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-maroon/20"
                >
                  <User className="w-5 h-5" />
                  Set Up My Profile
                </button>

                <button
                  onClick={() => {
                    api.loadDemo().then(() => setMode("dashboard"));
                  }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-card hover:bg-white/60 text-foreground font-semibold rounded-2xl text-lg border border-card-border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  Launch Demo Student
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-maroon text-white px-6 py-10 md:px-10 md:py-14">
              <div className="text-sm uppercase tracking-[0.18em] text-gold/90 mb-3">
                Live Agent Relay
              </div>
              <h2 className="text-3xl font-bold leading-tight mb-4">
                One workflow, six coordinated specialists.
              </h2>
              <p className="text-sm text-white/75 mb-8">
                The wow moment is visible agentic behavior: each step has a clear role,
                a typed handoff, and an explanation the student can trust.
              </p>

              <div className="space-y-3">
                {[
                  ["Orchestrator", "Chooses which specialist acts next and preserves the student context."],
                  ["Requirements", "Pulls the ASU program structure and source trail."],
                  ["Credit Eval", "Maps completed, AP, and transfer work onto the audit."],
                  ["Planner", "Finds bottlenecks and compares graduation paths."],
                  ["Section Ranker", "Re-scores schedules with commute, timing, and instructor quality."],
                  ["Calendar Agent", "Previews the exact events before writing anything."],
                ].map(([label, desc], index) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/15 bg-white/7 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{label}</div>
                        <div className="text-xs text-white/70 mt-0.5">{desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-white/10 border border-white/15 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-gold/90 mb-2">
                  Demo Promise
                </div>
                <p className="text-sm text-white/80">
                  Smaller scope, stronger finish: one ASU student, one major, one beautiful end-to-end plan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-xs text-muted">
        Powered by Vertex AI / Gemini, Google Calendar, and commute-aware schedule ranking
      </div>
    </div>
  );
}
