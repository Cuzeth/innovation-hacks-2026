"use client";

import { useState, useEffect } from "react";
import { User, Play, Loader2, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { api } from "@/lib/api";
import type { StudentProfile } from "@/lib/types";
import clsx from "clsx";

interface Props {
  onRun: () => void;
  loading: boolean;
  hasResult: boolean;
}

export default function ProfileBar({ onRun, loading, hasResult }: Props) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  if (!profile) return null;

  const apCount = profile.completed_courses.filter(
    (c) => c.source === "ap"
  ).length;
  const asuCount = profile.completed_courses.filter(
    (c) => c.source === "asu"
  ).length;

  return (
    <div className="border-b border-card-border bg-card/30 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-maroon/20 border border-maroon/40 flex items-center justify-center">
            <User className="w-5 h-5 text-gold" />
          </div>
          <div>
            <div className="font-medium text-sm">{profile.name}</div>
            <div className="text-xs text-muted">
              {profile.major} &middot; {profile.catalog_year} &middot;{" "}
              {profile.total_credits_completed} credits completed
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-2 text-muted hover:text-foreground cursor-pointer"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        <button
          onClick={onRun}
          disabled={loading}
          className={clsx(
            "flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition cursor-pointer",
            loading
              ? "bg-muted/30 text-muted cursor-wait"
              : hasResult
              ? "bg-accent/20 text-accent-light border border-accent/30 hover:bg-accent/30"
              : "bg-maroon text-white hover:bg-maroon/90"
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {loading ? "Running..." : hasResult ? "Re-run Audit" : "Run Full Audit"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <InfoCard label="ASU Courses" value={`${asuCount}`} />
          <InfoCard label="AP Credits" value={`${apCount}`} />
          <InfoCard label="Target Grad" value={profile.preferences.target_graduation} />
          <InfoCard label="Max Credits" value={`${profile.preferences.max_credits_per_semester}/sem`} />

          <div className="col-span-full">
            <h4 className="text-xs text-muted mb-2 flex items-center gap-1">
              <Settings className="w-3 h-3" /> Preferences
            </h4>
            <div className="flex flex-wrap gap-2">
              {[
                `${profile.preferences.preferred_start_time}–${profile.preferences.preferred_end_time}`,
                profile.preferences.schedule_style,
                profile.preferences.modality !== "any" ? profile.preferences.modality : null,
                profile.preferences.avoid_days.length > 0 ? `No ${profile.preferences.avoid_days.join(", ")}` : null,
                profile.preferences.include_summer ? "Summer OK" : "No summer",
                profile.preferences.campus,
              ]
                .filter(Boolean)
                .map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs bg-card border border-card-border rounded-full text-muted"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}
