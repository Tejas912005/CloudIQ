# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║          CLOUDIQ — COMPLETE OVERHAUL PROMPT                                ║
# ║          Scope: Bugs · Dead Code · Broken Features · UI Polish             ║
# ║          Excludes: API Keys · Deployment Config                            ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

You are a senior software engineer performing a complete overhaul of the CloudIQ project.
Your job is to produce a fresh, clean, fully-working version of this codebase for a college
submission. You must execute every phase below, in order, without skipping any step.

## GROUND RULES — ENFORCE THESE THROUGHOUT

1. Every change must cite the exact file name and line number being modified.
2. Do not introduce new dependencies that are not listed in Phase 1.
3. Do not alter any environment variable names or API key handling.
4. After each phase, verify no new imports were broken.
5. The final project must have zero placeholder responses and zero dead code.
6. Cloud provider connections (AWS/GCP/Azure) require a credit card on all free tiers —
   do NOT add real cloud API calls. Instead, make the existing simulator significantly
   more realistic as described in Phase 6. This is the correct approach for a college demo.

---

## PHASE 1 — DEPENDENCY CLEANUP

### 1A. Add missing real dependencies to `backend/requirements.txt`

Replace the entire file with the following (preserving all existing packages,
adding new ones, and removing the unused `psycopg2-binary`):

```
# CloudIQ Backend Dependencies
# Install: pip install -r requirements.txt --break-system-packages

# ── Web Framework ─────────────────────────────────────────────────
fastapi>=0.111.0
uvicorn[standard]>=0.29.0

# ── Database ──────────────────────────────────────────────────────
sqlalchemy>=2.0.0
pg8000>=1.31.0
# NOTE: psycopg2-binary removed — project uses pg8000 driver exclusively.
# psycopg2-binary was installed but never imported anywhere.

# ── Data / ML ─────────────────────────────────────────────────────
numpy>=1.26.0
scikit-learn>=1.4.0
pandas>=2.2.0
scipy>=1.13.0

# ── Graph Engine ──────────────────────────────────────────────────
networkx>=3.3

# ── AI / Gemini ───────────────────────────────────────────────────
google-genai>=0.7.0

# ── RAG Memory ────────────────────────────────────────────────────
chromadb>=0.5.0

# ── Export Features (newly activated) ────────────────────────────
reportlab>=4.2.0     # PDF generation — pure Python, zero C deps
openpyxl>=3.1.0      # Excel XLSX generation — pure Python

# ── File Upload Extraction (newly activated) ──────────────────────
pypdf>=4.3.0         # PDF text extraction — pure Python
python-docx>=1.1.0   # Word document text extraction

# ── Utilities ─────────────────────────────────────────────────────
python-multipart>=0.0.9
```

---

## PHASE 2 — DELETE ALL DEAD FILES

Delete the following files entirely. They are either unused utilities, unintegrated
test scripts, or committed binary data that should never be in the repo.

### Files to delete from `backend/`:
```
backend/db_check.py           — standalone debug utility, never imported
backend/test_parser.py        — ad-hoc test script, not in any test runner
backend/test_stream.py        — ad-hoc test script, not in any test runner
backend/routers/ai_proxy.py   — never imported in main.py, endpoint is permanently 404;
                                 also requires httpx which is not in requirements.txt
```

### Files to delete from `frontend/src/`:
```
frontend/src/todo_frontend_css.txt  — developer scratch notes committed to src/
```

### Database binary data to untrack from git (do NOT delete the files, just stop tracking):
```bash
git rm --cached backend/cloudiq.db
git rm --cached -r backend/chroma_db/
```
Then add these lines to `backend/.gitignore` if not already present:
```
cloudiq.db
chroma_db/
```

---

## PHASE 3 — REMOVE ALL DUPLICATE AND DEAD CODE

### 3A. Create new shared utility file: `backend/services/shared_utils.py`

The function `_build_context_prompt` is copy-pasted identically in two files:
- `backend/services/gemini_service.py` lines 220–237
- `backend/services/groq_service.py` lines 29–51

Create `backend/services/shared_utils.py` with the single canonical version:

```python
"""
services/shared_utils.py
------------------------
Shared utility functions used by both gemini_service and groq_service.
Centralising here eliminates the duplicate _build_context_prompt that
previously existed in both service files.
"""
import json
from typing import Optional


def build_context_prompt(context_data: Optional[dict]) -> str:
    """
    Build the data-context string injected into every LLM prompt.
    Handles both agent-mode (structured plan results) and simple
    dashboard-data contexts.
    """
    if not context_data:
        return ""

    if context_data.get("AGENT_MODE_WORKFLOW"):
        tools_used   = ", ".join(context_data.get("tools_used", []))
        results_json = json.dumps(context_data.get("results", {}), indent=2, default=str)
        return (
            f"\n\n--- CLOUDIQ SYSTEM DATA ---\n"
            f"Analysis Results:\n{results_json}\n"
            f"Tools Used: {tools_used}\n"
            f"---------------------------\n"
            f"Based on this data, provide a structured response with:\n"
            f"1. Summary  2. Key Findings  3. Recommendations  4. Estimated Impact"
        )

    return (
        f"\n\n[SYSTEM CONTEXT — use this data in your response]:\n"
        f"{json.dumps(context_data, indent=2, default=str)}\n"
    )
```

### 3B. Update `backend/services/gemini_service.py`

1. Remove the private `_build_context_prompt` function (lines 220–237).
2. Add this import at the top of the file (after existing imports):
   ```python
   from services.shared_utils import build_context_prompt as _build_context_prompt
   ```
3. All existing calls to `_build_context_prompt(...)` in gemini_service.py remain
   unchanged — they now resolve to the shared version automatically.

### 3C. Update `backend/services/groq_service.py`

1. Remove the private `_build_context_prompt` function (lines 29–51).
2. Add this import at the top of the file:
   ```python
   from services.shared_utils import build_context_prompt as _build_context_prompt
   ```
