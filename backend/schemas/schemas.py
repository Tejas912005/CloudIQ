"""
schemas/schemas.py
------------------
Pydantic v2 request/response schemas for all CloudIQ endpoints.
Provides type safety, auto-validation, and OpenAPI documentation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


# ══════════════════════════════════════════════════════════════════
#  CHAT
# ══════════════════════════════════════════════════════════════════
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4096, description="User message to the AI assistant")

class ChatResponse(BaseModel):
    response: str
    intent:   str = "none"
    status:   str = "ok"           # ok | error
    mode:     str = "local_fallback"  # gemini | local_fallback


# ══════════════════════════════════════════════════════════════════
#  ANALYZE  (/api/analyze)
# ══════════════════════════════════════════════════════════════════
class ResourceSummary(BaseModel):
    total_resources:      int
    idle_count:           int
    over_utilized_count:  int
    healthy_count:        int
    total_monthly_cost:   float

class GraphStats(BaseModel):
    total_nodes:          int
    total_edges:          int
    avg_risk_score:       float
    high_risk_nodes:      int
    connected_components: int
    density:              float

class AnomalySummary(BaseModel):
    total_anomaly_days:   int
    mean_cost:            float
    std_cost:             float

class AnalyzeResponse(BaseModel):
    resources:   ResourceSummary
    graph:       GraphStats
    anomalies:   AnomalySummary
    timestamp:   str


# ══════════════════════════════════════════════════════════════════
#  PREDICT  (/api/predict)
# ══════════════════════════════════════════════════════════════════
class ForecastPoint(BaseModel):
    date:      str
    predicted: float

class HistoricalPoint(BaseModel):
    date:   str
    actual: float
    fitted: float

class ResourceRisk(BaseModel):
    name:       str
    type:       str
    risk_score: float
    risk_level: str    # High | Medium | Low
    reasons:    List[str]

class PredictResponse(BaseModel):
    historical:       List[HistoricalPoint]
    forecast:         List[ForecastPoint]
    trend_slope:      float
    monthly_forecast: float
    trend_direction:  str              # increasing | decreasing | stable
    resource_risks:   List[ResourceRisk]
    confidence:       float = 0.0     # DEBUG-005 FIX: was silently dropped
    r_squared:        float = 0.0     # DEBUG-005 FIX: was silently dropped


# ══════════════════════════════════════════════════════════════════
#  RECOMMEND  (/api/recommend)
# ══════════════════════════════════════════════════════════════════
class RecommendationItem(BaseModel):
    resource_name:     str
    resource_type:     Optional[str] = None
    action:            str
    reason:            str
    priority:          str    # High | Medium | Low
    category:          str    # cost | security | performance | graph
    estimated_savings: float

class RecommendResponse(BaseModel):
    recommendations:       List[RecommendationItem]
    total_potential_savings: float
    count:                 int


# ══════════════════════════════════════════════════════════════════
#  GRAPH  (/api/graph)
# ══════════════════════════════════════════════════════════════════
class GraphNode(BaseModel):
    id:            int
    name:          str
    resource_uid:  str
    resource_type: str
    provider:      str
    region:        str
    risk_score:    float
    risk_level:    str     # Low | Medium | High
    status:        str
    sensitivity:   str
    public_access: bool
    cpu_usage:     float
    memory_usage:  float
    latency_ms:    float
    error_rate:    float
    monthly_cost:  float

class GraphEdge(BaseModel):
    source:          int
    target:          int
    source_uid:      str
    target_uid:      str
    connection_type: str
    risk_weight:     float

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: GraphStats


# ══════════════════════════════════════════════════════════════════
#  BLAST RADIUS  (/api/graph/blast-radius)
# ══════════════════════════════════════════════════════════════════
class AffectedNode(BaseModel):
    id:            int
    name:          str
    resource_uid:  str
    resource_type: str
    risk_score:    float

class BlastRadiusResponse(BaseModel):
    source_id:             int
    source_name:           str
    affected_nodes:        List[AffectedNode]
    count:                 int
    total_cascading_risk:  float


# ══════════════════════════════════════════════════════════════════
#  ANOMALY DETAIL  (inline)
# ══════════════════════════════════════════════════════════════════
class AnomalyDetail(BaseModel):
    date:       str
    daily_cost: float
    z_score:    float
    deviation:  float
    severity:   str


# ══════════════════════════════════════════════════════════════════
#  HEALTH CHECK
# ══════════════════════════════════════════════════════════════════
class HealthResponse(BaseModel):
    status:         str
    version:        str
    gemini_active:  bool
    message:        str


# ══════════════════════════════════════════════════════════════════
#  STANDARD ERROR RESPONSE (Phase 7 — used by all routers)
# ══════════════════════════════════════════════════════════════════
class ErrorResponse(BaseModel):
    status:  str = "error"
    message: str
    detail:  str = ""

