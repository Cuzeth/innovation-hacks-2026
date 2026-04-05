"use client";

import { useState } from "react";
import {
  Star,
  Clock,
  MapPin,
  User,
  Monitor,
  Car,
  Sparkles,
  Check,
} from "lucide-react";
import type { ProposedSchedule, ScheduleEntry } from "@/lib/types";
import clsx from "clsx";

interface Props {
  schedules: ProposedSchedule[];
  onSelectSchedule: (id: string) => void;
}

export default function ScheduleView({ schedules, onSelectSchedule }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!schedules.length) {
    return (
      <div className="text-center py-20 text-muted">
        No schedule recommendations available.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Schedule Recommendations for {schedules[0].semester}
        </h2>
      </div>

      {/* Schedule cards */}
      <div className="grid gap-4">
        {schedules.map((sched, i) => (
          <ScheduleCard
            key={sched.id}
            schedule={sched}
            rank={i + 1}
            selected={selectedId === sched.id}
            onSelect={() => {
              setSelectedId(sched.id);
              onSelectSchedule(sched.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleCard({
  schedule,
  rank,
  selected,
  onSelect,
}: {
  schedule: ProposedSchedule;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(rank === 1);

  return (
    <div
      className={clsx(
        "bg-card border rounded-xl overflow-hidden transition",
        selected
          ? "border-success/50 ring-1 ring-success/20"
          : "border-card-border"
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold",
              rank === 1
                ? "bg-gold/20 text-gold"
                : rank === 2
                ? "bg-accent/20 text-accent-light"
                : "bg-card-border text-muted"
            )}
          >
            #{rank}
          </div>
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              {schedule.name}
              {rank === 1 && (
                <Star className="w-3.5 h-3.5 text-gold fill-gold" />
              )}
            </div>
            <div className="text-xs text-muted">
              {schedule.total_credits} credits &middot; Score:{" "}
              {Math.round(schedule.overall_score * 100)}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Car className="w-3 h-3" />
              {Math.round(schedule.weekly_commute_minutes)} min/wk
            </span>
          </div>
          <button
            onClick={onSelect}
            className={clsx(
              "ml-3 px-4 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer",
              selected
                ? "bg-success/20 border-success/40 text-success"
                : "border-card-border text-muted hover:text-foreground hover:border-foreground/30"
            )}
          >
            {selected ? (
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" /> Selected
              </span>
            ) : (
              "Select"
            )}
          </button>
        </div>
      </div>

      {/* Weekly grid preview */}
      <div className="px-4 pb-2">
        <WeekGrid entries={schedule.entries} />
      </div>

      {/* Expand for details */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-center py-2 text-xs text-muted hover:text-foreground border-t border-card-border cursor-pointer"
      >
        {expanded ? "Hide Details" : "Show Details"}
      </button>

      {expanded && (
        <div className="border-t border-card-border p-4 space-y-3 animate-fade-in">
          {/* Section details */}
          {schedule.entries.map((entry) => (
            <SectionDetail key={entry.section.section.section_id} entry={entry} />
          ))}

          {/* AI Explanation */}
          {schedule.explanation && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-accent-light mb-1">
                <Sparkles className="w-3 h-3" />
                Why This Schedule
              </div>
              <p className="text-xs text-foreground/80">{schedule.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionDetail({ entry }: { entry: ScheduleEntry }) {
  const sec = entry.section.section;
  const scored = entry.section;
  return (
    <div className="bg-background rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="font-mono text-sm font-medium">{sec.course_id}</span>
          <span className="text-xs text-muted ml-2">{sec.title}</span>
        </div>
        <span className="text-xs text-accent-light font-medium">
          {Math.round(scored.score * 100)}%
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted mt-2">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {sec.instructor}
          {sec.instructor_rating && (
            <span className="text-gold">
              ({sec.instructor_rating.toFixed(1)})
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {sec.meeting_times[0]?.days.join("/")}{" "}
          {sec.meeting_times[0]?.start_time}-{sec.meeting_times[0]?.end_time}
        </span>
        <span className="flex items-center gap-1">
          <Monitor className="w-3 h-3" />
          {sec.modality}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {sec.meeting_times[0]?.building || sec.meeting_times[0]?.location || "TBA"}
        </span>
      </div>
      {entry.commute_before_minutes > 0 && (
        <div className="mt-1.5 text-[10px] text-muted flex items-center gap-1">
          <Car className="w-3 h-3" />
          ~{Math.round(entry.commute_before_minutes)} min commute each way
        </div>
      )}
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

const DAY_COLORS = [
  "bg-blue-500/30",
  "bg-emerald-500/30",
  "bg-amber-500/30",
  "bg-rose-500/30",
  "bg-purple-500/30",
  "bg-cyan-500/30",
];

function timeToOffset(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h - 8) * 60 + m;
}

function WeekGrid({ entries }: { entries: ScheduleEntry[] }) {
  const blocks: { day: number; top: number; height: number; label: string; color: string }[] = [];

  entries.forEach((entry, ci) => {
    const sec = entry.section.section;
    for (const mt of sec.meeting_times) {
      for (const day of mt.days) {
        const di = DAYS.indexOf(day);
        if (di === -1) continue;
        const top = timeToOffset(mt.start_time);
        const height = timeToOffset(mt.end_time) - top;
        blocks.push({
          day: di,
          top,
          height: Math.max(height, 20),
          label: sec.course_id,
          color: DAY_COLORS[ci % DAY_COLORS.length],
        });
      }
    }
  });

  const totalMinutes = 10 * 60; // 8 AM to 6 PM
  const gridHeight = 120;

  return (
    <div className="flex gap-1">
      {/* Time labels */}
      <div className="w-8 flex flex-col justify-between text-[9px] text-muted" style={{ height: gridHeight }}>
        {[8, 12, 18].map((h) => (
          <span key={h}>{h > 12 ? `${h - 12}p` : `${h}a`}</span>
        ))}
      </div>
      {/* Day columns */}
      {DAYS.map((day, di) => (
        <div
          key={day}
          className="flex-1 relative bg-background/50 rounded"
          style={{ height: gridHeight }}
        >
          <div className="text-[9px] text-muted text-center">{day}</div>
          {blocks
            .filter((b) => b.day === di)
            .map((b, i) => (
              <div
                key={i}
                className={clsx(
                  "absolute left-0.5 right-0.5 rounded text-[8px] text-center flex items-center justify-center font-medium",
                  b.color
                )}
                style={{
                  top: `${(b.top / totalMinutes) * 100}%`,
                  height: `${(b.height / totalMinutes) * 100}%`,
                }}
              >
                {b.label}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