3. All existing calls to `_build_context_prompt(...)` remain unchanged.

### 3D. Create new shared utility: `backend/core/intent_utils.py`

The intent-detection keyword logic is duplicated in THREE places:
- `backend/routers/chat.py:27` → `_resolve_intent()`
- `backend/agents/chat_controller.py:183` → inline keyword list
- `backend/services/langchain_router.py` → inline in fast-path check

Create `backend/core/intent_utils.py`:

```python
"""
core/intent_utils.py
--------------------
Single canonical intent resolver for CloudIQ.
Replaces three duplicate keyword-matching implementations that previously
lived in chat.py, chat_controller.py, and langchain_router.py.
"""

# Keywords that should route to the agentic loop (heavy analysis)
AGENT_KEYWORDS = [
    "what if", "simulate", "optimize", "optimize all", "run agent",
    "full analysis", "agent mode", "deep dive", "comprehensive",
    "complete analysis", "audit", "diagnose all",
]

# Keywords that indicate a cloud data intent (analytics, not conversation)
DATA_KEYWORDS = [
    "cost", "spending", "anomal", "predict", "forecast", "risk",
    "resource", "usage", "cpu", "memory", "utilization", "recommend",
    "saving", "efficient", "idle", "over-utilized", "health",
    "security", "graph", "topology", "blast radius", "attack",
]

# Greetings — handled by local fast-path, no LLM needed
GREETING_PHRASES = {
    "hi", "hello", "hey", "hii", "hey there",
    "good morning", "good afternoon", "good evening", "yo",
}

# Identity questions — handled by local fast-path
IDENTITY_PHRASES = [
    "who are you", "what is your name", "what is cloudiq",
    "introduce yourself", "what can you do", "help",
]


def resolve_intent(message: str) -> str:
    """
    Classify a user message into one of the following intent strings:
      "agent_mode"         → triggers the multi-step agentic loop
      "analyze_resources"  → resource health / status queries
      "detect_anomalies"   → anomaly detection queries
      "predict_costs"      → cost forecasting queries
      "predict_resource_risk" → risk scoring queries
      "ui_theme_control"   → theme / UI commands
      "none"               → general conversation
    """
    lower = message.lower().strip()

    if any(kw in lower for kw in AGENT_KEYWORDS):
        return "agent_mode"

    if "theme" in lower or "dark mode" in lower or "light mode" in lower:
        return "ui_theme_control"

    if any(kw in lower for kw in ["anomal", "spike", "unusual", "alert"]):
        return "detect_anomalies"

    if any(kw in lower for kw in ["predict", "forecast", "next month", "future cost"]):
        return "predict_costs"

    if any(kw in lower for kw in ["risk", "blast radius", "attack path", "security"]):
        return "predict_resource_risk"

    if any(kw in lower for kw in ["resource", "cpu", "memory", "idle", "usage", "utiliz"]):
        return "analyze_resources"

    if any(kw in lower for kw in DATA_KEYWORDS):
        return "analyze_resources"

    return "none"
```

### 3E. Update `backend/routers/chat.py`

1. Remove the entire `_resolve_intent()` function (lines 27–37).
2. Remove the module-level import on line 11:
   ```python
   from local_fallback import infer_intent_from_keywords
   ```
3. Add this import near the top of the file (after FastAPI imports):
   ```python
   from core.intent_utils import resolve_intent as _resolve_intent
   ```
4. Everywhere `_resolve_intent(message)` is called, it now uses the canonical version.

### 3F. Update `backend/agents/chat_controller.py`

1. Remove the module-level duplicate import on line 8:
   ```python
   from services.gemini_service import generate_response
   ```
   (This is also imported locally inside the function at line 130 — keep only the
   local import, or move it to module level and remove the local re-import.)
2. Remove the inline keyword list at line 183 and replace the intent-check block with:
   ```python
   from core.intent_utils import resolve_intent
   intent = resolve_intent(message)
   is_complex = intent in {"agent_mode", "analyze_resources", "detect_anomalies",
                           "predict_costs", "predict_resource_risk"}
   ```

### 3G. Update `backend/services/langchain_router.py`

1. Remove the inline `agent_keywords` list in `stream_routed_response`.
2. Import and use the shared resolver:
   ```python
   from core.intent_utils import GREETING_PHRASES, IDENTITY_PHRASES
   ```
3. Replace the `is_greeting` / `is_identity` / `is_help` checks with:
   ```python
   is_greeting = message_lower in GREETING_PHRASES
   is_identity = any(q in message_lower for q in IDENTITY_PHRASES)
   ```

### 3H. Fix `backend/tools.py` — improper DB session management

The current `get_tool_data()` creates its own `SessionLocal()`, bypassing FastAPI's
dependency injection. This can cause a second open transaction during agent loops.

Replace the entire `tools.py` file with:

```python
"""
tools.py
--------
Agent tool resolver for the CloudIQ agentic loop.

FIXED: No longer creates its own SessionLocal(). Instead accepts a db session
passed in from the caller, keeping all operations in the same transaction
as the parent request.
"""
from sqlalchemy.orm import Session
from models.models import CloudResource
from services.anomaly_service import get_full_anomaly_report
from services.prediction_service import predict_costs, predict_resource_risk
from services.recommendation_service import generate_recommendations


def get_tool_data(intent_name: str, db: Session) -> dict:
    """
    Resolve an agent action name to structured service data.
    Accepts the request-scoped db session — does NOT open its own connection.
    """
    try:
        if intent_name == "analyze_resources":
            resources = db.query(CloudResource).all()
            return {
                "total_resources": len(resources),
                "idle_count": sum(1 for r in resources if r.status == "Idle"),
                "over_utilized_count": sum(1 for r in resources if r.status == "Over-Utilized"),
                "healthy_count": sum(1 for r in resources if r.status == "Healthy"),
                "total_monthly_cost": round(sum((r.monthly_cost or 0) for r in resources), 2),
            }
        if intent_name == "detect_anomalies":
            return get_full_anomaly_report(db)
        if intent_name == "predict_costs":
            return predict_costs(db)
        if intent_name == "predict_resource_risk":
            return {"high_risk_resources": predict_resource_risk(db)}
        if intent_name == "generate_recommendations":
            return generate_recommendations(db)
        return {"error": f"Unknown tool: {intent_name}"}
    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}
```

