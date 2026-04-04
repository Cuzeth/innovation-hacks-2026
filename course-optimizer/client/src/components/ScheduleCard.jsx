import React, { useState } from "react";

const workloadColorMap = {
  light: { bg: "bg-emerald-900/30", border: "border-emerald-700/50", text: "text-emerald-400" },
  moderate: { bg: "bg-yellow-900/30", border: "border-yellow-700/50", text: "text-yellow-400" },
  heavy: { bg: "bg-orange-900/30", border: "border-orange-700/50", text: "text-orange-400" },
  brutal: { bg: "bg-red-900/30", border: "border-red-700/50", text: "text-red-400" },
};

function getWorkloadStyle(level) {
  return workloadColorMap[level] || { bg: "bg-gray-800", border: "border-gray-600", text: "text-gray-400" };
}

function SemesterBlock({ semester }) {
  const style = getWorkloadStyle(semester.workloadRating);

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-100">{semester.term}</h4>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${style.text}`}>
            {semester.workloadRating}
          </span>
          <span className="text-xs text-gray-500">
            {semester.totalCredits} credits
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {semester.courses.map((course, i) => {
          const cStyle = getWorkloadStyle(course.workload);
          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${cStyle.bg} border ${cStyle.border}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-400 font-semibold">
                    {course.courseId}
                  </span>
                  {course.title && (
                    <span className="text-xs text-gray-400 truncate">{course.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {course.professor && <span>{course.professor}</span>}
                  {course.section && <span className="font-mono">{course.section}</span>}
                  {course.modality && <span>({course.modality})</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {course.rating && (
                  <span className="text-yellow-400 text-xs">★ {course.rating}</span>
                )}
                <span className="text-xs text-gray-600">{course.credits || 3}cr</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScheduleCard({ option, index }) {
  const [expanded, setExpanded] = useState(true);

  const labelColors = [
    "from-indigo-500 to-purple-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
  ];

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div
        className="px-5 py-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-2 h-8 rounded-full bg-gradient-to-b ${labelColors[index % 3]}`}
            />
            <div>
              <h3 className="font-semibold text-gray-100">{option.label}</h3>
              <p className="text-sm text-gray-400 mt-0.5">{option.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {option.totalSemesters && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
                {option.totalSemesters} semesters
              </span>
            )}
            <span className="text-gray-500">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Semesters */}
          {option.semesters?.map((semester, i) => (
            <SemesterBlock key={i} semester={semester} />
          ))}

          {/* Tradeoffs */}
          {option.tradeoffs && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Tradeoffs</h4>
              <p className="text-sm text-gray-300">{option.tradeoffs}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
