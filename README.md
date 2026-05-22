# CloudIQ

CloudIQ is a full-stack cloud intelligence dashboard that combines simulated cloud telemetry, risk analytics, AI-assisted recommendations, graph visualization, and an interactive assistant.

## Features

- Cloud resource dashboard with health, utilization, cost, and savings summaries.
- AI assistant with Server-Sent Events streaming and frontend UI command handling.
- Custom AI failover routing from Google Gemini to Groq to local rule-based analytics.
- ChromaDB-backed conversation memory using the default lightweight embedding function.
- Cost anomaly detection, 30-day cost forecasting, and resource risk scoring.
- Recommendation engine for cost, performance, security, and graph-based actions.
- Dependency graph view with blast-radius analysis using `react-force-graph-2d`.
- 3D global infrastructure map using `react-globe.gl`.
- Supabase email/password login on the frontend.
- Deployment configuration for Render backend and Vercel frontend.

## Tech Stack

| Area | Technology |
| --- | --- |
| Backend API | FastAPI, Uvicorn |
| Database | SQLAlchemy, SQLite for local development, Supabase PostgreSQL for production |
| AI primary model | Google Gemini 2.0 Flash |
| AI fallback model | Groq Llama 3 |
| Final fallback | Local rule-based analytics |
| AI routing | Custom bidirectional failover router: Gemini -> Groq -> Local |
| RAG memory | ChromaDB with DefaultEmbeddingFunction |
| Frontend | React 19, Vite, Tailwind CSS |
| Frontend state | Zustand |
| Frontend animation | Framer Motion |
| Visualization | Recharts, D3, react-force-graph-2d, react-globe.gl |
| Auth | Supabase email/password login |
| Deployment | Render for backend, Vercel for frontend |

## Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account
- Gemini API key from `https://aistudio.google.com`
- Groq API key from `https://console.groq.com`

## Backend Setup

1. Open a terminal in the project root.

2. Create and activate a Python virtual environment:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

On macOS or Linux:

```bash
source venv/bin/activate
```

3. Install backend dependencies:

```bash
pip install -r requirements.txt
```

4. Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-8b-8192
DATABASE_URL=sqlite:///./cloudiq.db
DEBUG=false
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

For production, set `DATABASE_URL` to your Supabase PostgreSQL connection string.

5. Start the backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend runs at `http://localhost:8000`, with API docs at `http://localhost:8000/docs`.

## Frontend Setup

1. Open a second terminal in the project root.

2. Install frontend dependencies:

```bash
cd frontend
npm install
```

3. Create `frontend/.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://localhost:8000
```

For local Vite proxy usage, `VITE_BACKEND_URL` can be omitted and `/api/*` requests will proxy to the backend configured in `frontend/vite.config.js`.

4. Start the frontend:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173`.

## Deployment

### Backend on Render

The backend deployment is configured in `render.yaml`.

Render uses:

- `rootDir: backend`
- `buildCommand: pip install -r requirements.txt`
- `startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT`

Set these Render environment variables:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `CORS_ORIGINS`

### Frontend on Vercel

The frontend deployment is configured in `frontend/vercel.json`.

Vercel uses:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Set these Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL`

`VITE_BACKEND_URL` should point to the deployed Render backend URL.

## Useful Commands

Run the backend locally:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Run the frontend locally:

```bash
cd frontend
npm run dev
```

Run frontend linting:

```bash
cd frontend
npm run lint
```

Build the frontend:

```bash
cd frontend
npm run build
```
