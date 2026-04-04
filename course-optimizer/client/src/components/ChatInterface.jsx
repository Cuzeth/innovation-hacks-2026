import React, { useState, useRef, useEffect, useCallback } from "react";
import MessageBubble from "./MessageBubble.jsx";
import LoadingIndicator from "./LoadingIndicator.jsx";
import ScheduleCard from "./ScheduleCard.jsx";
import CourseProfile from "./CourseProfile.jsx";

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState("intake");
  const [scheduleOptions, setScheduleOptions] = useState([]);
  const [courseProfiles, setCourseProfiles] = useState({});
  const [researchLog, setResearchLog] = useState([]);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, researchLog]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Set up SSE connection when we have a session
  const connectSSE = useCallback((sid) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/chat/stream?sessionId=${sid}`);
    eventSourceRef.current = es;

    es.addEventListener("message", (e) => {
      const data = JSON.parse(e.data);
      setMessages((prev) => [...prev, { role: data.role, content: data.content }]);
      setLoading(false);
      setLoadingMessage(null);
    });

    es.addEventListener("phase", (e) => {
      const data = JSON.parse(e.data);
      setPhase(data.phase);
    });

    es.addEventListener("research_status", (e) => {
      const data = JSON.parse(e.data);
      setResearchLog((prev) => [...prev, data]);

      if (data.status === "searching" || data.status === "generating" || data.status === "adjusting") {
        setLoading(true);
        setLoadingMessage(data.detail || data.step.replace(/_/g, " "));
      }

      if (data.profiles) {
        setCourseProfiles((prev) => {
          const updated = { ...prev };
          for (const p of data.profiles) {
            updated[p.courseId] = p;
          }
          return updated;
        });
      }
    });

    es.addEventListener("schedule", (e) => {
      const data = JSON.parse(e.data);
      setScheduleOptions(data.options);
      setLoading(false);
      setLoadingMessage(null);
    });

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => es.close();
  }, []);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setLoadingMessage(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
        setLoading(false);
        return;
      }

      // Store session ID and connect SSE on first message
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
        connectSSE(data.sessionId);
      }

      if (data.phase) setPhase(data.phase);

      // Process events from the response
      if (data.events) {
        for (const event of data.events) {
          if (event.type === "message") {
            setMessages((prev) => [...prev, { role: event.data.role, content: event.data.content }]);
          }
          if (event.type === "schedule" && event.data.options) {
            setScheduleOptions(event.data.options);
          }
          if (event.type === "phase") {
            setPhase(event.data.phase);
          }
        }
      }

      // Update data from response
      if (data.data?.scheduleOptions?.length) {
        setScheduleOptions(data.data.scheduleOptions);
      }
      if (data.data?.courseProfiles) {
        setCourseProfiles((prev) => ({ ...prev, ...data.data.courseProfiles }));
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to reach the server. Make sure the backend is running." },
      ]);
    }

    setLoading(false);
    setLoadingMessage(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const phaseLabels = {
    intake: "Getting to know you",
    research: "Researching courses",
    optimize: "Building schedules",
    refine: "Refining your plan",
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-gray-800 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">Course Load Optimizer</h1>
              <p className="text-xs text-gray-500 mt-0.5">AI-powered semester planning</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${phase === "research" || phase === "optimize" ? "bg-yellow-400 animate-pulse" : "bg-emerald-400"}`} />
              <span className="text-xs text-gray-400">{phaseLabels[phase]}</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto chat-scroll px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📚</span>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Plan Your Path to Graduation</h2>
                <p className="text-gray-400 text-sm mb-6">
                  I'll help you find the best courses, professors, and schedule to finish your degree.
                  Just tell me about yourself and I'll handle the rest.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "I'm a CS major at ASU",
                    "Help me plan next semester",
                    "I need to graduate by Spring 2027",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-gray-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} />
          ))}

          {/* Inline course profiles during research */}
          {phase === "research" && researchLog.length > 0 && (
            <div className="space-y-2 pl-11">
              {researchLog
                .filter((r) => r.step === "course_research" && r.status === "searching")
                .slice(-1)
                .map((r, i) => (
                  <div key={i} className="text-xs text-indigo-400/70 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                    Researching {r.detail}...
                  </div>
                ))}
            </div>
          )}

          {loading && <LoadingIndicator message={loadingMessage} />}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 px-6 py-4 flex-shrink-0">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                phase === "refine"
                  ? "Request changes to your schedule..."
                  : "Tell me about your courses..."
              }
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              disabled={loading && (phase === "research" || phase === "optimize")}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || (loading && (phase === "research" || phase === "optimize"))}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Panel — shows when we have schedule options or course profiles */}
      {(scheduleOptions.length > 0 || Object.keys(courseProfiles).length > 0) && (
        <div className="lg:w-[480px] xl:w-[540px] border-l border-gray-800 overflow-y-auto chat-scroll bg-gray-950/50">
          <div className="p-5 space-y-5">
            {/* Schedule options */}
            {scheduleOptions.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  Schedule Options
                </h2>
                <div className="space-y-4">
                  {scheduleOptions.map((option, i) => (
                    <ScheduleCard key={i} option={option} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Researched course profiles */}
            {Object.keys(courseProfiles).length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  Course Research ({Object.keys(courseProfiles).length} courses)
                </h2>
                <div className="space-y-2">
                  {Object.values(courseProfiles).map((course) => (
                    <CourseProfile key={course.courseId} course={course} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