Then update **every call site** of `get_tool_data(intent_name)` to pass the db session:
`get_tool_data(intent_name, db)`. The primary call site is in
`backend/agent_executor.py` — find it and add `db` as a parameter to `execute_plan()`
as well, threading the session through from `chat_controller._run_agent_loop(db=db)`.

---

## PHASE 4 — FIX ALL CONFIRMED BUGS

### 4A. Fix double full-table scan in `backend/routers/graph.py` (lines 155–156)

**Current broken code:**
```python
uid_map  = {r.id: r.resource_uid for r in db.query(CloudResource).all()}  # scan 1
name_map = {r.id: r.name for r in db.query(CloudResource).all()}          # scan 2 — REDUNDANT
```

**Replace with:**
```python
_all_resources = db.query(CloudResource).all()   # single scan
uid_map  = {r.id: r.resource_uid for r in _all_resources}
name_map = {r.id: r.name         for r in _all_resources}
```
Apply the same pattern to lines 73–74 in the same file:
```python
# BEFORE (two scans)
connections = db.query(ResourceConnection).all()
uid_map = {r.id: r.resource_uid for r in db.query(CloudResource).all()}

# AFTER (one scan)
connections   = db.query(ResourceConnection).all()
_res_all      = db.query(CloudResource).all()
uid_map       = {r.id: r.resource_uid for r in _res_all}
```

### 4B. Fix `build_graph` called twice in `get_graph()` — `backend/routers/graph.py` lines 42–45

`compute_risk_analysis(db)` internally calls `build_graph(db)`.
Then `build_graph(db)` is called AGAIN on line 45.

**Replace the body of `get_graph()` with:**
```python
@router.get("", response_model=GraphResponse, dependencies=[Depends(verify_api_key)])
def get_graph(db: Session = Depends(get_db)):
    try:
        # Build the graph ONCE and reuse for both risk analysis and node construction
        G        = build_graph(db)
        stats    = get_graph_stats(G)
        risk_data = compute_risk_analysis(db, graph=G)   # pass graph to avoid rebuild
        risk_map = {r["id"]: r for r in risk_data}

        nodes = []
        for node_id in G.nodes:
            attrs  = G.nodes[node_id]
            r_data = risk_map.get(node_id, {})
            nodes.append(GraphNode(
                id            = node_id,
                name          = attrs.get("name", ""),
                resource_uid  = attrs.get("resource_uid", str(node_id)),
                resource_type = attrs.get("resource_type", ""),
                provider      = attrs.get("provider", "AWS"),
                region        = attrs.get("region", ""),
                risk_score    = r_data.get("risk_score", attrs.get("risk_score", 0)),
                risk_level    = r_data.get("risk_level", "Low"),
                status        = attrs.get("status", "Healthy"),
                monthly_cost  = attrs.get("monthly_cost", 0),
                cpu_usage     = attrs.get("cpu_usage", 0),
                public_access = attrs.get("public_access", False),
                sensitivity   = attrs.get("sensitivity", "Low"),
            ))

        edges = [
            GraphEdge(source=u, target=v, weight=d.get("risk_weight", 1.0),
                      connection_type=d.get("connection_type", "network"))
            for u, v, d in G.edges(data=True)
        ]

        return GraphResponse(nodes=nodes, edges=edges, stats=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Also update `compute_risk_analysis` in `backend/services/graph_service.py` to accept
an optional `graph=None` parameter:
```python
def compute_risk_analysis(db: Session, graph=None) -> list:
    G = graph if graph is not None else build_graph(db)
    # ... rest of function unchanged
```

### 4C. Fix N+1 INSERTs in `backend/services/recommendation_service.py` (lines 196–212)

**Current broken code:**
```python
db.query(Recommendation).delete()
for rec in all_recs:
    db.add(Recommendation(...))   # one INSERT per recommendation — N+1
db.commit()
```

**Replace with bulk insert:**
```python
db.query(Recommendation).delete()
if all_recs:
    db.bulk_insert_mappings(
        Recommendation,
        [
            dict(
                resource_id        = db.query(CloudResource)
                                       .filter(CloudResource.name == rec["resource_name"])
                                       .with_entities(CloudResource.id)
                                       .scalar(),
                resource_name      = rec["resource_name"],
                action             = rec["action"],
                reason             = rec["reason"],
                priority           = rec["priority"],
                estimated_savings  = rec.get("estimated_savings", 0.0),
                category           = rec.get("category", "cost"),
            )
            for rec in all_recs
        ]
    )
db.commit()
```

### 4D. Fix `Math.random()` in `Globe.jsx` (line 108)

Arc animations are inconsistent on every re-render because the initial gap is random.

**Current broken code:**
```jsx
arcDashInitialGap={() => Math.random() * 5}
```

**Replace with a deterministic index-based value:**
```jsx
arcDashInitialGap={(_arc, index) => (index * 1.618) % 5}
```
This uses the golden ratio to spread arcs deterministically — visually varied but
consistent across re-renders.

### 4E. Fix hardcoded initial dimensions in `GraphView.jsx` (line 80)

**Current broken code:**
```jsx
const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
```
This causes a 900px-wide layout flash before the ResizeObserver fires.

**Replace with:**
```jsx
const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
```
Then in the graph render block, add a guard:
```jsx
{dimensions.width > 0 && (
  <ForceGraph2D
    width={dimensions.width}
    height={dimensions.height}
    ...
  />
)}
```

### 4F. Replace ALL hardcoded hex colors with CSS variables

#### In `frontend/src/pages/Globe.jsx` (line 48):
```jsx
// BEFORE
color: r.risk > 10 ? '#ef4444' : '#22c55e',

