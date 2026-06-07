# CloudIQ Incremental Roadmap

## Step 0 — Baseline validation
- [x] Verify demo scenario: ask assistant “stop risky/unhealthy resources” triggers execution card and mutates demo DB.


## Step 1 — Document + Image ingestion (upload → analyze)
- [ ] Backend: add `/api/assistant/upload` endpoint (multipart/form-data).
- [ ] Backend: extract text from docs (PDF/DOCX where possible) + OCR for images (TBD deps).
- [ ] Backend: pipe extracted text into existing Gemini/local pipeline and return answer via `/api/chat/stream`.
- [ ] Frontend: add upload UI to Assistant.jsx (files + drag/drop).

## Step 2 — PDF + Excel export
- [ ] Backend: add `/api/export/pdf` endpoint.
- [ ] Backend: add `/api/export/xlsx` endpoint.
- [ ] Frontend: in Assistant action system, support `export_pdf` / `export_xlsx` actions with downloadable links.

## Step 3 — Safer “UI control” expansion
- [ ] Introduce a tool/action registry (single source of truth for allowed tools).
- [ ] Add “query platform data” tool(s) (only whitelisted endpoints).
- [ ] Add “generate report from current page data” tool.

## Step 4 — Polish
- [ ] Improve Insights/KPIs (takeaways) and Predictions/Resources top offenders sections.

