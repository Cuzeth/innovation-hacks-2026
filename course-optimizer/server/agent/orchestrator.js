import { chat, generate } from "./gemini.js";
import {
  INTAKE_SYSTEM_PROMPT,
  RESEARCH_DEGREE_PROMPT,
  RESEARCH_COURSES_PROMPT,
  OPTIMIZE_PROMPT,
  REFINE_PROMPT,
} from "./prompts.js";
import { computeRemainingCourses, batchCourses } from "./tools.js";
import { getSession, updateSession, addMessage, getConversationForGemini } from "../session/store.js";

/**
 * Parse JSON from Gemini response, handling markdown code fences.
 */
function parseJSON(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

/**
 * Handle a user message — route to the correct phase handler.
 * @param {string} sessionId
 * @param {string} userMessage
 * @param {function} onEvent - SSE callback: (event, data) => void
 */
export async function handleMessage(sessionId, userMessage, onEvent) {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found");

  // Store user message
  addMessage(sessionId, "user", userMessage);

  switch (session.phase) {
    case "intake":
      await handleIntake(session, userMessage, onEvent);
      break;
    case "research":
      // If user sends a message during research, queue it
      onEvent("message", {
        role: "assistant",
        content: "I'm still researching your courses — hang tight! I'll let you know when I'm done.",
      });
      break;
    case "optimize":
      onEvent("message", {
        role: "assistant",
        content: "I'm building your schedule options now — almost there!",
      });
      break;
    case "refine":
      await handleRefine(session, userMessage, onEvent);
      break;
    default:
      onEvent("message", { role: "assistant", content: "Something went wrong. Let's start over." });
  }
}

/**
 * Phase 1: Intake — conversational info gathering.
 */
async function handleIntake(session, userMessage, onEvent) {
  const history = getConversationForGemini(session.id);

  let responseText;
  try {
    responseText = await chat({
      systemPrompt: INTAKE_SYSTEM_PROMPT,
      history: history.slice(0, -1), // exclude the message we just added (it's the current one)
      message: userMessage,
      useSearch: false,
    });
  } catch (err) {
    console.error("Gemini intake error:", err);
    onEvent("message", {
      role: "assistant",
      content: "I had trouble processing that. Could you try rephrasing?",
    });
    return;
  }

  let parsed;
  try {
    parsed = parseJSON(responseText);
  } catch {
    // If Gemini didn't return valid JSON, treat the whole response as a message
    console.warn("Intake response was not JSON, using as plain message");
    addMessage(session.id, "model", responseText);
    onEvent("message", { role: "assistant", content: responseText });
    return;
  }

  // Update session with any extracted data
  if (parsed.extracted) {
    const ext = parsed.extracted;
    const updates = {};
    if (ext.school) updates.school = ext.school;
    if (ext.major) updates.major = ext.major;
    if (ext.creditsCompleted) updates.creditsCompleted = ext.creditsCompleted;
    if (ext.completedCourses?.length) updates.completedCourses = ext.completedCourses;
    if (ext.professorPrefs) {
      updates.professorPrefs = {
        liked: ext.professorPrefs.liked || session.professorPrefs.liked,
        disliked: ext.professorPrefs.disliked || session.professorPrefs.disliked,
      };
    }
    if (ext.schedulePrefs && Object.keys(ext.schedulePrefs).length > 0) {
      updates.schedulePrefs = { ...session.schedulePrefs, ...ext.schedulePrefs };
    }
    updateSession(session.id, updates);
  }

  // Store assistant message
  const assistantMsg = parsed.message || responseText;
  addMessage(session.id, "model", assistantMsg);

  // Send message to frontend
  onEvent("message", { role: "assistant", content: assistantMsg });

  // Check if ready to transition
  if (parsed.ready) {
    onEvent("phase", { phase: "research" });
    updateSession(session.id, { phase: "research" });

    // Kick off research phase asynchronously
    setTimeout(() => runResearchPhase(session.id, onEvent), 100);
  }
}

/**
 * Phase 2: Research — autonomous course research with Google Search grounding.
 */
async function runResearchPhase(sessionId, onEvent) {
  const session = getSession(sessionId);

  onEvent("message", {
    role: "assistant",
    content: `Great! I have everything I need. Let me research the degree requirements for **${session.major}** at **${session.school}** and find the best courses and professors for you. This will take a minute...`,
  });

  // Step 2a: Find degree requirements
  onEvent("research_status", { step: "degree_requirements", status: "searching" });

  let degreeReqs;
  try {
    const prompt = RESEARCH_DEGREE_PROMPT(session.school, session.major);
    const result = await generate({ prompt, useSearch: true });
    degreeReqs = parseJSON(result);
    updateSession(sessionId, { degreeRequirements: degreeReqs });
    onEvent("research_status", { step: "degree_requirements", status: "complete", data: degreeReqs });
  } catch (err) {
    console.error("Degree requirements research failed:", err);
    onEvent("research_status", {
      step: "degree_requirements",
      status: "error",
      error: "Could not find degree requirements. Proceeding with best estimates.",
    });
    // Create a fallback
    degreeReqs = {
      totalCreditsRequired: 120,
      coreRequirements: [],
      electiveGroups: [],
      generalEducation: { note: "Could not determine — please verify with your advisor", estimatedCredits: 0 },
      sources: [],
    };
    updateSession(sessionId, { degreeRequirements: degreeReqs });
  }

  // Step 2b: Compute remaining courses
  const remaining = computeRemainingCourses(degreeReqs, session.completedCourses);
  updateSession(sessionId, { remainingCourses: remaining });

  if (remaining.length === 0) {
    onEvent("message", {
      role: "assistant",
      content:
        "Based on the degree requirements I found, it looks like you may have completed most of your courses already! Could you double-check your completed courses list? If you're missing anything, let me know and I can re-research.",
    });
    updateSession(sessionId, { phase: "intake" });
    return;
  }

  onEvent("message", {
    role: "assistant",
    content: `Found **${remaining.length} remaining courses** for your degree. Now researching professors, workload, and availability for each...`,
  });

  // Step 2c: Research each remaining course in batches
  const batches = batchCourses(remaining, 4);
  const allProfiles = {};

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const courseNames = batch.map((c) => `${c.courseId}`).join(", ");

    onEvent("research_status", {
      step: "course_research",
      status: "searching",
      detail: `Batch ${i + 1}/${batches.length}: ${courseNames}`,
      courses: batch.map((c) => c.courseId),
    });

    try {
      const prompt = RESEARCH_COURSES_PROMPT(session.school, batch);
      const result = await generate({ prompt, useSearch: true });
      const parsed = parseJSON(result);

      if (parsed.courses) {
        for (const profile of parsed.courses) {
          // Merge with prereq info from degree requirements
          const original = batch.find(
            (c) => c.courseId.replace(/\s+/g, "") === profile.courseId.replace(/\s+/g, "")
          );
          if (original) {
            profile.prereqsMet = original.prereqsMet;
            profile.type = original.type;
            profile.group = original.group;
          }
          allProfiles[profile.courseId] = profile;
        }
      }

      onEvent("research_status", {
        step: "course_research",
        status: "complete",
        detail: courseNames,
        profiles: parsed.courses || [],
      });
    } catch (err) {
      console.error(`Course research batch ${i + 1} failed:`, err);
      // Add basic profiles for failed batch
      for (const course of batch) {
        allProfiles[course.courseId] = {
          ...course,
          workloadEstimate: "unknown",
          hoursPerWeek: "N/A",
          workloadReasoning: "Could not research this course",
          professors: [],
          sections: [],
          tips: "",
        };
      }
      onEvent("research_status", {
        step: "course_research",
        status: "partial",
        detail: `Some data missing for: ${courseNames}`,
      });
    }

    // Small delay between batches to respect rate limits
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  updateSession(sessionId, { courseProfiles: allProfiles });

  onEvent("message", {
    role: "assistant",
    content: `Research complete! I've profiled **${Object.keys(allProfiles).length} courses** with professor ratings, workload estimates, and availability. Now let me build your optimized schedule options...`,
  });

  // Transition to Phase 3
  updateSession(sessionId, { phase: "optimize" });
  onEvent("phase", { phase: "optimize" });
  await runOptimizePhase(sessionId, onEvent);
}

/**
 * Phase 3: Schedule Optimization.
 */
async function runOptimizePhase(sessionId, onEvent) {
  const session = getSession(sessionId);

  onEvent("research_status", { step: "optimization", status: "generating" });

  try {
    const prompt = OPTIMIZE_PROMPT(session);
    const result = await generate({ prompt, useSearch: false });
    const parsed = parseJSON(result);

    if (parsed.options) {
      updateSession(sessionId, { scheduleOptions: parsed.options, phase: "refine" });

      onEvent("schedule", { options: parsed.options });
      onEvent("phase", { phase: "refine" });
      onEvent("message", {
        role: "assistant",
        content:
          "Here are your optimized schedule options! Review them and let me know if you'd like any changes. You can say things like:\n- \"Move CSE 330 to Spring\"\n- \"I want to take lighter semesters\"\n- \"What if I add summer classes?\"\n- \"Can I cap at 12 credits per semester?\"",
      });
    } else {
      throw new Error("No schedule options generated");
    }
  } catch (err) {
    console.error("Optimization failed:", err);
    onEvent("message", {
      role: "assistant",
      content:
        "I had trouble generating schedule options. Let me try again with a simpler approach. Could you tell me your top priorities (graduate fast, easy semesters, best professors)?",
    });
    updateSession(sessionId, { phase: "refine" });
    onEvent("phase", { phase: "refine" });
  }
}

/**
 * Phase 4: Refinement — student feedback loop.
 */
async function handleRefine(session, userMessage, onEvent) {
  onEvent("research_status", { step: "refinement", status: "adjusting" });

  try {
    const prompt = REFINE_PROMPT(session, userMessage);
    const result = await generate({ prompt, useSearch: true });
    const parsed = parseJSON(result);

    if (parsed.options) {
      updateSession(session.id, { scheduleOptions: parsed.options });
      onEvent("schedule", { options: parsed.options });
    }

    const msg = parsed.message || "I've updated your schedule options based on your feedback. Take a look!";
    addMessage(session.id, "model", msg);
    onEvent("message", { role: "assistant", content: msg });
  } catch (err) {
    console.error("Refinement failed:", err);

    // Fallback: use chat mode for conversational refinement
    try {
      const history = getConversationForGemini(session.id);
      const response = await chat({
        systemPrompt: `You are a helpful course planning advisor. The student is reviewing schedule options and wants changes. Current schedules: ${JSON.stringify(session.scheduleOptions).slice(0, 3000)}. Help them refine their schedule. Be conversational and helpful.`,
        history: history.slice(0, -1),
        message: userMessage,
        useSearch: true,
      });
      addMessage(session.id, "model", response);
      onEvent("message", { role: "assistant", content: response });
    } catch (fallbackErr) {
      console.error("Refinement fallback failed:", fallbackErr);
      onEvent("message", {
        role: "assistant",
        content: "I had trouble processing that change. Could you be more specific about what you'd like adjusted?",
      });
    }
  }

  onEvent("research_status", { step: "refinement", status: "complete" });
}
