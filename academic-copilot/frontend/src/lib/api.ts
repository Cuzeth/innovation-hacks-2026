const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => fetchAPI<{ status: string }>("/api/health"),

  // Student
  getProfile: () =>
    fetchAPI<import("./types").StudentProfile & { not_setup?: boolean }>(
      "/api/student/profile"
    ),
  updateProfile: (profile: import("./types").StudentProfile) =>
    fetchAPI<import("./types").StudentProfile>("/api/student/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    }),
  updatePreferences: (prefs: import("./types").StudentPreferences) =>
    fetchAPI<import("./types").StudentProfile>("/api/student/preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    }),
  resetProfile: () =>
    fetchAPI<{ ok: boolean }>("/api/student/profile/reset", { method: "POST" }),
  loadDemo: () =>
    fetchAPI<import("./types").StudentProfile>("/api/student/profile/load-demo", {
      method: "POST",
    }),
  listMajors: () =>
    fetchAPI<{ code: string; name: string; degree: string; college: string }[]>(
      "/api/student/majors"
    ),
  listCourses: () =>
    fetchAPI<{ course_id: string; title: string; credits: number }[]>(
      "/api/student/courses/catalog"
    ),
  listAPExams: () =>
    fetchAPI<{ exam: string; asu_equivalent: string; credits: number }[]>(
      "/api/student/ap-exams"
    ),
  uploadTranscript: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/student/transcript/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed: ${text}`);
    }
    return res.json() as Promise<{
      courses: import("./types").CompletedCourse[];
    }>;
  },

  // Audit (triggers full workflow)
  runAudit: () =>
    fetchAPI<import("./types").FullAuditResult>("/api/audit/run", { method: "POST" }),
  getAuditResult: () => fetchAPI<import("./types").DegreeAudit>("/api/audit/result"),
  getAuditExplanation: () =>
    fetchAPI<{ explanation: string }>("/api/audit/explain"),
  getAgentLog: () =>
    fetchAPI<{ log: import("./types").AgentStep[] }>("/api/audit/agent-log"),

  // Plan
  getPlan: () => fetchAPI<import("./types").AcademicPlan>("/api/plan/result"),
  getBottlenecks: () =>
    fetchAPI<{
      bottlenecks: import("./types").Bottleneck[];
      ap_credit_impact: import("./types").APCreditImpact | null;
      risk_summary: string;
    }>("/api/plan/bottlenecks"),
  getPaths: () =>
    fetchAPI<{ paths: import("./types").GraduationPath[] }>("/api/plan/paths"),
  getWhatIfOptions: () =>
    fetchAPI<{ options: import("./types").WhatIfCandidate[] }>(
      "/api/plan/what-if/options"
    ),
  analyzeWhatIf: (payload: { question?: string; target_course_id?: string }) =>
    fetchAPI<import("./types").WhatIfAnalysis>("/api/plan/what-if", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Schedule
  getSchedules: () =>
    fetchAPI<{
      schedules: import("./types").ProposedSchedule[];
      semester: string;
    }>("/api/schedule/recommendations"),
  selectSchedule: (id: string) =>
    fetchAPI<{ message: string }>(`/api/schedule/${id}/select`, { method: "POST" }),

  // Calendar
  previewCalendar: (scheduleId: string, includeCommute: boolean = true) =>
    fetchAPI<{ events: import("./types").CalendarEvent[]; count: number }>(
      "/api/calendar/preview",
      {
        method: "POST",
        body: JSON.stringify({
          schedule_id: scheduleId,
          include_commute: includeCommute,
        }),
      }
    ),
  exportCalendar: (scheduleId: string, includeCommute: boolean = true) =>
    fetchAPI<{
      success: boolean;
      events_created: number;
      calendar_url: string;
      message: string;
    }>("/api/calendar/export", {
      method: "POST",
      body: JSON.stringify({
        schedule_id: scheduleId,
        include_commute: includeCommute,
      }),
    }),

  // Auth
  getAuthStatus: () =>
    fetchAPI<{ configured: boolean; authenticated: boolean; mock_mode: boolean }>(
      "/api/auth/google/status"
    ),
  getAuthUrl: () =>
    fetchAPI<{ auth_url?: string; error?: string }>("/api/auth/google/login"),
};
