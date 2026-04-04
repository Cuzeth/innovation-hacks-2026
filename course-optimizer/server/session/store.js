import { randomUUID } from "crypto";

const sessions = new Map();

export function createSession() {
  const id = randomUUID();
  const session = {
    id,
    phase: "intake",
    school: null,
    major: null,
    creditsCompleted: null,
    completedCourses: [],
    professorPrefs: { liked: [], disliked: [] },
    schedulePrefs: {},
    degreeRequirements: null,
    remainingCourses: [],
    courseProfiles: {},
    scheduleOptions: [],
    conversationHistory: [],
    researchProgress: [],
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function updateSession(id, updates) {
  const session = sessions.get(id);
  if (!session) return null;
  Object.assign(session, updates);
  sessions.set(id, session);
  return session;
}

export function addMessage(sessionId, role, content, metadata = null) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.conversationHistory.push({ role, content, metadata, timestamp: Date.now() });
}

export function getConversationForGemini(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.conversationHistory
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : m.role,
      parts: [{ text: m.content }],
    }));
}
