import React, { useState } from "react";

const workloadColors = {
  light: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  moderate: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  heavy: "bg-orange-900/50 text-orange-300 border-orange-700",
  brutal: "bg-red-900/50 text-red-300 border-red-700",
  unknown: "bg-gray-800 text-gray-400 border-gray-600",
};

function WorkloadBadge({ level }) {
  const colorClass = workloadColors[level] || workloadColors.unknown;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {level}
    </span>
  );
}

function StarRating({ rating }) {
  const stars = Math.round(rating * 2) / 2; // round to nearest 0.5
  return (
    <span className="text-yellow-400 text-sm">
      {"★".repeat(Math.floor(stars))}
      {stars % 1 !== 0 && "½"}
      <span className="text-gray-600">{"★".repeat(5 - Math.ceil(stars))}</span>
      <span className="text-gray-400 ml-1 text-xs">{rating}/5</span>
    </span>
  );
}

export default function CourseProfile({ course }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 animate-fade-in">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-indigo-400 font-mono text-sm font-semibold">{course.courseId}</span>
          <span className="text-gray-200 text-sm">{course.title}</span>
          <WorkloadBadge level={course.workloadEstimate || course.workload || "unknown"} />
        </div>
        <span className="text-gray-500 text-sm">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
          {/* Workload info */}
          <div className="text-sm text-gray-400">
            <span className="text-gray-300 font-medium">Est. hours/week:</span>{" "}
            {course.hoursPerWeek || "N/A"}
          </div>
          {course.workloadReasoning && (
            <p className="text-xs text-gray-500 italic">{course.workloadReasoning}</p>
          )}

          {/* Professors */}
          {course.professors?.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Professors</h4>
              <div className="space-y-2">
                {course.professors.map((prof, i) => (
                  <div key={i} className="bg-gray-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-200">{prof.name}</span>
                      {prof.rating && <StarRating rating={prof.rating} />}
                    </div>
                    {prof.summary && (
                      <p className="text-xs text-gray-400 mt-1">{prof.summary}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      {prof.difficulty && <span>Difficulty: {prof.difficulty}/5</span>}
                      {prof.wouldTakeAgain && <span>Would retake: {prof.wouldTakeAgain}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          {course.sections?.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Available Sections</h4>
              <div className="space-y-1">
                {course.sections.map((sec, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="text-gray-300 font-mono">{sec.time}</span>
                    <span>{sec.professor}</span>
                    <span className="text-gray-600">({sec.modality})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {course.tips && (
            <p className="text-xs text-indigo-400/80 italic mt-2">Tip: {course.tips}</p>
          )}
        </div>
      )}
    </div>
  );
}