// AFTER — read the CSS variable values once at module level
const CSS = typeof getComputedStyle !== 'undefined'
  ? getComputedStyle(document.documentElement)
  : null;
const COLOR_DANGER  = CSS ? CSS.getPropertyValue('--danger').trim()  : '#ef4444';
const COLOR_SUCCESS = CSS ? CSS.getPropertyValue('--success').trim() : '#22c55e';
```
Then use `COLOR_DANGER` and `COLOR_SUCCESS` in the arcs and markers.

#### In `frontend/src/pages/GraphView.jsx` (lines 7–9):
```jsx
// BEFORE
const RISK_COLORS = {
  High:   { bg: '#ef4444', border: '#b91c1c', text: '#fff', glow: 'rgba(239,68,68,0.5)' },
  Medium: { bg: '#f59e0b', border: '#b45309', text: '#000', glow: 'rgba(245,158,11,0.4)' },
  Low:    { bg: '#22c55e', border: '#15803d', text: '#fff', glow: 'rgba(34,197,94,0.4)' },
};

// AFTER — resolve from CSS variables at component mount
function getRiskColors() {
  const s = typeof getComputedStyle !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null;
  const danger  = s?.getPropertyValue('--danger').trim()  ?? '#ef4444';
  const warning = s?.getPropertyValue('--warning').trim() ?? '#f59e0b';
  const success = s?.getPropertyValue('--success').trim() ?? '#22c55e';
  return {
    High:   { bg: danger,   border: danger,   text: '#fff', glow: `${danger}80`   },
    Medium: { bg: warning,  border: warning,  text: '#000', glow: `${warning}66`  },
    Low:    { bg: success,  border: success,  text: '#fff', glow: `${success}66`  },
  };
}
const RISK_COLORS = getRiskColors();
```

Also replace line 128:
```jsx
// BEFORE
<div className="flex items-center justify-center h-64" style={{ color: '#ef4444' }}>
// AFTER
<div className="flex items-center justify-center h-64" style={{ color: 'var(--danger)' }}>
```
Replace lines 155, 326 similarly using `var(--danger)` and `var(--success)`.

#### In `frontend/src/pages/Predictions.jsx` (line 30):
```jsx
// BEFORE
background: '#0a1628',
// AFTER
background: 'var(--bg-surface)',
```

---

## PHASE 5 — IMPLEMENT ALL BROKEN FEATURES

### 5A. Implement PDF Export — `backend/routers/exports.py`

Replace the entire file:

```python
"""
backend/routers/exports.py
--------------------------
Export endpoints: PDF dashboard report and Excel workbook.
Both are now fully implemented using reportlab (PDF) and openpyxl (Excel).
"""

from __future__ import annotations
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from core.auth import verify_api_key
from core.database import get_db
from models.models import CloudResource, CostHistory, Recommendation, AnomalyRecord

router = APIRouter(prefix="/api", tags=["Exports"])


@router.post("/export/pdf", dependencies=[Depends(verify_api_key)])
def export_pdf(db: Session = Depends(get_db)):
    """
    Generate a PDF dashboard report containing:
    - Executive summary (resource counts, total cost, health breakdown)
    - Top 10 resources by monthly cost
    - Active recommendations
    - Recent cost anomalies
    """
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer,
            Table, TableStyle, HRFlowable,
        )

        # ── Fetch data ────────────────────────────────────────────
        resources    = db.query(CloudResource).all()
        recs         = db.query(Recommendation).order_by(Recommendation.priority).limit(10).all()
        anomalies    = db.query(AnomalyRecord).limit(10).all()
        cost_history = db.query(CostHistory).order_by(CostHistory.date.desc()).limit(7).all()

        total_cost  = round(sum(r.monthly_cost or 0 for r in resources), 2)
        idle_count  = sum(1 for r in resources if r.status == "Idle")
        over_count  = sum(1 for r in resources if r.status == "Over-Utilized")
        healthy     = len(resources) - idle_count - over_count
        top_cost    = sorted(resources, key=lambda r: r.monthly_cost or 0, reverse=True)[:10]

        # ── Document setup ────────────────────────────────────────
        buf  = io.BytesIO()
        doc  = SimpleDocTemplate(buf, pagesize=A4,
                                 leftMargin=2*cm, rightMargin=2*cm,
                                 topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        story  = []

        # Header
        H1 = ParagraphStyle("H1", parent=styles["Title"],
                             fontSize=22, textColor=colors.HexColor("#63b2ff"),
                             spaceAfter=4)
        H2 = ParagraphStyle("H2", parent=styles["Heading2"],
                             fontSize=13, textColor=colors.HexColor("#63b2ff"),
                             spaceBefore=12, spaceAfter=4)
        BODY = ParagraphStyle("BODY", parent=styles["Normal"],
                              fontSize=9, textColor=colors.HexColor("#94a3b8"))
        generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        story.append(Paragraph("☁  CloudIQ Dashboard Report", H1))
        story.append(Paragraph(f"Generated: {generated}", BODY))
        story.append(HRFlowable(width="100%", thickness=1,
                                color=colors.HexColor("#1e3a5f"), spaceAfter=12))

        # Executive Summary
        story.append(Paragraph("Executive Summary", H2))
        summary_data = [
            ["Metric", "Value"],
            ["Total Resources",       str(len(resources))],
            ["Healthy",               str(healthy)],
            ["Idle (waste candidate)", str(idle_count)],
            ["Over-Utilized",         str(over_count)],
            ["Total Monthly Cost",    f"${total_cost:,.2f}"],
        ]
        story.append(_make_table(summary_data))
        story.append(Spacer(1, 0.4*cm))

        # Top 10 Resources by Cost
        story.append(Paragraph("Top 10 Resources by Monthly Cost", H2))
        res_data = [["Name", "Type", "Region", "Status", "Monthly Cost"]]
        for r in top_cost:
            res_data.append([
                r.name, r.resource_type, r.region,
                r.status, f"${r.monthly_cost:,.2f}"
            ])
        story.append(_make_table(res_data))
        story.append(Spacer(1, 0.4*cm))

        # Recommendations
        if recs:
            story.append(Paragraph("Active Recommendations", H2))
            rec_data = [["Resource", "Action", "Priority", "Est. Savings"]]
            for r in recs:
                savings = f"${r.estimated_savings:,.2f}" if r.estimated_savings else "—"
                rec_data.append([r.resource_name, r.action[:60], r.priority, savings])
            story.append(_make_table(rec_data))
            story.append(Spacer(1, 0.4*cm))

        # Recent Cost History
        if cost_history:
            story.append(Paragraph("Recent Daily Cost (Last 7 Days)", H2))
            hist_data = [["Date", "Daily Cost", "Anomaly"]]
            for ch in reversed(cost_history):
                hist_data.append([
                    ch.date,
                    f"${ch.daily_cost:,.2f}",
                    "⚠ Yes" if ch.is_anomaly else "✓ No",
                ])
            story.append(_make_table(hist_data))

        doc.build(story)
        buf.seek(0)
        return Response(
            content=buf.read(),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=cloudiq_report.pdf"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


def _make_table(data: list) -> "Table":
    """Helper: styled table for PDF output."""
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors

    t = Table(data, hAlign="LEFT")
    style = TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  colors.HexColor("#0d2137")),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.HexColor("#63b2ff")),
        ("FONTSIZE",    (0, 0), (-1, 0),  9),
        ("FONTSIZE",    (0, 1), (-1, -1), 8),
        ("TEXTCOLOR",   (0, 1), (-1, -1), colors.HexColor("#94a3b8")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.HexColor("#0a1628"), colors.HexColor("#0d1f38")]),
        ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#1e3a5f")),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ])
    t.setStyle(style)
    return t


