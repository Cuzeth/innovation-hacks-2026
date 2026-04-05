# Academic Copilot for ASU

AI-powered academic advisor that audits degree progress, generates graduation plans, recommends optimal schedules, and exports to Google Calendar — built for Arizona State University students.

## What It Does

A student signs in, selects their ASU major, enters completed courses and AP/transfer credits, and receives:

1. **Degree Audit** — structured view of fulfilled vs unmet requirements
2. **Graduation Plan** — semester-by-semester roadmap with bottleneck detection
3. **Schedule Recommendations** — ranked class sections based on timing, professor quality, and commute
4. **Calendar Export** — approved schedule pushed to Google Calendar with commute buffers

## Architecture

```
┌──────────────────────┐          ┌────────────────────────────────────┐
│   Next.js Frontend   │  REST    │          FastAPI Backend           │
│   (React + Tailwind) │◄────────►│                                    │
│                      │          │  ┌────────────────────────────┐    │
│  Landing Page        │          │  │   Orchestrator Agent       │    │
│  Degree Audit View   │          │  │   ├─ Requirements Agent    │    │
│  Graduation Plan     │          │  │   ├─ Credit Eval Agent     │    │
│  Schedule Picker     │          │  │   ├─ Planning Agent        │    │
│  Calendar Export     │          │  │   ├─ Section Ranker Agent  │    │
│  Agent Activity Log  │          │  │   └─ Calendar Agent        │    │
└──────────────────────┘          │  └──────────┬─────────────────┘    │
                                  │             │                      │
                                  │  ┌──────────▼─────────────────┐    │
                                  │  │   Gemini 2.5 Flash API     │    │
                                  │  │   (reasoning + explain)    │    │
                                  │  └────────────────────────────┘    │
                                  │                                    │
                                  │  ┌────────────────────────────┐    │
                                  │  │   Provider Layer           │    │
                                  │  │   ├─ ASU Requirements      │    │
                                  │  │   ├─ ASU Course Sections   │    │
                                  │  │   ├─ AP Equivalencies      │    │
                                  │  │   ├─ Google Maps           │    │
                                  │  │   └─ Google Calendar       │    │
                                  │  └────────────────────────────┘    │
                                  └────────────────────────────────────┘
```

## Agents

| Agent | Responsibility | Tools |
|-------|---------------|-------|
| **Orchestrator** | Coordinates full workflow, manages state | All agents |
| **Requirements** | Retrieves and structures degree requirements | ASU requirements provider, Gemini |
| **Credit Eval** | Matches completed/AP/transfer credits to requirements | Equivalency provider, Gemini |
| **Planner** | Generates semester-by-semester plans with bottleneck detection | Course provider, Gemini |
| **Section Ranker** | Scores and ranks available sections by preferences | Section provider, Maps API, Gemini |
| **Calendar** | Creates Google Calendar events with commute blocks | Calendar API |

## Standout Features

- **Prerequisite bottleneck detection** — automatically finds courses that block the most downstream requirements
- **AP credit impact visualization** — shows exactly how many semesters your AP credits saved
- **Risk to graduation timeline** — panel highlighting what could delay graduation and how to mitigate
- **Commute-aware scheduling** — factors travel time between buildings into schedule ranking
- **Dual explanation mode** — every recommendation includes both machine-readable reasoning and student-friendly narrative

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS | Polished dark-mode UI |
| Backend | FastAPI (Python 3.13+) | REST API + agent orchestration |
| AI | Gemini 2.5 Flash via google-genai | Reasoning, explanation, planning |
| Maps | Google Maps Distance Matrix API | Commute estimation |
| Calendar | Google Calendar API | Schedule export |
| Deployment | Google Cloud Run + Docker | Production hosting |

## Local Setup

