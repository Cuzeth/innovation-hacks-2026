import express from "express";
import cors from "cors";
import { createSession, getSession } from "./session/store.js";
import { handleMessage } from "./agent/orchestrator.js";
import { testConnection } from "./agent/gemini.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Store active SSE connections per session
const sseClients = new Map();

/**
 * Health check + Gemini connectivity test
 */
app.get("/api/health", async (req, res) => {
  try {
    const geminiResponse = await testConnection();
    res.json({ status: "ok", gemini: "connected", test: geminiResponse });
  } catch (err) {
    res.json({ status: "ok", gemini: "error", error: err.message });
  }
});

/**
 * POST /api/chat — Send a message to the agent
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get or create session
    let session;
    if (sessionId) {
      session = getSession(sessionId);
      if (!session) {
        session = createSession();
      }
    } else {
      session = createSession();
    }

    // Collect events to send back
    const events = [];
    const onEvent = (type, data) => {
      events.push({ type, data });
      // Also send to any active SSE connection
      const clients = sseClients.get(session.id) || [];
      for (const client of clients) {
        client.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    // Process the message
    await handleMessage(session.id, message, onEvent);

    // Return collected events as JSON response
    const updatedSession = getSession(session.id);
    res.json({
      sessionId: session.id,
      phase: updatedSession.phase,
      events,
      data: {
        courseProfiles: updatedSession.courseProfiles,
        scheduleOptions: updatedSession.scheduleOptions,
        degreeRequirements: updatedSession.degreeRequirements,
      },
    });
  } catch (err) {
    console.error("Chat endpoint error:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

/**
 * GET /api/chat/stream — SSE endpoint for real-time updates
 */
app.get("/api/chat/stream", (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ sessionId, phase: session.phase })}\n\n`);

  // Register this client
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, []);
  }
  sseClients.get(sessionId).push(res);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 15000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(sessionId) || [];
    const idx = clients.indexOf(res);
    if (idx !== -1) clients.splice(idx, 1);
    if (clients.length === 0) sseClients.delete(sessionId);
  });
});

/**
 * GET /api/session/:id — Get current session state
 */
app.get("/api/session/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({
    sessionId: session.id,
    phase: session.phase,
    school: session.school,
    major: session.major,
    data: {
      courseProfiles: session.courseProfiles,
      scheduleOptions: session.scheduleOptions,
      degreeRequirements: session.degreeRequirements,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Course Optimizer server running on port ${PORT}`);
});
