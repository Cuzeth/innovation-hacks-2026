# Course Load Optimizer Agent

An AI-powered agentic app that helps college students plan their remaining semesters. The agent uses Google Gemini 2.0 Flash with Google Search grounding to autonomously research courses, professors, workload, and availability, then generates optimized semester schedules.

## Architecture

```
┌─────────────────┐     REST/SSE     ┌──────────────────────────────────────┐
│   React Client  │◄───────────────►│         Express Server               │
│   (Vite + TW)   │                  │                                      │
│                  │                  │  ┌──────────────────────────────┐    │
│  ChatInterface   │   POST /api/chat│  │       Agent Orchestrator     │    │
│  ScheduleCards   │◄────────────────│  │                              │    │
│  CourseProfiles  │   GET /stream   │  │  Phase 1: Intake (conv.)     │    │
│                  │◄────────────────│  │  Phase 2: Research (agentic) │    │
└─────────────────┘   SSE events    │  │  Phase 3: Optimize (gen)     │    │
                                     │  │  Phase 4: Refine (loop)      │    │
                                     │  └──────────┬───────────────────┘    │
                                     │             │                        │
                                     │  ┌──────────▼───────────────────┐    │
                                     │  │    Gemini 2.0 Flash API      │    │
                                     │  │  + Google Search Grounding   │    │
                                     │  └──────────────────────────────┘    │
                                     │                                      │
                                     │  ┌──────────────────────────────┐    │
                                     │  │   In-Memory Session Store    │    │
                                     │  └──────────────────────────────┘    │
                                     └──────────────────────────────────────┘
```

## How to Run Locally

### Prerequisites
- Node.js 18+ or Bun
- A Google AI Studio API key ([get one free](https://aistudio.google.com/apikey))

### Setup

```bash
cd course-optimizer

# Install dependencies
cd server && bun install && cd ..
cd client && bun install && cd ..

# Set your API key
export GEMINI_API_KEY=your_key_here

# Start the server (terminal 1)
cd server && bun run dev

# Start the client (terminal 2)
cd client && bun run dev
```

Open http://localhost:5173 in your browser.

## Tech Stack

| Layer     | Tech                          | Why                                                    |
|-----------|-------------------------------|--------------------------------------------------------|
| Frontend  | React + Vite + Tailwind CSS   | Fast dev, dark-mode chat UI, responsive layout         |
| Backend   | Node.js + Express             | Simple REST + SSE, orchestrates the agent loop          |
| AI        | Gemini 2.0 Flash (@google/genai) | Free tier, built-in Google Search grounding, function calling |
| Database  | In-memory (Map)               | MVP — no setup needed, session state per conversation   |
| Streaming | Server-Sent Events (SSE)      | Real-time research progress updates to the frontend     |

## What Makes It "Agentic"

1. **Multi-phase autonomous pipeline** — The agent moves through intake, research, optimization, and refinement phases without human intervention during research.
2. **Google Search grounding** — Gemini autonomously searches the web for degree requirements, professor ratings, workload estimates, and course availability.
3. **Structured tool use** — The orchestrator manages state transitions, batches API calls to respect rate limits, and synthesizes research into structured course profiles.
4. **Refinement loop** — After presenting schedules, the student can iteratively request changes and the agent re-optimizes, maintaining conversation context throughout.

## Demo Script

1. Open the app and type: **"I'm a Computer Science major at Arizona State University, junior year"**
2. The agent will ask about completed courses. Reply: **"I've completed CSE 110, 120, 205, 230, 240, MAT 265, 266, 267, PHY 121"**
3. Optionally add preferences: **"I prefer morning classes and don't want more than 15 credits per semester. I want to graduate by Spring 2027."**
4. The agent transitions to research mode — watch it search for degree requirements and course info in real time.
5. Review the 2-3 schedule options with workload ratings and professor info.
6. Refine: **"Move CSE 330 to Spring"** or **"Can I take summer classes?"**

## Stretch Goals

- Google Calendar export for the chosen schedule
- Transcript PDF upload for automatic course extraction
- Multi-semester planning with what-if scenarios
- Rate limit queue with retry logic for heavy usage
- Persistent sessions with a database (Firestore/SQLite)
