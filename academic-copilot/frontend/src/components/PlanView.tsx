"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Zap,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  GitBranch,
} from "lucide-react";
import type { AcademicPlan, GraduationPath, Bottleneck } from "@/lib/types";
import clsx from "clsx";

export default function PlanView({ plan }: { plan: AcademicPlan }) {
  const [activePath, setActivePath] = useState(0);
  const allPaths = [plan.recommended_path, ...plan.alternative_paths];
  const path = allPaths[activePath];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* AP Credit Impact Banner */}
      {plan.ap_credit_impact && plan.ap_credit_impact.credits_saved > 0 && (
        <div className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-start gap-3">
          <Award className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm text-success">
              AP Credits Saved You {plan.ap_credit_impact.semesters_saved} Semester(s)!
            </div>
            <p className="text-xs text-foreground/70 mt-1">
              {plan.ap_credit_impact.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Path selector */}
      <div className="flex gap-2">
        {allPaths.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setActivePath(i)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition cursor-pointer",
              activePath === i
                ? "bg-accent/15 border-accent/40 text-accent-light"
                : "bg-card border-card-border text-muted hover:text-foreground"
            )}
          >
            {i === 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {p.name}
            <span className="text-xs opacity-70">
              {p.total_semesters} sem &middot; {p.graduation_term}
            </span>
          </button>
        ))}
      </div>

      {/* Tradeoffs note for alt paths */}
      {activePath > 0 && path.tradeoffs && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-xs text-warning">
          <strong>Tradeoff:</strong> {path.tradeoffs}
        </div>
      )}

      {/* Risk summary */}
      {plan.risk_summary && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
            <ShieldAlert className="w-4 h-4 text-warning" />
            Risk to Graduation Timeline
          </h3>
          <div className="text-xs text-foreground/80 whitespace-pre-wrap">
            {plan.risk_summary}
          </div>
        </div>
      )}

      {/* Bottleneck alerts */}
      {plan.bottlenecks.length > 0 && (
        <BottleneckPanel bottlenecks={plan.bottlenecks} />
      )}

      {/* Semester timeline */}
      <div className="space-y-3">
        {path.semesters.map((sem, i) => (
          <SemesterCard key={sem.semester} semester={sem} index={i} />
        ))}
      </div>

      {/* AI Explanation */}
      {path.explanation && (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-accent-light mb-2">
            <Sparkles className="w-4 h-4" />
            Why This Plan
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
            {path.explanation}
          </p>
        </div>
      )}

      {/* Risk factors */}
      {path.risk_factors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Risk Factors</h3>
          {path.risk_factors.map((rf, i) => (
            <div
              key={i}
              className={clsx(
                "rounded-lg p-3 text-xs border",
                rf.level === "high"
                  ? "bg-danger/10 border-danger/30 text-danger"
                  : rf.level === "medium"
                  ? "bg-warning/10 border-warning/30 text-warning"
                  : "bg-card border-card-border text-muted"
              )}
            >
              <div className="font-medium">{rf.description}</div>
              {rf.mitigation && (
                <div className="mt-1 opacity-80">Mitigation: {rf.mitigation}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BottleneckPanel({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="bg-danger/5 border border-danger/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger" />
          <span className="text-sm font-semibold text-danger">
            {bottlenecks.length} Prerequisite Bottleneck(s) Detected
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {bottlenecks.map((bn) => (
            <div
              key={bn.course_id}
              className="bg-background rounded-lg p-3 text-xs"
            >
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="w-3.5 h-3.5 text-danger" />
                <span className="font-mono font-medium text-danger">
                  {bn.course_id}
                </span>
                <span className="text-muted">{bn.title}</span>
              </div>
              <div className="text-foreground/70">{bn.explanation}</div>
              <div className="flex gap-2 mt-1.5">
                <span className="px-1.5 py-0.5 bg-danger/10 text-danger rounded text-[10px]">
                  Blocks {bn.blocks.length} course(s)
                </span>
                <span className="px-1.5 py-0.5 bg-danger/10 text-danger rounded text-[10px]">
                  Chain depth: {bn.depth}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SemesterCard({
  semester,
  index,
}: {
  semester: import("@/lib/types").SemesterPlan;
  index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div
      className="bg-card border border-card-border rounded-xl overflow-hidden animate-fade-in"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-card-border/10 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted" />
          )}
          <div>
            <div className="font-medium text-sm">{semester.semester}</div>
            <div className="text-xs text-muted">
              {semester.courses.length} courses &middot; {semester.total_credits}{" "}
              credits
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {semester.courses.map((c) => (
            <span
              key={c.course_id}
              className={clsx(
                "px-2 py-0.5 text-[10px] rounded-full border",
                c.is_bottleneck
                  ? "bg-danger/15 border-danger/30 text-danger"
                  : "bg-card border-card-border text-muted"
              )}
            >
              {c.course_id}
            </span>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-card-border divide-y divide-card-border/50">
          {semester.courses.map((c) => (
            <div key={c.course_id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-sm font-medium">
                    {c.course_id}
                  </span>
                  <span className="text-sm text-muted ml-2">{c.title}</span>
                </div>
                <span className="text-xs text-muted">{c.credits} cr</span>
              </div>
              {c.is_bottleneck && (
                <div className="mt-1 text-[10px] text-danger flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Bottleneck — prerequisite for{" "}
                  {c.is_prerequisite_for.join(", ")}
                </div>
              )}
              {c.placement_reason && (
                <div className="mt-1 text-[10px] text-muted">
                  {c.placement_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
