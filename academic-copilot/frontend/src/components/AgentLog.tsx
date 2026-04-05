"use client";

import { Bot, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { AgentStep } from "@/lib/types";
import clsx from "clsx";

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "text-accent-light",
  requirements_agent: "text-blue-400",
  credit_eval_agent: "text-emerald-400",
  planning_agent: "text-amber-400",
  section_ranking_agent: "text-rose-400",
  calendar_agent: "text-cyan-400",
};

const AGENT_LABELS: Record<string, string> = {
  orchestrator: "Orchestrator",
  requirements_agent: "Requirements",
  credit_eval_agent: "Credit Eval",
  planning_agent: "Planner",
  section_ranking_agent: "Section Ranker",
  calendar_agent: "Calendar",
};

export default function AgentLog({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Bot className="w-4 h-4 text-accent" />
        Agent Activity
      </h3>

      {steps.length === 0 && (
        <p className="text-xs text-muted">
          Run the audit to see agent activity here.
        </p>
      )}

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex gap-2 animate-slide-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {step.status === "completed" && (
                <CheckCircle className="w-3.5 h-3.5 text-success" />
              )}
              {step.status === "in_progress" && (
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
              )}
              {step.status === "failed" && (
                <AlertCircle className="w-3.5 h-3.5 text-danger" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={clsx(
                    "text-[10px] font-mono font-medium",
                    AGENT_COLORS[step.agent] || "text-muted"
                  )}
                >
                  {AGENT_LABELS[step.agent] || step.agent}
                </span>
              </div>
              <div className="text-xs text-foreground/80">{step.action}</div>
              {step.detail && (
                <div className="text-[10px] text-muted mt-0.5">
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
