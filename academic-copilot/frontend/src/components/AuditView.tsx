"use client";

import { useState } from "react";
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  BookOpen,
} from "lucide-react";
import type { DegreeAudit, RequirementCategory, Requirement } from "@/lib/types";
import { api } from "@/lib/api";
import clsx from "clsx";

interface Props {
  audit: DegreeAudit | null;
  onRun: () => void;
}

export default function AuditView({ audit, onRun }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingExplain, setLoadingExplain] = useState(false);

  if (!audit) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="w-12 h-12 text-muted mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ready to Audit</h2>
        <p className="text-muted text-sm max-w-md mb-6">
          Click &quot;Run Full Audit&quot; to analyze your degree progress.
          The AI agents will evaluate your courses, check requirements, and
          generate your graduation plan.
        </p>
        <button
          onClick={onRun}
          className="px-6 py-2.5 bg-maroon text-white rounded-lg font-medium hover:bg-maroon/90 cursor-pointer"
        >
          Run Full Audit
        </button>
      </div>
    );
  }

  const loadExplanation = async () => {
    setLoadingExplain(true);
    try {
      const data = await api.getAuditExplanation();
      setExplanation(data.explanation);
    } catch {
      setExplanation("Unable to generate explanation.");
    }
    setLoadingExplain(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Overall Progress"
          value={`${audit.overall_progress_pct}%`}
          sub={`${audit.total_credits_completed}/${audit.degree_requirements.total_credits_required} credits`}
          color="accent"
        />
        <SummaryCard
          label="Fulfilled"
          value={`${audit.fulfilled_count}`}
          sub="requirements met"
          color="success"
        />
        <SummaryCard
          label="In Progress"
          value={`${audit.partial_count}`}
          sub="partially complete"
          color="warning"
        />
        <SummaryCard
          label="Remaining"
          value={`${audit.unmet_count}`}
          sub="still needed"
          color="danger"
        />
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        <div className="flex justify-between text-xs text-muted mb-2">
          <span>Degree Progress</span>
          <span>{audit.overall_progress_pct}%</span>
        </div>
        <div className="w-full h-3 bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-maroon to-gold rounded-full transition-all duration-1000"
            style={{ width: `${audit.overall_progress_pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted mt-1">
          <span>{audit.total_credits_completed} completed</span>
          <span>{audit.total_credits_remaining} remaining</span>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
        <button
          onClick={loadExplanation}
          disabled={loadingExplain}
          className="flex items-center gap-2 text-sm font-medium text-accent-light hover:text-accent cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          {loadingExplain
            ? "Generating AI summary..."
            : explanation
            ? "AI Summary"
            : "Generate AI Summary"}
        </button>
        {explanation && (
          <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">
            {explanation}
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {audit.categories.map((cat) => (
          <CategoryCard key={cat.name} category={cat} explanations={audit.explanations} />
        ))}
      </div>

      {/* Data source */}
      <div className="text-xs text-muted flex items-center gap-1">
        <Info className="w-3 h-3" />
        Source: {audit.degree_requirements.data_source}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-bold mt-1 text-${color}`}>{value}</div>
      <div className="text-xs text-muted mt-0.5">{sub}</div>
    </div>
  );
}

function CategoryCard({
  category,
  explanations,
}: {
  category: RequirementCategory;
  explanations: DegreeAudit["explanations"];
}) {
  const [expanded, setExpanded] = useState(true);
  const pct =
    category.credits_required > 0
      ? Math.min(
          100,
          Math.round(
            (category.credits_fulfilled / category.credits_required) * 100
          )
        )
      : 0;

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-card-border/20 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted" />
          )}
          <div className="text-left">
            <div className="font-medium text-sm">{category.display_name}</div>
            <div className="text-xs text-muted">
              {category.credits_fulfilled}/{category.credits_required} credits
              &middot; {pct}%
            </div>
          </div>
        </div>
        <div className="w-24 h-2 bg-background rounded-full overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all",
              pct === 100 ? "bg-success" : pct > 0 ? "bg-warning" : "bg-muted/30"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-card-border divide-y divide-card-border/50">
          {category.requirements.map((req) => (
            <RequirementRow
              key={req.id}
              req={req}
              explanation={explanations.find((e) => e.requirement_id === req.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequirementRow({
  req,
  explanation,
}: {
  req: Requirement;
  explanation?: DegreeAudit["explanations"][0];
}) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className="px-4 py-3">
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setShowDetail((v) => !v)}
      >
        <div className="mt-0.5">
          {req.status === "fulfilled" && (
            <CheckCircle className="w-4 h-4 text-success" />
          )}
          {req.status === "partially_fulfilled" && (
            <AlertTriangle className="w-4 h-4 text-warning" />
          )}
          {req.status === "unmet" && (
            <Circle className="w-4 h-4 text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{req.name}</span>
            <span className="text-xs text-muted">
              {req.credits_applied}/{req.credits_required} cr
            </span>
            {explanation?.needs_advisor_review && (
              <span className="text-[10px] px-1.5 py-0.5 bg-warning/20 text-warning rounded-full">
                Advisor Review
              </span>
            )}
          </div>
          {req.courses_applied.length > 0 && (
            <div className="text-xs text-muted mt-0.5">
              Applied: {req.courses_applied.join(", ")}
            </div>
          )}
        </div>
      </div>

      {showDetail && explanation && (
        <div className="ml-6 mt-2 p-2.5 bg-background rounded-lg text-xs animate-fade-in">
          <div className="text-foreground/80">{explanation.reasoning}</div>
          <div className="flex gap-3 mt-1.5 text-muted">
            <span>Confidence: {explanation.confidence}</span>
            <span>Source: {explanation.source_used}</span>
          </div>
        </div>
      )}
    </div>
  );
}
