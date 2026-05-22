## CloudIQ Frontend

CloudIQ is a React + Vite dashboard for exploring simulated cloud infrastructure data from the Python backend.

## Features

- Summary dashboard for resource health, monthly cost, anomalies, and recommendations
- Resource inventory with search and status filtering
- Cost history charts with anomaly detection
- Cost forecasting and resource risk scoring
- Recommendation review workflow
- AI chatbot backed by the local API

## Local Development

Start the backend first so the frontend can reach the seeded API:

```bash
cd backend
python app.py
```

Then start the Vite development server:

```bash
cd frontend
npm install
npm run dev
```

The Vite server runs on `http://localhost:5173` and proxies `/api/*` requests to `http://localhost:5000`.

## Quality Check

Run the frontend linter:

```bash
cd frontend
npm run lint
```
