/**
 * Compute remaining courses by diffing degree requirements against completed courses.
 * This is a programmatic step — no AI needed.
 */
export function computeRemainingCourses(degreeRequirements, completedCourses) {
  const completedSet = new Set(completedCourses.map((c) => c.toUpperCase().replace(/\s+/g, "")));

  const normalize = (id) => id.toUpperCase().replace(/\s+/g, "");

  const remaining = [];

  // Check core requirements
  if (degreeRequirements.coreRequirements) {
    for (const course of degreeRequirements.coreRequirements) {
      if (!completedSet.has(normalize(course.courseId))) {
        const prereqsMet = (course.prereqs || []).every((p) => completedSet.has(normalize(p)));
        remaining.push({ ...course, prereqsMet, type: "core" });
      }
    }
  }

  // Check elective groups
  if (degreeRequirements.electiveGroups) {
    for (const group of degreeRequirements.electiveGroups) {
      const completedInGroup = (group.options || []).filter((c) =>
        completedSet.has(normalize(c.courseId))
      ).length;
      const stillNeeded = (group.requiredCount || 1) - completedInGroup;

      if (stillNeeded > 0) {
        const availableOptions = (group.options || [])
          .filter((c) => !completedSet.has(normalize(c.courseId)))
          .map((c) => {
            const prereqsMet = (c.prereqs || []).every((p) => completedSet.has(normalize(p)));
            return { ...c, prereqsMet, type: "elective", group: group.name };
          });

        // Add the number we still need (or all available if fewer)
        remaining.push(...availableOptions.slice(0, Math.max(stillNeeded + 2, availableOptions.length)));
      }
    }
  }

  return remaining;
}

/**
 * Batch courses into groups for research (3-5 per batch to respect rate limits).
 */
export function batchCourses(courses, batchSize = 4) {
  const batches = [];
  for (let i = 0; i < courses.length; i += batchSize) {
    batches.push(courses.slice(i, i + batchSize));
  }
  return batches;
}