@router.post("/export/xlsx", dependencies=[Depends(verify_api_key)])
def export_xlsx(db: Session = Depends(get_db)):
    """
    Generate an Excel workbook with four sheets:
    - Resources (all columns)
    - Cost History (90-day series)
    - Recommendations
    - Anomalies
    """
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        resources    = db.query(CloudResource).all()
        cost_history = db.query(CostHistory).order_by(CostHistory.date).all()
        recs         = db.query(Recommendation).all()
        anomalies    = db.query(AnomalyRecord).all()

        wb = openpyxl.Workbook()

        # ── Styling helpers ───────────────────────────────────────
        HDR_FILL  = PatternFill("solid", fgColor="0D2137")
        HDR_FONT  = Font(bold=True, color="63B2FF", size=10)
        EVEN_FILL = PatternFill("solid", fgColor="0A1628")
        ODD_FILL  = PatternFill("solid", fgColor="0D1F38")
        DATA_FONT = Font(color="94A3B8", size=9)
        CENTER    = Alignment(horizontal="center", vertical="center", wrap_text=True)
        THIN_BORDER = Border(
            left=Side(style="thin", color="1E3A5F"),
            right=Side(style="thin", color="1E3A5F"),
            top=Side(style="thin", color="1E3A5F"),
            bottom=Side(style="thin", color="1E3A5F"),
        )

        def write_sheet(ws, headers, rows):
            ws.append(headers)
            for col_num, _ in enumerate(headers, 1):
                cell = ws.cell(row=1, column=col_num)
                cell.fill   = HDR_FILL
                cell.font   = HDR_FONT
                cell.alignment = CENTER
                cell.border = THIN_BORDER
                ws.column_dimensions[get_column_letter(col_num)].width = 18
            for r_idx, row in enumerate(rows, 2):
                ws.append(row)
                fill = EVEN_FILL if r_idx % 2 == 0 else ODD_FILL
                for c_idx in range(1, len(row) + 1):
                    cell = ws.cell(row=r_idx, column=c_idx)
                    cell.fill   = fill
                    cell.font   = DATA_FONT
                    cell.border = THIN_BORDER

        # Sheet 1: Resources
        ws1 = wb.active
        ws1.title = "Resources"
        write_sheet(ws1,
            ["Name", "UID", "Type", "Provider", "Region", "Status",
             "CPU%", "Mem%", "Monthly Cost ($)", "Risk Score", "Public"],
            [[r.name, r.resource_uid, r.resource_type, r.provider, r.region,
              r.status, round(r.cpu_usage or 0, 1), round(r.memory_usage or 0, 1),
              round(r.monthly_cost or 0, 2), round(r.risk_score or 0, 2),
              "Yes" if r.public_access else "No"] for r in resources]
        )

        # Sheet 2: Cost History
        ws2 = wb.create_sheet("Cost History")
        write_sheet(ws2,
            ["Date", "Daily Cost ($)", "Anomaly"],
            [[ch.date, round(ch.daily_cost, 2),
              "Yes" if ch.is_anomaly else "No"] for ch in cost_history]
        )

        # Sheet 3: Recommendations
        ws3 = wb.create_sheet("Recommendations")
        write_sheet(ws3,
            ["Resource", "Action", "Priority", "Category", "Est. Savings ($)", "Reason"],
            [[r.resource_name, r.action, r.priority, r.category or "cost",
              round(r.estimated_savings or 0, 2), r.reason] for r in recs]
        )

        # Sheet 4: Anomalies
        if anomalies:
            ws4 = wb.create_sheet("Anomalies")
            write_sheet(ws4,
                ["Resource ID", "Type", "Score", "Description", "Detected At"],
                [[a.resource_id, a.anomaly_type if hasattr(a, "anomaly_type") else "cost",
                  round(a.score if hasattr(a, "score") else 0, 2),
                  a.description if hasattr(a, "description") else "",
                  str(a.detected_at if hasattr(a, "detected_at") else "")
                  ] for a in anomalies]
            )

        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return Response(
            content=buf.read(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=cloudiq_export.xlsx"},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")
```

### 5B. Implement File Upload Text Extraction — `backend/routers/upload.py`

Replace the entire file:

```python
"""
backend/routers/upload.py
--------------------------
POST /api/assistant/upload
Upload a document or image, extract its text, and return it for use in the chat pipeline.

Supported types:
  .pdf          → text extraction via pypdf
  .docx         → text extraction via python-docx
  .txt .md .csv .json → read directly as UTF-8
  images (jpg/png/gif/webp) → description placeholder (routed to Gemini vision)
  other         → metadata-only response
"""
from __future__ import annotations
import io
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from core.auth import verify_api_key

router = APIRouter(prefix="/api", tags=["Assistant Upload"])

# Accepted MIME types for text extraction
TEXT_MIMES = {
    "text/plain", "text/markdown", "text/csv",
    "application/json", "application/xml",
}
IMAGE_MIMES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
}


