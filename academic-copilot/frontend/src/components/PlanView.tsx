"use client";

import { useEffect, useState } from "react";
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
  MessageSquareMore,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  AcademicPlan,
  GraduationPath,
  Bottleneck,
  WhatIfAnalysis,
  WhatIfCandidate,
} from "@/lib/types";
import Markdown from "./Markdown";
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
          <div className="text-xs text-foreground/80">
            <Markdown text={plan.risk_summary} />
          </div>
        </div>
      )}

      {/* Bottleneck alerts */}
      {plan.bottlenecks.length > 0 && (
        <BottleneckPanel bottlenecks={plan.bottlenecks} />
      )}

      <WhatIfPanel baselinePlan={plan} />

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
          <div className="text-sm text-foreground/80">
            <Markdown text={path.explanation} />
          </div>
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

function WhatIfPanel({ baselinePlan }: { baselinePlan: AcademicPlan }) {
  const [options, setOptions] = useState<WhatIfCandidate[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState<WhatIfAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getWhatIfOptions()
      .then((data) => {
        setOptions(data.options || []);
        if (data.options?.length) {
          setSelectedCourseId(data.options[0].course_id);
          setQuestion(`What if I fail ${data.options[0].course_id}?`);
        }
      })
      .catch(() => {});
  }, [baselinePlan.student_id]);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.analyzeWhatIf({
        question,
        target_course_id: selectedCourseId,
      });
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to analyze scenario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareMore className="w-4 h-4 text-accent" />
          What-If Copilot
        </h3>
        <p className="text-xs text-muted mt-1">
          Ask what happens if you fail an in-progress or upcoming course, and get a recovery plan.
        </p>
      </div>

      <div className="grid md:grid-cols-[0.9fr_1.1fr_auto] gap-3">
        <select
          value={selectedCourseId}
          onChange={(e) => {
            const nextCourseId = e.target.value;
            setSelectedCourseId(nextCourseId);
            if (!question.trim() || question.toLowerCase().includes("what if i fail")) {
              setQuestion(`What if I fail ${nextCourseId}?`);
            }
          }}
          className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
        >
          {options.map((option) => (
            <option key={`${option.source}-${option.course_id}`} value={option.course_id}>
              {option.course_id} · {option.source === "in_progress" ? "In Progress" : option.semester}
            </option>
          ))}
        </select>

        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What if I fail CSE 330?"
          className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
        />

        <button
          onClick={submit}
          disabled={loading || (!selectedCourseId && !question.trim())}
          className="px-4 py-2 rounded-lg bg-maroon text-white text-sm font-medium hover:bg-maroon/90 disabled:opacity-60 cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
        </button>
      </div>

      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.slice(0, 5).map((option) => (
            <button
              key={`${option.source}-${option.course_id}-chip`}
              onClick={() => {
                setSelectedCourseId(option.course_id);
                setQuestion(`What if I fail ${option.course_id}?`);
              }}
              className="px-2.5 py-1 rounded-full border border-card-border text-xs text-muted hover:text-foreground cursor-pointer"
            >
              {option.course_id} · {option.source === "in_progress" ? "In Progress" : option.semester}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-xs text-danger">
          {error}
        </div>
      )}

      {analysis && (
        <div className="space-y-3 animate-fade-in">
          <div className="grid md:grid-cols-3 gap-3">
            <ScenarioCard
              label="Baseline"
              value={analysis.baseline_graduation_term}
              sub="original graduation term"
            />
            <ScenarioCard
              label="Scenario"
              value={analysis.scenario_graduation_term}
              sub={`after failing ${analysis.target_course_id}`}
            />
            <ScenarioCard
              label="Delay"
              value={`${analysis.delay_semesters}`}
              sub="semester(s) added"
              danger={analysis.delay_semesters > 0}
            />
          </div>

          <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
            <div className="text-sm font-medium text-accent-light mb-2">
              What changes
            </div>
            <div className="text-sm text-foreground/80">
              <Markdown text={analysis.explanation} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-background rounded-xl p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
                First Courses Affected
              </div>
              <div className="flex flex-wrap gap-2">
                {(analysis.impacted_courses.length > 0
                  ? analysis.impacted_courses
                  : analysis.blocked_courses
                ).slice(0, 6).map((courseId) => (
                  <span
                    key={courseId}
                    className="px-2 py-1 rounded-full bg-warning/10 text-warning text-xs"
                  >
                    {courseId}
                  </span>
                ))}
                {analysis.impacted_courses.length === 0 && analysis.blocked_courses.length === 0 && (
                  <span className="text-xs text-muted">No direct downstream blockers detected.</span>
                )}
              </div>
            </div>

            <div className="bg-background rounded-xl p-4">
              <div className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
                Recovery Plan
              </div>
              <div className="space-y-2">
                {analysis.recovery_actions.map((action) => (
                  <div key={action.title} className="text-xs">
                    <div className="font-medium">{action.title}</div>
                    <div className="text-muted mt-0.5">{action.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioCard({
  label,
  value,
  sub,
  danger = false,
}: {
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-background rounded-xl p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={clsx("text-2xl font-bold mt-1", danger ? "text-danger" : "text-foreground")}>
        {value}
      </div>
      <div className="text-xs text-muted mt-1">{sub}</div>
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
