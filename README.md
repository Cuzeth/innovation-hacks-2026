# Academic Copilot for ASU

## 1. Restated App and ASU-Focused V1 Scope

Academic Copilot for ASU is a polished, demo-first academic advising application for one Arizona State University student journey. The product helps a student:

1. understand degree requirements
2. evaluate completed, AP, and transfer credit
3. generate a semester-by-semester graduation roadmap
4. rank next-term schedule options using timing, professor quality, and commute awareness
5. preview and export an approved schedule to Google Calendar

V1 is intentionally narrow and reliable:

- University: Arizona State University
- Student scope: one active student profile at a time
- Primary demo major: Computer Science BS
- Additional seeded major: Computer Science (Cybersecurity) BS
- Provider architecture: ready for more ASU majors and later more universities

What is real vs demo-safe:

- Real: full-stack Next.js + FastAPI app, persistence layer, typed agent contracts, Google Calendar OAuth flow, Google Maps commute integration with seeded fallback, Cloud Run-ready Dockerfiles
- Demo-safe seeded data: ASU requirements, course catalog, sections, AP equivalencies, professor ratings, syllabus signals
- Optional Gemini-powered enhancements: transcript parsing, grounded major lookup beyond seeded majors, richer generated explanations
- Deterministic fallback: the full seeded ASU workflow still runs without a Gemini key

## 2. Proposed Architecture

### High-Level Architecture

```text
Next.js Frontend
  ├─ Landing / onboarding
  ├─ Degree audit dashboard
  ├─ Graduation roadmap
  ├─ Schedule ranking + tradeoffs
  └─ Calendar export preview
           │
           ▼
FastAPI Backend
  ├─ Orchestrator Agent
  ├─ Requirements Retrieval Agent
  ├─ Credit Evaluation Agent
  ├─ Academic Planning Agent
  ├─ Section Ranking Agent
  ├─ Calendar Execution Agent
  ├─ Provider / adaptor layer
  ├─ SQLite / PostgreSQL-compatible persistence
  └─ Typed JSON contracts endpoint
           │
           ├─ Vertex AI / Gemini
           ├─ Google Calendar API
           └─ Google Maps API
```

### Chosen Stack and Rationale

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 + TypeScript + Tailwind | Fast demo iteration, polished component UX, strong deploy story |
| Backend | FastAPI + Pydantic | Clean typed contracts, quick REST + agent orchestration |
| Persistence | SQLAlchemy with SQLite locally, PostgreSQL-compatible schema for prod | Local setup stays simple, Cloud SQL Postgres is a clean Cloud Run path |
| AI | Gemini via `google-genai` | Central reasoning/orchestration, grounded lookup, transcript parsing, explanation generation |
| Maps | Google Maps Distance Matrix with ASU campus fallback | Real commute integration when configured, reliable demo fallback when not |
| Calendar | Google Calendar OAuth + API | Honest execution step with real export when configured |
| Deployment | Docker + Cloud Run | Hackathon-friendly, deployment-ready, easy service split |

### Agent Responsibilities

| Agent | Responsibility | Primary Inputs | Primary Outputs |
|---|---|---|---|
| Orchestrator | Runs the full advising workflow | `StudentProfile` | `WorkflowSnapshot`-style state |
| Requirements Retrieval | Loads ASU degree requirements | major code, catalog year | `DegreeRequirements` |
| Credit Evaluation | Maps courses/AP/transfer work onto requirements | student + requirements | `DegreeAudit` |
| Academic Planning | Builds graduation paths and bottleneck analysis | student + audit | `AcademicPlan` |
| Section Ranking | Finds and ranks schedule combinations | student + next semester plan | `ProposedSchedule[]` |
| Calendar Execution | Creates preview/export events | approved schedule | `CalendarExportResult` |

### Provider / Adaptor Interfaces

