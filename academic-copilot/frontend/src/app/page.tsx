"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  BookOpen,
  Calendar,
  Map,
  Brain,
  User,
  Loader2,
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
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* Hero */}
      <div className="text-center max-w-3xl animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-maroon/20 border border-maroon/30">
            <GraduationCap className="w-10 h-10 text-gold" />
          </div>
          <div className="p-3 rounded-xl bg-accent/20 border border-accent/30">
            <Sparkles className="w-10 h-10 text-accent-light" />
          </div>
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Academic Copilot
          <span className="block text-2xl font-medium text-muted mt-2">
            for Arizona State University
          </span>
        </h1>

        <p className="text-lg text-muted max-w-xl mx-auto mb-8">
          AI-powered academic advisor that audits your degree progress,
          plans your path to graduation, and builds your optimal schedule.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {[
            { icon: BookOpen, label: "Degree Audit", desc: "Requirements tracking" },
            { icon: Brain, label: "AI Planning", desc: "Semester-by-semester" },
            { icon: Map, label: "Smart Schedule", desc: "Commute-aware ranking" },
            { icon: Calendar, label: "Calendar Sync", desc: "Google Calendar export" },
          ].map((f) => (
            <div
              key={f.label}
              className="p-4 rounded-xl bg-card border border-card-border text-center"
            >
              <f.icon className="w-6 h-6 mx-auto mb-2 text-accent-light" />
              <div className="text-sm font-medium">{f.label}</div>
              <div className="text-xs text-muted">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Two buttons: Set up vs Demo */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              api.resetProfile().then(() => setMode("onboarding"));
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-maroon hover:bg-maroon/90 text-white font-semibold rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <User className="w-5 h-5" />
            Set Up My Profile
          </button>

          <button
            onClick={() => {
              api.loadDemo().then(() => setMode("dashboard"));
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-card hover:bg-card-border/30 text-foreground font-semibold rounded-xl text-lg border border-card-border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            Try Demo
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-xs text-muted">
        Powered by Vertex AI / Gemini &middot; Built for Innovation Hacks 2026
      </div>
    </div>
  );
}