@router.post("/assistant/upload", dependencies=[Depends(verify_api_key)])
async def upload(file: UploadFile = File(...)):
    filename  = file.filename or "uploaded_file"
    mime_type = file.content_type or "application/octet-stream"
    raw_bytes = await file.read()

    extracted_text = _extract_text(filename, mime_type, raw_bytes)

    return {
        "filename":       filename,
        "mime_type":      mime_type,
        "size_bytes":     len(raw_bytes),
        "extracted_text": extracted_text,
    }


def _extract_text(filename: str, mime_type: str, data: bytes) -> str:
    """Route to the correct extractor based on mime type and file extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # ── PDF ──────────────────────────────────────────────────────────────────
    if mime_type == "application/pdf" or ext == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            pages  = [p.extract_text() or "" for p in reader.pages]
            text   = "\n\n".join(p.strip() for p in pages if p.strip())
            if not text:
                return "[PDF uploaded but contained no extractable text — may be scanned/image-based]"
            return text[:8000]  # cap at 8K chars for prompt safety
        except Exception as e:
            return f"[PDF received but extraction failed: {str(e)}]"

    # ── Word Document ─────────────────────────────────────────────────────────
    if mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ) or ext in ("docx", "doc"):
        try:
            from docx import Document
            doc  = Document(io.BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            if not text:
                return "[Word document uploaded but contained no extractable text]"
            return text[:8000]
        except Exception as e:
            return f"[Word document received but extraction failed: {str(e)}]"

    # ── Plain Text / JSON / CSV / Markdown ────────────────────────────────────
    if mime_type in TEXT_MIMES or ext in ("txt", "md", "csv", "json", "xml", "log"):
        try:
            text = data.decode("utf-8", errors="replace")
            return text[:8000]
        except Exception:
            return "[Text file received but could not be decoded]"

    # ── Images ────────────────────────────────────────────────────────────────
    if mime_type in IMAGE_MIMES or ext in ("jpg", "jpeg", "png", "gif", "webp"):
        return (
            f"[Image file uploaded: {filename} ({len(data) // 1024}KB). "
            "The AI assistant will analyse its visual content directly.]"
        )

    # ── Fallback ──────────────────────────────────────────────────────────────
    return (
        f"[File received: {filename} ({mime_type}, {len(data) // 1024}KB). "
        "Direct text extraction is not supported for this file type. "
        "Describe its contents to the assistant for analysis.]"
    )
```

### 5C. Add RAG Memory Retrieval to Non-Streaming Chat Path

Currently `backend/services/gemini_service.py`'s `generate_response()` function
(line 78) makes zero calls to RAG memory. Non-streaming chat has no conversation memory.

In `backend/services/gemini_service.py`, update `generate_response()`:

```python
def generate_response(
    message: str,
    history: list,
    context_data: Optional[dict] = None,
) -> dict:
    """Non-streaming response — NOW with RAG memory retrieval."""
    from services import rag_memory                        # add this import

    # Retrieve relevant past interactions
    try:
        past_interactions = rag_memory.retrieve_relevant_history(message, n_results=3)
        rag_text = (
            "\n\n[MEMORY — Relevant past interactions]:\n" +
            "\n---\n".join(past_interactions)
            if past_interactions else ""
        )
    except Exception:
        rag_text = ""

    # ... rest of the existing function ...
    # After building context_prompt, append rag_text:
    context_prompt = _build_context_prompt(context_data) + rag_text
    # ... continue with the existing Gemini call ...

    # After receiving the response, store the interaction:
    try:
        rag_memory.store_interaction(message, response_text)
    except Exception:
        pass

    return {"response": response_text, "status": "success"}
```

---

## PHASE 6 — ENHANCE THE SIMULATOR FOR A REALISTIC DEMO

Real AWS/GCP/Azure APIs require a credit card even on free tiers. The simulator is
the correct approach for a college submission. Make it significantly more realistic.

Update `backend/data/simulator.py` with the following improvements:

### 6A. Add realistic daily/weekly cost seasonality

Replace the flat daily cost generation with a seasonality curve:
```python
import math
from datetime import datetime, timedelta

def generate_cost_history(days: int = 90) -> list:
    """
    Generate 90-day cost history with realistic patterns:
    - Weekly seasonality: lower on weekends
    - Monthly drift: slight upward trend
    - Random daily variance: ±8%
    - Occasional spikes: 2-3 per month (simulate traffic events)
    """
    import random
    history = []
    base_cost = 347.50  # starting daily spend
    spike_days = random.sample(range(days), k=max(2, days // 30 * 2))

    for i in range(days):
        date  = (datetime.utcnow() - timedelta(days=days - i)).strftime("%Y-%m-%d")
        # Upward trend: +0.5% per week
        trend = base_cost * (1 + 0.005 * (i / 7))
        # Weekly seasonality: weekends cost 20% less (lower traffic)
        day_of_week = (datetime.utcnow() - timedelta(days=days - i)).weekday()
        seasonal = 0.80 if day_of_week >= 5 else 1.0
        # Random variance ±8%
        variance  = random.uniform(0.92, 1.08)
        # Traffic spike events
        spike     = random.uniform(1.4, 2.1) if i in spike_days else 1.0

        daily_cost = round(trend * seasonal * variance * spike, 2)
        is_anomaly = 1 if spike > 1.3 else 0
        history.append({"date": date, "daily_cost": daily_cost, "is_anomaly": is_anomaly})

    return history
```

### 6B. Add provider diversity to resources

The simulator should generate resources across AWS, GCP, and Azure, with realistic
regional distribution. Add to the resource generation:

```python
PROVIDERS = ["AWS", "GCP", "Azure"]
REGIONS = {
    "AWS":   ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1", "ca-central-1"],
    "GCP":   ["us-central1", "europe-west1", "asia-east1", "us-east4"],
    "Azure": ["eastus", "westeurope", "southeastasia", "canadacentral"],
}
RESOURCE_TYPES_BY_PROVIDER = {
    "AWS":   ["EC2", "RDS", "S3", "Lambda", "EKS", "ElastiCache", "CloudFront"],
    "GCP":   ["Compute Engine", "Cloud SQL", "GCS", "Cloud Run", "GKE", "Firestore"],
    "Azure": ["VM", "Azure SQL", "Blob Storage", "Functions", "AKS", "Cosmos DB"],
}
```
Assign each simulated resource a random provider, matching region, and matching
resource type. This makes the dashboard show a realistic multi-cloud environment.

### 6C. Add latency and traffic simulation

For each resource, simulate correlated metrics — high CPU resources should also
have higher traffic and latency:

```python
def simulate_resource_metrics(status: str) -> dict:
    import random
    if status == "Over-Utilized":
        cpu     = random.uniform(82, 98)
        mem     = random.uniform(78, 96)
        latency = random.uniform(280, 850)
        traffic = random.uniform(180, 420)
        error   = random.uniform(2.5, 8.0)
    elif status == "Idle":
        cpu     = random.uniform(1, 8)
        mem     = random.uniform(5, 18)
        latency = random.uniform(8, 35)
        traffic = random.uniform(0.1, 3)
        error   = random.uniform(0, 0.3)
    else:  # Healthy
        cpu     = random.uniform(22, 68)
        mem     = random.uniform(28, 72)
        latency = random.uniform(40, 150)
        traffic = random.uniform(15, 120)
        error   = random.uniform(0.1, 1.2)
    return dict(
        cpu_usage=round(cpu, 1), memory_usage=round(mem, 1),
        latency_ms=round(latency, 1), traffic_rps=round(traffic, 1),
        error_rate=round(error, 2),
    )
```

---

## PHASE 7 — ERROR HANDLING CONSISTENCY

All FastAPI endpoints currently return errors in two incompatible formats.
Standardise to one format everywhere.

### 7A. Define a standard error schema in `backend/schemas/schemas.py`

Add this class to the existing schemas file:
```python
class ErrorResponse(BaseModel):
    status:  str = "error"
    message: str
    detail:  str = ""
```

### 7B. Update all route error handlers to return `ErrorResponse`

Find every `except` block in every router that currently does either:
- `raise HTTPException(status_code=500, detail=str(e))`
- `return {"status": "error", "message": ...}`

Standardise all of them to:
```python
except Exception as e:
    raise HTTPException(
        status_code=500,
        detail={"status": "error", "message": "Internal server error", "detail": str(e)}
    )
```

---

## PHASE 8 — UI / DESIGN POLISH

### 8A. Add a proper CSS variable for JS-readable colours

In `frontend/src/index.css`, add these to the `:root` block:
```css
:root {
  /* existing tokens ... */

  /* JS-readable semantic colours — also referenced by Globe and GraphView */
  --danger-hex:  #ef4444;
  --warning-hex: #f59e0b;
  --success-hex: #22c55e;

  /* Tooltip background (used by Predictions recharts tooltip) */
  --bg-tooltip: #0a1628;
}
```
This makes the CSS values officially part of the design system rather than
scattered magic strings.

### 8B. Clean up `frontend/src/pages/Predictions.jsx` tooltip

Replace the inline `style={{ background: '#0a1628' }}` on the CustomTooltip with:
```jsx
style={{
  background: 'var(--bg-tooltip)',
  border: '1px solid rgba(99, 178, 255, 0.2)',
  borderRadius: '8px',
  padding: '10px 14px',
}}
```

### 8C. Remove stale legacy route comments from `backend/routers/legacy.py`

The comment block at line 35:
```python
# generate_recommendations() causes delete+reinsert race condition
```
Remove this comment and implement the fix from Bug-4C above, then remove the comment.
Also remove the `# Phase 1` and `# LEGACY` documentary comments scattered throughout
the file — they are historical scaffolding that clutters production code.

### 8D. Improve loading state messaging across all 9 pages

Every page calls `useCloudIQ()` for data. Some pages show a generic "Loading..."
message. Update each page's loading state to show a specific, contextual message:

- Dashboard → `"Loading your cloud overview..."`
- Assistant → `"Initialising AI assistant..."` (already good)
- Insights → `"Analysing cost data..."`
- Recommendations → `"Computing savings opportunities..."`
- Activity → (no async call — uses cached store data, no change needed)
- GraphView → `"Building dependency graph..."`
- Globe → `"Mapping global infrastructure..."`
- Resources → `"Fetching resource inventory..."`
- Predictions → `"Running cost forecast..."`

---

## PHASE 9 — ADD BASIC TESTS

The project has zero tests. Add a minimal pytest suite so the project
demonstrates testing awareness.

Create `backend/tests/__init__.py` (empty).

Create `backend/tests/test_intent_utils.py`:
```python
"""
tests/test_intent_utils.py
--------------------------
Unit tests for the canonical intent resolver.
Run: pytest backend/tests/
"""
import pytest
from core.intent_utils import resolve_intent


def test_agent_mode_keywords():
    assert resolve_intent("what if I resize all EC2 instances") == "agent_mode"
    assert resolve_intent("simulate a 50% cost reduction") == "agent_mode"
    assert resolve_intent("optimize everything") == "agent_mode"


def test_theme_control():
    assert resolve_intent("switch to dark mode") == "ui_theme_control"
    assert resolve_intent("change theme to light") == "ui_theme_control"


def test_anomaly_intent():
    assert resolve_intent("show me any cost spikes") == "detect_anomalies"
    assert resolve_intent("are there any unusual alerts?") == "detect_anomalies"


def test_prediction_intent():
    assert resolve_intent("forecast my costs next month") == "predict_costs"
    assert resolve_intent("predict future spending") == "predict_costs"


def test_general_conversation():
    assert resolve_intent("what is the weather today") == "none"
    assert resolve_intent("tell me a joke") == "none"
```

Create `backend/tests/test_shared_utils.py`:
```python
"""tests/test_shared_utils.py"""
from services.shared_utils import build_context_prompt


def test_empty_context():
    assert build_context_prompt(None) == ""
    assert build_context_prompt({}) == ""


def test_agent_mode_context():
    result = build_context_prompt({
        "AGENT_MODE_WORKFLOW": True,
        "tools_used": ["analyze_resources"],
        "results": {"total_resources": 42},
    })
    assert "CLOUDIQ SYSTEM DATA" in result
    assert "analyze_resources" in result
    assert "42" in result


def test_simple_context():
    result = build_context_prompt({"total_cost": 1234.56})
    assert "SYSTEM CONTEXT" in result
    assert "1234.56" in result
```

Add `pytest>=8.0.0` to `backend/requirements.txt`.

---

## PHASE 10 — FINAL VERIFICATION CHECKLIST

After completing all phases, verify the following before submitting:

- [ ] `backend/db_check.py` does not exist
- [ ] `backend/test_parser.py` does not exist
- [ ] `backend/test_stream.py` does not exist
- [ ] `backend/routers/ai_proxy.py` does not exist
- [ ] `frontend/src/todo_frontend_css.txt` does not exist
- [ ] `backend/services/shared_utils.py` exists and exports `build_context_prompt`
- [ ] `backend/core/intent_utils.py` exists and exports `resolve_intent`
- [ ] `backend/tools.py` accepts `db: Session` and does NOT call `SessionLocal()`
- [ ] `backend/requirements.txt` has NO `psycopg2-binary` entry
- [ ] `backend/requirements.txt` HAS `reportlab`, `openpyxl`, `pypdf`, `python-docx`, `pytest`
- [ ] `POST /api/export/pdf` returns a binary PDF, not an error JSON
- [ ] `POST /api/export/xlsx` returns a binary XLSX, not an error JSON
- [ ] `POST /api/assistant/upload` with a `.txt` file returns the file's text content
- [ ] `POST /api/assistant/upload` with a `.pdf` file returns extracted page text
- [ ] `POST /api/chat` (non-streaming) now retrieves RAG memory context
- [ ] `Globe.jsx` has no `Math.random()` calls in arc animation props
- [ ] `GraphView.jsx` initial dimensions are `{ width: 0, height: 0 }` not 900×600
- [ ] No file in `frontend/src/pages/` contains a raw hex color string (`#xxxxxx`)
   (except in comments)
- [ ] `backend/tests/test_intent_utils.py` runs with `pytest backend/tests/` and passes
- [ ] `build_graph` is called exactly ONCE per request in `get_graph()`
- [ ] `db.query(CloudResource).all()` appears at most once per request in `graph.py`
- [ ] The simulator generates resources across AWS, GCP, and Azure
- [ ] All 9 pages have specific, contextual loading state messages

---

## WHAT NOT TO DO

- Do NOT add real AWS/GCP/Azure SDK calls (boto3, google-cloud-*, azure-*).
  All three require a credit card even on free tiers. The enhanced simulator
  is the correct approach for a college demo.
- Do NOT remove the Supabase auth code even though it is currently disconnected
  from the backend — the frontend login/logout flow is a valid portfolio feature.
- Do NOT add more Gemini agent tools beyond the current 4 without also updating
  the agent planner's system prompt to describe the new tools.
- Do NOT change any environment variable names.
- Do NOT alter `core/auth.py` or `core/config.py`.

---

## EXPECTED OUTCOME

After executing all 10 phases, the CloudIQ project will have:

1. **Zero dead code** — every file imported, every function called
2. **Zero placeholder responses** — every endpoint returns real data
3. **Zero duplicate logic** — one canonical intent resolver, one context builder
4. **Working PDF export** — professional styled report with resource table,
   cost history, and recommendations
5. **Working Excel export** — four-sheet workbook with full data
6. **Working file upload** — real text extraction for PDF, DOCX, and text files
7. **Full RAG memory** — both streaming AND non-streaming paths store and
   retrieve conversation history
8. **Deterministic globe animations** — no random layout changes on re-render
9. **No CSS layout flash** — GraphView starts with 0×0 dimensions, not 900×600
10. **Design-system-consistent colors** — all hex strings replaced with CSS variables
11. **Realistic multi-cloud simulator** — AWS, GCP, and Azure resources with
    correlated metrics and seasonal cost patterns
12. **Basic test suite** — pytest suite covering intent resolver and shared utils
13. **Single error schema** — all endpoints return the same error structure
```
