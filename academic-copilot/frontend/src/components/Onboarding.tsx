"use client";

import { useState, useEffect } from "react";
import {
  User,
  BookOpen,
  Settings,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  GraduationCap,
  Award,
  Check,
  Search,
  Loader2,
  FileUp,
  FileCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import type { CompletedCourse, StudentPreferences } from "@/lib/types";
import clsx from "clsx";

interface Props {
  onComplete: () => void;
}

const STEPS = [
  { label: "Your Info", icon: User },
  { label: "Courses", icon: BookOpen },
  { label: "Preferences", icon: Settings },
];

const CURRENT_SEMESTERS = [
  "Fall 2026", "Spring 2027", "Fall 2027", "Spring 2028",
];

const PAST_SEMESTERS = [
  "Fall 2022", "Spring 2023", "Summer 2023",
  "Fall 2023", "Spring 2024", "Summer 2024",
  "Fall 2024", "Spring 2025", "Summer 2025",
  "Fall 2025", "Spring 2026", "Summer 2026",
  "Fall 2026",
];

const GRAD_TARGETS = [
  "Spring 2027", "Fall 2027", "Spring 2028", "Fall 2028",
  "Spring 2029", "Fall 2029", "Spring 2030",
];

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Basic info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [majorCode, setMajorCode] = useState("");
  const [majorName, setMajorName] = useState("");
  const [catalogYear] = useState("2024-2025");
  const [majors, setMajors] = useState<
    { code: string; name: string; degree: string; college: string }[]
  >([]);
  const [majorSearch, setMajorSearch] = useState("");
  const [currentSemester, setCurrentSemester] = useState("Fall 2026");

  // Step 2: Courses
  const [courses, setCourses] = useState<CompletedCourse[]>([]);
  const [courseCatalog, setCourseCatalog] = useState<
    { course_id: string; title: string; credits: number }[]
  >([]);
  const [apExams, setApExams] = useState<
    { exam: string; asu_equivalent: string; credits: number }[]
  >([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showAddAP, setShowAddAP] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

  // Step 3: Preferences
  const [prefs, setPrefs] = useState<StudentPreferences>({
    max_credits_per_semester: 16,
    min_credits_per_semester: 12,
    preferred_start_time: "09:00",
    preferred_end_time: "17:00",
    avoid_days: [],
    schedule_style: "compact",
    modality: "any",
    include_summer: false,
    target_graduation: "Spring 2028",
    home_address: "",
    campus: "Tempe",
    min_professor_rating: 3.5,
    part_time: false,
    internship_semesters: [],
  });

  useEffect(() => {
    api.listCourses().then(setCourseCatalog).catch(() => {});
    api.listAPExams().then(setApExams).catch(() => {});
    api.listMajors().then(setMajors).catch(() => {});
  }, []);

  const handleTranscriptUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    setUploadedCount(0);
    try {
      const result = await api.uploadTranscript(file);
      const newCourses = result.courses.filter(
        (nc) => !courses.some((c) => c.course_id === nc.course_id)
      );
      setCourses((prev) => [...prev, ...newCourses.map((c) => ({
        course_id: c.course_id,
        title: c.title || "",
        credits: c.credits || 3,
        grade: c.grade || "",
        semester: c.semester || "",
        source: "asu" as const,
        transfer_institution: "",
      }))]);
      setUploadedCount(newCourses.length);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Failed to parse transcript");
    }
    setUploading(false);
  };

  const addCourse = (courseId: string, title: string, credits: number) => {
    if (courses.some((c) => c.course_id === courseId)) return;
    setCourses((prev) => [
      ...prev,
      {
        course_id: courseId,
        title,
        credits,
        grade: "",
        semester: "",
        source: "asu",
        transfer_institution: "",
      },
    ]);
    setCourseSearch("");
    setShowAddCourse(false);
  };

  const addAPCredit = (exam: string, equivalent: string, credits: number) => {
    const equivalents = equivalent.includes("+")
      ? equivalent.split("+")
      : [equivalent];
    for (const eq of equivalents) {
      if (courses.some((c) => c.course_id === eq.trim())) continue;
      const catalogMatch = courseCatalog.find((c) => c.course_id === eq.trim());
      setCourses((prev) => [
        ...prev,
        {
          course_id: eq.trim(),
          title: catalogMatch?.title || eq.trim(),
          credits: catalogMatch?.credits || Math.floor(credits / equivalents.length),
          grade: "",
          semester: "",
          source: "ap" as const,
          transfer_institution: exam,
        },
      ]);
    }
    setShowAddAP(false);
  };

  const removeCourse = (courseId: string) => {
    setCourses((prev) => prev.filter((c) => c.course_id !== courseId));
  };

  const updateCourseField = (
    courseId: string,
    field: keyof CompletedCourse,
    value: string
  ) => {
    setCourses((prev) =>
      prev.map((c) => (c.course_id === courseId ? { ...c, [field]: value } : c))
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        id: "demo-student",
        name,
        email,
        university: "Arizona State University",
        major: majorName || "Computer Science",
        major_code: majorCode,
        catalog_year: catalogYear,
        current_semester: currentSemester,
        completed_courses: courses,
        preferences: prefs,
        total_credits_completed: 0,
      });
      onComplete();
    } catch (e) {
      console.error("Failed to save profile:", e);
    }
    setSaving(false);
  };

  const filteredCatalog = courseCatalog.filter(
    (c) =>
      !courses.some((cc) => cc.course_id === c.course_id) &&
      (c.course_id.toLowerCase().includes(courseSearch.toLowerCase()) ||
        c.title.toLowerCase().includes(courseSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <GraduationCap className="w-10 h-10 text-gold mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
          <p className="text-sm text-muted mt-1">
            Tell us about yourself so we can plan your path to graduation.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => i < step && setStep(i)}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition",
                i === step
                  ? "bg-accent/20 text-accent-light font-medium border border-accent/30"
                  : i < step
                  ? "text-success cursor-pointer"
                  : "text-muted"
              )}
            >
              {i < step ? (
                <Check className="w-4 h-4" />
              ) : (
                <s.icon className="w-4 h-4" />
              )}
              {s.label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-card border border-card-border rounded-xl p-6 animate-fade-in">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Basic Information</h2>

              <div>
                <label className="block text-sm text-muted mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@asu.edu"
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">Major</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted" />
                  <input
                    type="text"
                    value={majorCode ? `${majorName} (${majorCode})` : majorSearch}
                    onChange={(e) => {
                      setMajorSearch(e.target.value);
                      setMajorCode("");
                      setMajorName("");
                    }}
                    onFocus={() => {
                      if (majorCode) {
                        setMajorSearch(majorName);
                        setMajorCode("");
                        setMajorName("");
                      }
                    }}
                    placeholder="Search majors... (e.g. Computer Science, Biology)"
                    className="w-full pl-8 pr-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                {!majorCode && majorSearch.length >= 2 && (
                  <div className="mt-1 bg-background border border-card-border rounded-lg max-h-48 overflow-auto">
                    {majors
                      .filter(
                        (m) =>
                          m.name.toLowerCase().includes(majorSearch.toLowerCase()) ||
                          m.code.toLowerCase().includes(majorSearch.toLowerCase()) ||
                          m.college.toLowerCase().includes(majorSearch.toLowerCase())
                      )
                      .slice(0, 15)
                      .map((m) => (
                        <button
                          key={m.code}
                          onClick={() => {
                            setMajorCode(m.code);
                            setMajorName(m.name);
                            setMajorSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-card text-sm cursor-pointer border-b border-card-border/30 last:border-0"
                        >
                          <div className="font-medium">
                            {m.name}
                            <span className="text-muted font-normal ml-1">
                              ({m.degree})
                            </span>
                          </div>
                          <div className="text-xs text-muted">{m.college}</div>
                        </button>
                      ))}
                    {majors.filter(
                      (m) =>
                        m.name.toLowerCase().includes(majorSearch.toLowerCase()) ||
                        m.code.toLowerCase().includes(majorSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted">
                        No majors found for &quot;{majorSearch}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">
                  Current Semester
                </label>
                <select
                  value={currentSemester}
                  onChange={(e) => setCurrentSemester(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
                >
                  {CURRENT_SEMESTERS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Your Courses</h2>

              {/* Transcript upload */}
              <div
                className={clsx(
                  "relative border-2 border-dashed rounded-xl p-5 text-center transition",
                  uploading
                    ? "border-accent/50 bg-accent/5"
                    : uploadedCount > 0
                    ? "border-success/50 bg-success/5"
                    : "border-card-border hover:border-accent/40 hover:bg-accent/5"
                )}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 text-accent animate-spin" />
                    <p className="text-sm text-accent-light font-medium">
                      Parsing transcript with AI...
                    </p>
                    <p className="text-xs text-muted">
                      This may take a few seconds
                    </p>
                  </div>
                ) : uploadedCount > 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileCheck className="w-6 h-6 text-success" />
                    <p className="text-sm text-success font-medium">
                      Extracted {uploadedCount} courses from transcript
                    </p>
                    <label className="text-xs text-muted underline cursor-pointer">
                      Upload a different transcript
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleTranscriptUpload(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 cursor-pointer">
                    <FileUp className="w-6 h-6 text-muted" />
                    <p className="text-sm font-medium">
                      Upload your unofficial transcript
                    </p>
                    <p className="text-xs text-muted">
                      PDF only — AI will extract your courses automatically
                    </p>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleTranscriptUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              {uploadError && (
                <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2">
                  {uploadError}
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-card-border" />
                <span className="text-xs text-muted">or add manually</span>
                <div className="flex-1 h-px bg-card-border" />
              </div>

              {/* Manual add buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddAP(true);
                    setShowAddCourse(false);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gold/20 text-gold border border-gold/30 rounded-lg cursor-pointer hover:bg-gold/30"
                >
                  <Award className="w-3 h-3" />
                  Add AP Credit
                </button>
                <button
                  onClick={() => {
                    setShowAddCourse(true);
                    setShowAddAP(false);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-accent/20 text-accent-light border border-accent/30 rounded-lg cursor-pointer hover:bg-accent/30"
                >
                  <Plus className="w-3 h-3" />
                  Add Course
                </button>
              </div>

              {/* AP credit picker */}
              {showAddAP && (
                <div className="bg-background border border-card-border rounded-lg p-3 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-gold" />
                      Add AP Credit
                    </h3>
                    <button
                      onClick={() => setShowAddAP(false)}
                      className="text-muted hover:text-foreground cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-auto">
                    {apExams.map((ap) => (
                      <button
                        key={ap.exam}
                        onClick={() =>
                          addAPCredit(ap.exam, ap.asu_equivalent, ap.credits)
                        }
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-card text-sm flex items-center justify-between cursor-pointer"
                      >
                        <span>{ap.exam}</span>
                        <span className="text-xs text-muted">
                          → {ap.asu_equivalent} ({ap.credits} cr)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Course picker */}
              {showAddCourse && (
                <div className="bg-background border border-card-border rounded-lg p-3 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Add ASU Course</h3>
                    <button
                      onClick={() => setShowAddCourse(false)}
                      className="text-muted hover:text-foreground cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted" />
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder="Search courses..."
                      className="w-full pl-8 pr-3 py-2 bg-card border border-card-border rounded-lg text-sm focus:outline-none focus:border-accent"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-0.5 max-h-48 overflow-auto">
                    {filteredCatalog.slice(0, 20).map((c) => (
                      <button
                        key={c.course_id}
                        onClick={() =>
                          addCourse(c.course_id, c.title, c.credits)
                        }
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-card text-sm flex items-center justify-between cursor-pointer"
                      >
                        <span>
                          <span className="font-mono font-medium">
                            {c.course_id}
                          </span>{" "}
                          <span className="text-muted">{c.title}</span>
                        </span>
                        <span className="text-xs text-muted">{c.credits} cr</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Course list */}
              {courses.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">
                  No courses added yet. Add your completed ASU courses and AP
                  credits above.
                </div>
              ) : (
                <div className="space-y-2">
                  {courses.map((c) => (
                    <div
                      key={c.course_id}
                      className="flex items-center gap-2 bg-background border border-card-border rounded-lg px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {c.course_id}
                          </span>
                          {c.source === "ap" && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gold/20 text-gold rounded-full">
                              AP
                            </span>
                          )}
                          <span className="text-xs text-muted truncate">
                            {c.title}
                          </span>
                        </div>
                        {c.source === "asu" && (
                          <div className="flex gap-2 mt-1">
                            <select
                              value={c.semester}
                              onChange={(e) =>
                                updateCourseField(
                                  c.course_id,
                                  "semester",
                                  e.target.value
                                )
                              }
                              className="text-xs bg-card border border-card-border rounded px-1.5 py-0.5"
                            >
                              <option value="">Semester</option>
                              {PAST_SEMESTERS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <select
                              value={c.grade}
                              onChange={(e) =>
                                updateCourseField(
                                  c.course_id,
                                  "grade",
                                  e.target.value
                                )
                              }
                              className="text-xs bg-card border border-card-border rounded px-1.5 py-0.5"
                            >
                              <option value="">Grade</option>
                              {["A+","A","A-","B+","B","B-","C+","C","C-","D","E","W"].map(
                                (g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        )}
                        {c.source === "ap" && (
                          <div className="text-[10px] text-muted mt-0.5">
                            {c.transfer_institution}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeCourse(c.course_id)}
                        className="text-muted hover:text-danger cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="text-xs text-muted text-right">
                    {courses.length} course(s) &middot;{" "}
                    {courses.reduce((s, c) => s + c.credits, 0)} credits
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Your Preferences</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">
                    Target Graduation
                  </label>
                  <select
                    value={prefs.target_graduation}
                    onChange={(e) =>
                      setPrefs({ ...prefs, target_graduation: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                  >
                    {GRAD_TARGETS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-muted mb-1">
                    Max Credits / Semester
                  </label>
                  <input
                    type="number"
                    value={prefs.max_credits_per_semester}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        max_credits_per_semester: Number(e.target.value),
                      })
                    }
                    min={9}
                    max={21}
                    className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted mb-1">
                    Earliest Class
                  </label>
                  <select
                    value={prefs.preferred_start_time}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        preferred_start_time: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                  >
                    {["07:00","08:00","09:00","10:00","11:00","12:00"].map((t) => (
                      <option key={t} value={t}>
                        {formatTime(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-muted mb-1">
                    Latest Class End
                  </label>
                  <select
                    value={prefs.preferred_end_time}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        preferred_end_time: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                  >
                    {["15:00","16:00","17:00","18:00","19:00","20:00","21:00"].map((t) => (
                      <option key={t} value={t}>
                        {formatTime(t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">
                  Avoid Days
                </label>
                <div className="flex gap-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(
                    (day) => (
                      <button
                        key={day}
                        onClick={() =>
                          setPrefs({
                            ...prefs,
                            avoid_days: prefs.avoid_days.includes(day)
                              ? prefs.avoid_days.filter((d) => d !== day)
                              : [...prefs.avoid_days, day],
                          })
                        }
                        className={clsx(
                          "px-3 py-1.5 text-xs rounded-lg border transition cursor-pointer",
                          prefs.avoid_days.includes(day)
                            ? "bg-danger/20 border-danger/30 text-danger"
                            : "bg-background border-card-border text-muted hover:text-foreground"
                        )}
                      >
                        {day.slice(0, 3)}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted mb-1">
                    Schedule Style
                  </label>
                  <select
                    value={prefs.schedule_style}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        schedule_style: e.target.value as "compact" | "spread" | "any",
                      })
                    }
                    className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                  >
                    <option value="compact">Compact (minimal gaps)</option>
                    <option value="spread">Spread out</option>
                    <option value="any">No preference</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-muted mb-1">
                    Class Modality
                  </label>
                  <select
                    value={prefs.modality}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        modality: e.target.value as "in_person" | "online" | "hybrid" | "any",
                      })
                    }
                    className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                  >
                    <option value="any">No preference</option>
                    <option value="in_person">In-person</option>
                    <option value="online">Online</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">
                  Min Professor Rating (0-5)
                </label>
                <input
                  type="number"
                  value={prefs.min_professor_rating}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      min_professor_rating: Number(e.target.value),
                    })
                  }
                  min={0}
                  max={5}
                  step={0.5}
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">
                  Home Address (for commute estimates, optional)
                </label>
                <input
                  type="text"
                  value={prefs.home_address}
                  onChange={(e) =>
                    setPrefs({ ...prefs, home_address: e.target.value })
                  }
                  placeholder="e.g. 1000 S Mill Ave, Tempe, AZ"
                  className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm"
                />
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.include_summer}
                  onChange={(e) =>
                    setPrefs({ ...prefs, include_summer: e.target.checked })
                  }
                  className="rounded"
                />
                Include summer semesters in plan
              </label>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition cursor-pointer",
              step === 0
                ? "text-muted/30 cursor-not-allowed"
                : "text-muted hover:text-foreground"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && (!name.trim() || !majorCode)}
              className={clsx(
                "flex items-center gap-1.5 px-6 py-2 rounded-lg text-sm font-medium transition cursor-pointer",
                step === 0 && (!name.trim() || !majorCode)
                  ? "bg-muted/20 text-muted/50 cursor-not-allowed"
                  : "bg-accent text-white hover:bg-accent/90"
              )}
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-1.5 px-6 py-2 bg-maroon text-white rounded-lg text-sm font-medium hover:bg-maroon/90 transition cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Finish Setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(t: string): string {
  const [h] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:00 ${ampm}`;
}