Implemented in [`academic-copilot/backend/app/providers/base.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/providers/base.py):

- `RequirementsProvider`
- `CourseProvider`
- `EquivalencyProvider`
- `ProfessorRatingProvider`
- `SyllabusArchiveProvider`
- `CommuteProvider`
- `CalendarProvider`

V1 adaptors:

- [`academic-copilot/backend/app/providers/asu_requirements.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/providers/asu_requirements.py)
- [`academic-copilot/backend/app/providers/asu_courses.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/providers/asu_courses.py)
- [`academic-copilot/backend/app/providers/ap_equivalency.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/providers/ap_equivalency.py)
- [`academic-copilot/backend/app/providers/academic_enrichment.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/providers/academic_enrichment.py)
- [`academic-copilot/backend/app/providers/google_maps.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/providers/google_maps.py)
- [`academic-copilot/backend/app/providers/google_calendar.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/providers/google_calendar.py)

## 3. File Tree

```text
academic-copilot/
├─ .env.example
├─ backend/
│  ├─ .env.example
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ audit.py
│  │  │  ├─ calendar.py
│  │  │  ├─ contracts.py
│  │  │  ├─ plan.py
│  │  │  ├─ schedule.py
│  │  │  ├─ student.py
│  │  │  └─ auth.py
│  │  ├─ agents/
│  │  │  ├─ orchestrator.py
│  │  │  ├─ requirements.py
│  │  │  ├─ credit_eval.py
│  │  │  ├─ planner.py
│  │  │  ├─ section_ranker.py
│  │  │  ├─ calendar.py
│  │  │  └─ transcript.py
│  │  ├─ contracts/
│  │  │  └─ agent_handoffs.py
│  │  ├─ db/
│  │  │  ├─ models.py
│  │  │  ├─ repository.py
│  │  │  └─ session.py
│  │  ├─ models/
│  │  │  ├─ student.py
│  │  │  ├─ degree.py
│  │  │  ├─ course.py
│  │  │  ├─ plan.py
│  │  │  └─ schedule.py
│  │  ├─ providers/
│  │  │  ├─ base.py
│  │  │  ├─ academic_enrichment.py
│  │  │  ├─ ap_equivalency.py
│  │  │  ├─ asu_courses.py
│  │  │  ├─ asu_requirements.py
│  │  │  ├─ google_calendar.py
│  │  │  └─ google_maps.py
│  │  ├─ data/
│  │  │  ├─ asu_cs_requirements.json
│  │  │  ├─ asu_cs_cyber_requirements.json
│  │  │  ├─ asu_cs_courses.json
│  │  │  ├─ asu_cs_sections_fall2026.json
│  │  │  ├─ ap_equivalencies.json
│  │  │  ├─ professor_ratings.json
│  │  │  ├─ syllabus_signals.json
│  │  │  ├─ asu_majors.json
│  │  │  └─ sample_student.json
│  │  ├─ config.py
│  │  └─ main.py
│  └─ tests/
│     ├─ test_providers.py
│     ├─ test_agents.py
│     └─ test_persistence.py
└─ frontend/
   ├─ .env.example
   ├─ Dockerfile
   ├─ package.json
   ├─ next.config.ts
   └─ src/
      ├─ app/
      │  ├─ layout.tsx
      │  ├─ page.tsx
      │  └─ globals.css
      ├─ components/
      │  ├─ Onboarding.tsx
      │  ├─ Dashboard.tsx
      │  ├─ ProfileBar.tsx
      │  ├─ AgentLog.tsx
      │  ├─ AuditView.tsx
      │  ├─ PlanView.tsx
      │  ├─ ScheduleView.tsx
      │  ├─ CalendarView.tsx
      │  └─ Markdown.tsx
      └─ lib/
         ├─ api.ts
         └─ types.ts
```

## 4. Database Schema

Local demo mode defaults to SQLite. Production can point `DATABASE_URL` at Cloud SQL PostgreSQL without changing application code.

### Logical Schema

```sql
CREATE TABLE student_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  university TEXT NOT NULL DEFAULT 'Arizona State University',
  major TEXT NOT NULL DEFAULT '',
  major_code TEXT NOT NULL DEFAULT '',
  catalog_year TEXT NOT NULL DEFAULT '2024-2025',
  current_semester TEXT NOT NULL DEFAULT 'Fall 2026',
  profile_json TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE workflow_snapshots (
  student_id TEXT PRIMARY KEY REFERENCES student_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ready',
  audit_json TEXT NOT NULL DEFAULT '',
  plan_json TEXT NOT NULL DEFAULT '',
  schedules_json TEXT NOT NULL DEFAULT '[]',
  agent_log_json TEXT NOT NULL DEFAULT '[]',
  selected_schedule_id TEXT NOT NULL DEFAULT '',
  calendar_result_json TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

Why JSON columns for V1:

- persistence stays simple and robust for a hackathon demo
- domain models remain fully typed in Pydantic
- schema is still PostgreSQL-compatible
- we avoid over-normalizing a single-student demo workflow

## 5. Agent JSON Schemas and API Contracts

### Agent Handoff Schemas

Pydantic-backed JSON schemas live in [`academic-copilot/backend/app/contracts/agent_handoffs.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/contracts/agent_handoffs.py) and are exposed at `GET /api/contracts`.

Defined handoff objects:

- `RequirementsRetrievalOutput`
- `CreditEvaluationInput`
- `CreditEvaluationOutput`
- `PlanningInput`
- `PlanningOutput`
- `ScheduleRankingInput`
- `ScheduleRankingOutput`
- `CalendarExecutionInput`
- `CalendarExecutionOutput`
- `WorkflowSnapshot`

Every step is backed by typed Pydantic models, and major recommendations expose both:

- machine-readable structure
  - degree audit explanations
  - bottlenecks
  - risk factors
  - schedule score breakdowns
  - travel warnings
- narrative explanation
  - AI-generated when Gemini is configured
  - deterministic fallback text when it is not

### API Route Definitions

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/contracts` | JSON schemas + route summary |
| `GET` | `/api/student/profile` | Load active student profile |
| `PUT` | `/api/student/profile` | Save student profile |
| `POST` | `/api/student/profile/reset` | Reset profile and workflow state |
| `POST` | `/api/student/profile/load-demo` | Load seeded demo student |
| `PUT` | `/api/student/preferences` | Update preferences |
| `POST` | `/api/student/courses` | Add completed/AP/transfer course |
| `DELETE` | `/api/student/courses/{course_id}` | Remove course |
| `GET` | `/api/student/majors` | List ASU majors |
| `GET` | `/api/student/courses/catalog` | List course catalog options |
| `GET` | `/api/student/ap-exams` | List AP equivalency options |
| `POST` | `/api/student/transcript/upload` | Parse transcript PDF with Gemini |
| `POST` | `/api/audit/run` | Run the full multi-agent advising workflow |
| `GET` | `/api/audit/result` | Fetch latest audit |
| `GET` | `/api/audit/explain` | Generate audit explanation |
| `GET` | `/api/audit/agent-log` | Fetch agent activity log |
| `GET` | `/api/plan/result` | Fetch latest academic plan |
| `GET` | `/api/plan/bottlenecks` | Fetch bottleneck and risk data |
| `GET` | `/api/plan/paths` | Fetch recommended + alternative paths |
| `GET` | `/api/schedule/recommendations` | Fetch ranked schedules |
| `POST` | `/api/schedule/{schedule_id}/select` | Persist approved schedule |
| `POST` | `/api/calendar/preview` | Preview Google Calendar events |
| `POST` | `/api/calendar/export` | Export schedule to calendar |
| `GET` | `/api/auth/google/login` | Start Google OAuth |
| `GET` | `/api/auth/google/callback` | Handle OAuth callback |
| `GET` | `/api/auth/google/status` | Inspect calendar auth state |

## 6. Project Code, Step by Step by File

### Backend Core

- [`academic-copilot/backend/app/main.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/main.py)
  - FastAPI app bootstrap
  - CORS
  - startup DB initialization
  - route registration

- [`academic-copilot/backend/app/config.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/config.py)
  - environment-driven configuration
  - Gemini, Maps, Calendar, DB, frontend URL settings

- [`academic-copilot/backend/app/db/models.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/db/models.py)
  - persistence tables for profile + workflow snapshot

- [`academic-copilot/backend/app/db/repository.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/db/repository.py)
  - CRUD for the active student
  - workflow snapshot persistence
  - demo-profile loading

### Agents

- [`academic-copilot/backend/app/agents/orchestrator.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/agents/orchestrator.py)
  - coordinates the end-to-end workflow
  - captures structured agent logs

- [`academic-copilot/backend/app/agents/requirements.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/agents/requirements.py)
  - loads seeded ASU requirements
  - can fall back to Gemini-grounded lookup for non-seeded majors

- [`academic-copilot/backend/app/agents/credit_eval.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/agents/credit_eval.py)
  - evaluates fulfilled, partial, unmet requirements
  - marks uncertain transfer mappings for advisor review

- [`academic-copilot/backend/app/agents/planner.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/agents/planner.py)
  - builds recommended and accelerated paths
  - detects prerequisite bottlenecks
  - computes AP-credit impact
  - generates risk-to-timeline summaries

- [`academic-copilot/backend/app/agents/section_ranker.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/agents/section_ranker.py)
  - scores sections by time, modality, professor quality, and home commute
  - scores full schedules by compactness and cross-campus travel feasibility
  - adds travel warnings and explicit score breakdowns

- [`academic-copilot/backend/app/agents/calendar.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/agents/calendar.py)
  - turns schedules into recurring class events
  - adds first-class, between-class, and return commute blocks
  - exports to real or mock Google Calendar providers

- [`academic-copilot/backend/app/agents/transcript.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/agents/transcript.py)
  - Gemini-powered PDF transcript parser for the onboarding flow

### API Layer

- [`academic-copilot/backend/app/api/student.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/api/student.py)
  - onboarding profile, majors, course catalog, AP list, transcript upload

- [`academic-copilot/backend/app/api/audit.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/api/audit.py)
  - full workflow trigger + result retrieval

- [`academic-copilot/backend/app/api/plan.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/api/plan.py)
  - path and bottleneck retrieval

- [`academic-copilot/backend/app/api/schedule.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/api/schedule.py)
  - schedule recommendations + selection persistence

- [`academic-copilot/backend/app/api/calendar.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/api/calendar.py)
  - preview + export

- [`academic-copilot/backend/app/api/contracts.py`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/api/contracts.py)
  - JSON schema discovery endpoint

### Frontend

- [`academic-copilot/frontend/src/app/page.tsx`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/app/page.tsx)
  - polished ASU landing page
  - onboarding vs demo-student launch

- [`academic-copilot/frontend/src/components/Onboarding.tsx`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/components/Onboarding.tsx)
  - step-based profile, courses, AP credits, preferences, transcript upload

- [`academic-copilot/frontend/src/components/Dashboard.tsx`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/components/Dashboard.tsx)
  - primary workspace
  - agent-log sidebar
  - selected schedule handoff into calendar

- [`academic-copilot/frontend/src/components/AuditView.tsx`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/components/AuditView.tsx)
  - fulfilled vs unmet requirement UI
  - source audit trail

- [`academic-copilot/frontend/src/components/PlanView.tsx`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/components/PlanView.tsx)
  - semester roadmap
  - bottleneck warnings
  - AP credit impact
  - risk panel

- [`academic-copilot/frontend/src/components/ScheduleView.tsx`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/components/ScheduleView.tsx)
  - ranked schedules
  - score breakdown
  - travel warnings
  - section-level notes

- [`academic-copilot/frontend/src/components/CalendarView.tsx`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/components/CalendarView.tsx)
  - preview events
  - mock vs real export state

- [`academic-copilot/frontend/src/lib/types.ts`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/lib/types.ts)
  - frontend mirror of typed backend contracts

- [`academic-copilot/frontend/src/lib/api.ts`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/frontend/src/lib/api.ts)
  - typed REST client

### Seed / Demo Data

- Requirements: [`academic-copilot/backend/app/data/asu_cs_requirements.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/asu_cs_requirements.json), [`academic-copilot/backend/app/data/asu_cs_cyber_requirements.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/asu_cs_cyber_requirements.json)
- Courses + sections: [`academic-copilot/backend/app/data/asu_cs_courses.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/asu_cs_courses.json), [`academic-copilot/backend/app/data/asu_cs_sections_fall2026.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/asu_cs_sections_fall2026.json)
- Equivalencies: [`academic-copilot/backend/app/data/ap_equivalencies.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/ap_equivalencies.json)
- Academic enrichment: [`academic-copilot/backend/app/data/professor_ratings.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/professor_ratings.json), [`academic-copilot/backend/app/data/syllabus_signals.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/syllabus_signals.json)
- Demo student: [`academic-copilot/backend/app/data/sample_student.json`](/Users/cuz/GitHub/innovation-hacks-2026/academic-copilot/backend/app/data/sample_student.json)

## 7. Setup and Run Instructions

### Prerequisites

- Python 3.13 recommended for the backend
- Node.js 20+ or Bun
- Optional: Gemini API key
- Optional: Google Calendar OAuth credentials
- Optional: Google Maps API key

### Environment Setup

```bash
cd academic-copilot
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### Backend

```bash
cd academic-copilot/backend
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Notes:

- If `GEMINI_API_KEY` is empty, the seeded ASU demo still runs with deterministic explanation fallbacks.
- Gemini is required for transcript parsing and grounded major lookup for non-seeded majors.

### Frontend

```bash
cd academic-copilot/frontend
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Suggested Local Demo Path

1. Launch the frontend.
2. Click `Launch Demo Student`.
3. Run the full audit.
4. Show the degree audit, bottleneck panel, and AP credit impact.
5. Select the top-ranked schedule.
6. Preview the commute-aware calendar export.

### Verification Commands

Backend tests:

```bash
cd academic-copilot/backend
./.venv/bin/python tests/test_providers.py
./.venv/bin/python tests/test_agents.py
./.venv/bin/python tests/test_persistence.py
```

Frontend production build:

```bash
cd academic-copilot/frontend
bun run build
```

Validated in this workspace:

- provider tests passed
- agent logic tests passed
- persistence + calendar preview tests passed
- frontend production build passed
- full seeded ASU workflow executed successfully without a Gemini key

## 8. Cloud Run Deployment Instructions

### Backend on Cloud Run

Recommended production DB: Cloud SQL PostgreSQL.

1. Create a Cloud SQL Postgres instance.
2. Create a database and user.
3. Build and push the backend image:

```bash
cd academic-copilot/backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT/academic-copilot-api
```

4. Deploy with Cloud SQL attachment:

```bash
gcloud run deploy academic-copilot-api \
  --image gcr.io/YOUR_PROJECT/academic-copilot-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances YOUR_PROJECT:us-central1:academic-copilot-db \
  --set-env-vars APP_NAME=Academic\ Copilot \
  --set-env-vars FRONTEND_URL=https://YOUR_FRONTEND_URL \
  --set-env-vars GEMINI_API_KEY=YOUR_GEMINI_API_KEY \
  --set-env-vars GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID \
  --set-env-vars GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET \
  --set-env-vars GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY \
  --set-env-vars DATABASE_URL='postgresql+psycopg://DB_USER:DB_PASSWORD@/DB_NAME?host=/cloudsql/YOUR_PROJECT:us-central1:academic-copilot-db'
```

### Frontend on Cloud Run

```bash
cd academic-copilot/frontend
gcloud builds submit --tag gcr.io/YOUR_PROJECT/academic-copilot-web

gcloud run deploy academic-copilot-web \
  --image gcr.io/YOUR_PROJECT/academic-copilot-web \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL=https://YOUR_BACKEND_URL
```

### Google OAuth Notes

- Enable Google Calendar API in the same project.
- Add the frontend callback URI:
  - `http://localhost:3000/api/auth/callback`
  - `https://YOUR_FRONTEND_URL/api/auth/callback`
- Use the backend env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

## 9. Polished Demo Script

### Demo Setup

- Backend running
- Frontend running
- Optional Gemini key for richer explanation text
- Optional Google OAuth already configured if you want a real calendar write

### 3-5 Minute Judge Flow

1. **Landing page**
   - “Academic Copilot is an AI academic advisor built specifically for ASU.”
   - Point at the agent relay panel to reinforce this is multi-agent, not a generic chatbot.

2. **Launch Demo Student**
   - Open the seeded student profile.
   - Mention that AP credit, completed coursework, and preferences are already loaded.

3. **Run Full Audit**
   - Show the agent log.
   - Call out that the workflow is typed and stateful, with each agent handling a distinct job.

4. **Degree Audit**
   - Show fulfilled vs unmet requirements.
   - Mention source traceability back to the ASU major map data source.
   - Call out any items marked for advisor review.

5. **Graduation Plan**
   - This is the first wow moment.
   - Show the bottleneck panel.
   - Explain that the planner discovered a hidden prerequisite chain around `CSE 330` and the capstone path.
   - Show the AP-credit impact banner and mention that AP credit removed about 1.3 semesters.

6. **Schedule Ranking**
   - This is the second wow moment.
   - Compare the top schedule’s score breakdown.
   - Point out commute-aware ranking and cross-campus travel warnings.
   - Mention professor quality and syllabus signals influencing the recommendation.

7. **Calendar Preview / Export**
   - Show that the app previews class events plus commute blocks before writing anything.
   - If OAuth is configured, export to a real Google Calendar.
   - If not, be honest that mock mode is active and explain exactly what would be written.

### Judge Sound Bites

- “We optimized for one beautiful ASU workflow instead of pretending to support every university.”
- “Every major recommendation has a machine-readable reason and a human-readable explanation.”
- “The standout moment is that the app catches graduation risk early, then turns the recommended schedule into an executable calendar.”

## 10. Future Enhancements

- Add more seeded ASU majors behind the same provider contracts
- Replace seeded section data with a real ASU course search integration
- Persist multiple student accounts and real sign-in
- Add advisor-facing override workflows
- Add true transfer equivalency ingestion from official transfer guides
- Add professor reviews from a live provider instead of demo-safe seed data
- Add syllabus archive ingestion from real historical course materials
- Add scenario comparison: fastest graduation vs best internship semester vs lowest weekly load
- Add direct registration cart export if ASU integration becomes available
- Introduce university adapters beyond ASU by implementing new providers without changing the core agent layer