### Prerequisites
- Python 3.13+ (via conda or system — Python 3.14 not yet supported by pydantic)
- Node.js 18+ or Bun
- A [Gemini API key](https://aistudio.google.com/apikey)

### 1. Clone and configure

```bash
cd academic-copilot
cp .env.example backend/.env
# Edit backend/.env and add your GEMINI_API_KEY
```

### 2. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Start the frontend

```bash
cd frontend
bun install
bun run dev
```

Open http://localhost:3000

### 4. Run the demo

1. Click **Get Started** on the landing page
2. Review the pre-loaded sample student profile (CS major, junior)
3. Click **Run Full Audit** — watch the agent log in real-time
4. Explore the **Degree Audit** tab — fulfilled vs unmet requirements
5. Switch to **Grad Plan** — see bottleneck alerts and AP credit impact
6. Check **Schedule** — compare ranked schedule options
7. Go to **Calendar** — preview and export events

### Optional: Google Calendar integration

To enable real calendar export:

1. Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable the Google Calendar API
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `backend/.env`
4. Set redirect URI to `http://localhost:3000/api/auth/callback`

Without these, the app uses mock calendar mode (events are simulated).

### Optional: Google Maps commute

Add `GOOGLE_MAPS_API_KEY` to `backend/.env` to get real driving time estimates. Without it, campus walking times between buildings are used as fallback.

## Running Tests

```bash
cd backend
source .venv/bin/activate
python tests/test_providers.py    # Data provider tests (no API key needed)
python tests/test_agents.py       # Agent logic tests (no API key needed)
```

## Google Cloud Run Deployment

```bash
# Backend
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT/academic-copilot-api
gcloud run deploy academic-copilot-api \
  --image gcr.io/YOUR_PROJECT/academic-copilot-api \
  --platform managed \
  --region us-central1 \
  --set-env-vars "GEMINI_API_KEY=your-key,FRONTEND_URL=https://your-frontend-url" \
  --allow-unauthenticated

# Frontend
cd frontend
# Set NEXT_PUBLIC_API_URL to your backend Cloud Run URL
gcloud builds submit --tag gcr.io/YOUR_PROJECT/academic-copilot-web
gcloud run deploy academic-copilot-web \
  --image gcr.io/YOUR_PROJECT/academic-copilot-web \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Demo Script (Hackathon Judging)

**Setup:** Have the app running locally with a valid Gemini API key.

**Flow (3-5 minutes):**

1. **Landing page** (15s) — Show the hero with four feature cards. "This is Academic Copilot — an AI academic advisor that replaces hours of manual degree planning."

2. **Run the audit** (30s) — Click "Try Demo" to load the sample CS student. Expand the profile bar to show the demo student. Click Run Full Audit. Point out the Agent Activity log showing six specialized AI agents working in sequence.

3. **Degree Audit** (45s) — Walk through the progress bar (40.8%). Expand categories to show fulfilled (green) vs unmet (empty circle) requirements. Click "Generate AI Summary" for the Gemini-powered explanation. Point out AP credits are tracked with source attribution.

4. **Graduation Plan** (60s) — This is the wow moment. Show the bottleneck alerts: "CSE 330 is a prerequisite for CSE 485 — delaying it cascades." Show the AP Credit Impact banner: "Your AP credits saved approximately 1.3 semesters." Toggle between Recommended and Accelerated plans. Show the Risk to Graduation Timeline panel.

5. **Schedule Recommendations** (45s) — Show three ranked schedule options with weekly grid previews. Expand #1 to show section details: instructor ratings, meeting times, commute estimates. Point out the AI explanation of why each schedule was ranked.

6. **Calendar Export** (30s) — Switch to Calendar tab. Show the event preview with commute blocks. Click Export. "In production with OAuth configured, these go directly to your Google Calendar."

**Key talking points:**
- Six specialized AI agents, not just a chatbot
- Every recommendation is explainable
- Prerequisite bottleneck detection prevents graduation delays
- Provider/adaptor architecture supports adding more universities

## V1 Scope

This v1 is built specifically for **Arizona State University** with the **Computer Science BS** major. The provider/adaptor architecture allows adding more universities and majors by implementing new providers — no changes to the agent or UI layer needed.

## Future Enhancements

- Real-time ASU class search API integration
- Multi-university support (provider swapping)
- User authentication and persistent profiles
- Rate My Professors live integration
- Course registration cart simulation
- What-if scenario comparisons
- Mobile-responsive design improvements
- Syllabus archive integration
- Waitlist monitoring and alerts
