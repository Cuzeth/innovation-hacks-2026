// Mirrors backend Pydantic models

export interface CompletedCourse {
  course_id: string;
  title: string;
  credits: number;
  grade: string;
  semester: string;
  source: "asu" | "ap" | "transfer" | "test";
  transfer_institution: string;
}

export interface StudentPreferences {
  max_credits_per_semester: number;
  min_credits_per_semester: number;
  preferred_start_time: string;
  preferred_end_time: string;
  avoid_days: string[];
  schedule_style: "compact" | "spread" | "any";
  modality: "in_person" | "online" | "hybrid" | "any";
  include_summer: boolean;
  target_graduation: string;
  home_address: string;
  campus: string;
  min_professor_rating: number;
  part_time: boolean;
  internship_semesters: string[];
}

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  university: string;
  major: string;
  major_code: string;
  catalog_year: string;
  current_semester: string;
  completed_courses: CompletedCourse[];
  preferences: StudentPreferences;
  total_credits_completed: number;
}

export interface CourseOption {
  course_id: string;
  title: string;
  credits: number;
}

export interface Requirement {
  id: string;
  name: string;
  category: string;
  description: string;
  credits_required: number;
  courses_required: CourseOption[];
  pick_n: number;
  pick_from: CourseOption[];
  status: "fulfilled" | "partially_fulfilled" | "unmet";
  credits_applied: number;
  courses_applied: string[];
  notes: string;
}

export interface RequirementCategory {
  name: string;
  display_name: string;
  credits_required: number;
  credits_fulfilled: number;
  requirements: Requirement[];
}

export interface AuditExplanation {
  requirement_id: string;
  requirement_name: string;
  status: string;
  reasoning: string;
  confidence: string;
  source_used: string;
  needs_advisor_review: boolean;
}

export interface DegreeAudit {
  student_id: string;
  total_credits_completed: number;
  total_credits_remaining: number;
  overall_progress_pct: number;
  categories: RequirementCategory[];
  fulfilled_count: number;
  partial_count: number;
  unmet_count: number;
  explanations: AuditExplanation[];
  degree_requirements: {
    university: string;
    major: string;
    degree: string;
    total_credits_required: number;
    minimum_gpa: number;
    data_source: string;
    data_source_url: string;
    notes: string[];
  };
}

export interface PlannedCourse {
  course_id: string;
  title: string;
  credits: number;
  is_prerequisite_for: string[];
  is_bottleneck: boolean;
  placement_reason: string;
}

export interface SemesterPlan {
  semester: string;
  courses: PlannedCourse[];
  total_credits: number;
  notes: string;
}

export interface Bottleneck {
  course_id: string;
  title: string;
  blocks: string[];
  depth: number;
  explanation: string;
}

export interface RiskFactor {
  description: string;
  level: "low" | "medium" | "high";
  mitigation: string;
}

export interface APCreditImpact {
  credits_saved: number;
  courses_skipped: string[];
  semesters_saved: number;
  explanation: string;
}

export interface GraduationPath {
  id: string;
  name: string;
  semesters: SemesterPlan[];
  total_semesters: number;
  graduation_term: string;
  total_credits: number;
  risk_factors: RiskFactor[];
  bottlenecks: Bottleneck[];
  ap_credit_impact: APCreditImpact | null;
  explanation: string;
  tradeoffs: string;
}

export interface AcademicPlan {
  student_id: string;
  recommended_path: GraduationPath;
  alternative_paths: GraduationPath[];
  bottlenecks: Bottleneck[];
  ap_credit_impact: APCreditImpact | null;
  risk_summary: string;
  explanation: string;
}

export interface WhatIfCandidate {
  course_id: string;
  title: string;
  source: "in_progress" | "upcoming";
  semester: string;
  reason: string;
}

export interface RecoveryAction {
  title: string;
  detail: string;
  urgency: "low" | "medium" | "high";
}

export interface WhatIfAnalysis {
  question: string;
  scenario_type: string;
  target_course_id: string;
  target_course_title: string;
  target_context: "in_progress" | "upcoming";
  baseline_graduation_term: string;
  scenario_graduation_term: string;
  delay_semesters: number;
  impacted_courses: string[];
  blocked_courses: string[];
  recovery_actions: RecoveryAction[];
  revised_path: GraduationPath;
  explanation: string;
  confidence: string;
}

export interface MeetingTime {
  days: string[];
  start_time: string;
  end_time: string;
  location: string;
  building: string;
  campus: string;
}

export interface Section {
  section_id: string;
  course_id: string;
  title: string;
  credits: number;
  instructor: string;
  instructor_rating: number | null;
  instructor_rating_source: string;
  modality: string;
  meeting_times: MeetingTime[];
  seats_total: number;
  seats_available: number;
  semester: string;
  notes: string;
}

export interface SectionWithScore {
  section: Section;
  score: number;
  time_score: number;
  day_score: number;
  modality_score: number;
  compactness_score: number;
  instructor_score: number;
  commute_minutes: number | null;
  explanation: string;
}

export interface ScheduleEntry {
  section: SectionWithScore;
  commute_before_minutes: number;
  commute_after_minutes: number;
}

export interface TravelWarning {
  day: string;
  from_course_id: string;
  to_course_id: string;
  gap_minutes: number;
  required_minutes: number;
  message: string;
}

export interface ScheduleScoreBreakdown {
  section_average: number;
  compactness: number;
  travel_feasibility: number;
  professor_quality: number;
  preference_alignment: number;
}

export interface ProposedSchedule {
  id: string;
  name: string;
  semester: string;
  entries: ScheduleEntry[];
  total_credits: number;
  overall_score: number;
  weekly_commute_minutes: number;
  score_breakdown: ScheduleScoreBreakdown;
  travel_warnings: TravelWarning[];
  explanation: string;
  tradeoffs: string;
}

export interface CalendarEvent {
  summary: string;
  description: string;
  location: string;
  start_datetime: string;
  end_datetime: string;
  recurrence: string[];
  color_id: string;
  is_commute_block: boolean;
}

export interface AgentStep {
  agent: string;
  action: string;
  status: string;
  detail: string;
}

export interface FullAuditResult {
  audit: DegreeAudit;
  plan: AcademicPlan;
  schedules: ProposedSchedule[];
  agent_log: AgentStep[];
}
