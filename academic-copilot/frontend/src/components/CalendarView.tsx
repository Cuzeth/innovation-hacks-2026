"use client";

import { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Car,
  ExternalLink,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ProposedSchedule, CalendarEvent } from "@/lib/types";
import clsx from "clsx";

interface Props {
  schedules: ProposedSchedule[];
}

export default function CalendarView({ schedules }: Props) {
  const [selectedScheduleId, setSelectedScheduleId] = useState(
    schedules[0]?.id || ""
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [includeCommute, setIncludeCommute] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
    calendar_url?: string;
  } | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    configured: boolean;
    authenticated: boolean;
    mock_mode: boolean;
  } | null>(null);

  useEffect(() => {
    api.getAuthStatus().then(setAuthStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedScheduleId) return;
    setLoading(true);
    api
      .previewCalendar(selectedScheduleId, includeCommute)
      .then((data) => setEvents(data.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [selectedScheduleId, includeCommute]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.exportCalendar(selectedScheduleId, includeCommute);
      setExportResult(result);
      setExported(result.success);
    } catch (e) {
      setExportResult({
        success: false,
        message: e instanceof Error ? e.message : "Export failed",
      });
    }
    setExporting(false);
  };

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId);
  const classEvents = events.filter((e) => !e.is_commute_block);
  const commuteEvents = events.filter((e) => e.is_commute_block);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-accent" />
        Calendar Export
      </h2>

      {/* Schedule selector */}
      <div className="flex gap-2">
        {schedules.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSelectedScheduleId(s.id);
              setExported(false);
              setExportResult(null);
            }}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm border transition cursor-pointer",
              selectedScheduleId === s.id
                ? "bg-accent/15 border-accent/40 text-accent-light font-medium"
                : "bg-card border-card-border text-muted"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeCommute}
            onChange={(e) => setIncludeCommute(e.target.checked)}
            className="rounded"
          />
          Include commute blocks
        </label>
      </div>

      {/* Events preview */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-card-border">
          <h3 className="text-sm font-medium">
            Calendar Preview ({events.length} events)
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {classEvents.length} class events
            {commuteEvents.length > 0 && ` + ${commuteEvents.length} commute blocks`}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Loading preview...
          </div>
        ) : (
          <div className="divide-y divide-card-border/50 max-h-96 overflow-auto">
            {events.map((ev, i) => (
              <div
                key={i}
                className={clsx(
                  "px-4 py-3 flex items-start gap-3",
                  ev.is_commute_block && "bg-warning/5"
                )}
              >
                <div
                  className={clsx(
                    "w-1 h-full min-h-[40px] rounded-full flex-shrink-0",
                    ev.is_commute_block ? "bg-warning/50" : "bg-accent/50"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{ev.summary}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(ev.start_datetime)} -{" "}
                      {formatTime(ev.end_datetime)}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {ev.location}
                      </span>
                    )}
                    {ev.is_commute_block && (
                      <span className="flex items-center gap-1 text-warning">
                        <Car className="w-3 h-3" />
                        Commute buffer
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="bg-card border border-card-border rounded-xl p-4">
        {authStatus?.mock_mode && (
          <div className="flex items-start gap-2 mb-3 text-xs text-warning">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Google Calendar OAuth not configured. Export will use mock mode
              (events won&apos;t actually be created in Google Calendar).
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              Export to Google Calendar
            </div>
            <div className="text-xs text-muted mt-0.5">
              {selectedSchedule?.name} &middot;{" "}
              {selectedSchedule?.semester} &middot; {events.length} events
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || exported}
            className={clsx(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer",
              exported
                ? "bg-success/20 text-success border border-success/30"
                : exporting
                ? "bg-muted/20 text-muted cursor-wait"
                : "bg-maroon text-white hover:bg-maroon/90"
            )}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : exported ? (
              <Check className="w-4 h-4" />
            ) : (
              <CalendarDays className="w-4 h-4" />
            )}
            {exporting
              ? "Exporting..."
              : exported
              ? "Exported!"
              : "Export Now"}
          </button>
        </div>

        {exportResult && (
          <div
            className={clsx(
              "mt-3 p-3 rounded-lg text-xs",
              exportResult.success
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            )}
          >
            {exportResult.message}
            {exportResult.success && exportResult.calendar_url && (
              <a
                href={exportResult.calendar_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 mt-1 underline"
              >
                Open Google Calendar
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(dt: string): string {
  // dt format: "2026-08-20T09:00:00"
  const match = dt.match(/T(\d{2}:\d{2})/);
  if (!match) return dt;
  const [h, m] = match[1].split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}
