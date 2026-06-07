"""
services/graph_service.py
--------------------------
Graph-based cloud risk engine — ported from Cloud_Project/graph_engine.py
and enhanced for CloudIQ's unified data model.

Risk Formula:
    Risk Score = (Connectivity × 2) + Sensitivity + Exposure

    Sensitivity : High=3 | Medium=2 | Low=1
    Exposure    : public_access=True → 3 | False → 1
    Connectivity: total degree (in + out edges) of the node

Risk Levels:
    Low    → score ≤ 5
    Medium → 6 ≤ score ≤ 10
    High   → score > 10
"""

import logging
import itertools
from typing import List, Dict, Optional

import networkx as nx
from sqlalchemy.orm import Session

from models.models import CloudResource, ResourceConnection

logger = logging.getLogger("cloudiq.graph_service")

# ─── Scoring Maps ─────────────────────────────────────────────────────────────
SENSITIVITY_MAP = {"High": 3, "Medium": 2, "Low": 1}
EXPOSURE_MAP    = {True: 3, False: 1}


def _risk_level(score: float) -> str:
    if score <= 5:
        return "Low"
    elif score <= 10:
        return "Medium"
    return "High"


# ══════════════════════════════════════════════════════════════════════════════
#  GRAPH CONSTRUCTION
# ══════════════════════════════════════════════════════════════════════════════

def build_graph(db: Session) -> nx.DiGraph:
    """
    Build a directed NetworkX graph from all CloudResource nodes
    and ResourceConnection edges stored in the database.
    """
    G = nx.DiGraph()

    resources = db.query(CloudResource).all()
    for r in resources:
        G.add_node(
            r.id,
            name=r.name,
            resource_uid=r.resource_uid,
            resource_type=r.resource_type,
            provider=r.provider,
            region=r.region,
            risk_score=r.risk_score,
            status=r.status,
            sensitivity=r.sensitivity or "Low",
            public_access=bool(r.public_access),
            cpu_usage=r.cpu_usage,
            memory_usage=r.memory_usage,
            latency_ms=r.latency_ms,
            error_rate=r.error_rate,
            monthly_cost=r.monthly_cost,
        )

    connections = db.query(ResourceConnection).all()
    for c in connections:
        if c.source_id and c.target_id:
            G.add_edge(
                c.source_id,
                c.target_id,
                connection_type=c.connection_type,
                risk_weight=c.risk_weight,
            )

    logger.info(f"[GRAPH] Built graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


# ══════════════════════════════════════════════════════════════════════════════
#  RISK SCORING
# ══════════════════════════════════════════════════════════════════════════════

def compute_risk_analysis(db: Session, graph=None) -> List[Dict]:
    """
    Build graph, score every node, persist updated risk_score to DB.
    Returns list of dicts sorted by risk_score descending.
    Accepts an optional pre-built graph to avoid duplicate build_graph calls.
    """
    # ── Reuse build_graph() — no duplicate DB queries ─────────────────────────
    G = graph if graph is not None else build_graph(db)
    resources = db.query(CloudResource).all()
    resource_map: Dict[int, CloudResource] = {r.id: r for r in resources}

    results = []
    for node_id in G.nodes:
        attrs    = G.nodes[node_id]
        resource = resource_map.get(node_id)

        sensitivity_str = attrs.get("sensitivity", "Low")
        public_access   = attrs.get("public_access", False)
        connectivity    = G.degree(node_id)

        s_val = SENSITIVITY_MAP.get(sensitivity_str, 1)
        e_val = EXPOSURE_MAP.get(public_access, 1)
        risk_score = (connectivity * 2) + s_val + e_val
        level = _risk_level(risk_score)

        # Persist back to DB
        if resource:
            resource.risk_score = float(risk_score)

        results.append({
            "id":                node_id,
            "resource_uid":      attrs.get("resource_uid", str(node_id)),
            "name":              attrs.get("name", ""),
            "resource_type":     attrs.get("resource_type", ""),
            "provider":          attrs.get("provider", "AWS"),
            "region":            attrs.get("region", ""),
            "status":            attrs.get("status", "active"),
            "sensitivity":       sensitivity_str,
            "public_access":     public_access,
            "monthly_cost":      attrs.get("monthly_cost", 0.0),
            "connectivity":      connectivity,
            "sensitivity_score": s_val,
            "exposure_score":    e_val,
            "risk_score":        risk_score,
            "risk_level":        level,
        })

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[GRAPH] Failed to persist risk scores: {e}")

    results.sort(key=lambda x: x["risk_score"], reverse=True)
    logger.info(f"[GRAPH] Risk analysis complete: {len(results)} nodes scored")
    return results


# ══════════════════════════════════════════════════════════════════════════════
#  GRAPH STATISTICS
# ══════════════════════════════════════════════════════════════════════════════

def get_graph_stats(G: nx.DiGraph) -> Dict:
    """Return summary statistics about the graph."""
    if G.number_of_nodes() == 0:
        return {
            "total_nodes": 0, "total_edges": 0, "avg_risk_score": 0,
            "high_risk_nodes": 0, "connected_components": 0, "density": 0,
        }

    risk_scores = [G.nodes[n].get("risk_score", 0) for n in G.nodes]
    avg_risk = sum(risk_scores) / len(risk_scores) if risk_scores else 0
    high_risk = sum(1 for s in risk_scores if s >= 7)

    undirected = G.to_undirected()
    components = nx.number_connected_components(undirected) if undirected.number_of_nodes() > 0 else 0

    return {
        "total_nodes":          G.number_of_nodes(),
        "total_edges":          G.number_of_edges(),
        "avg_risk_score":       round(avg_risk, 2),
        "high_risk_nodes":      high_risk,
        "connected_components": components,
        "density":              round(nx.density(G), 4),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  BLAST RADIUS  — Cascading failure simulation
# ══════════════════════════════════════════════════════════════════════════════

def get_blast_radius(G: nx.DiGraph, resource_id: int) -> Dict:
    """
    Simulate blast radius: which nodes are reachable from a failed node.
    EC2 → Database → Storage → Network (downstream propagation).
    """
    if resource_id not in G:
        return {"source_id": resource_id, "source_name": "Unknown",
                "affected_nodes": [], "count": 0, "total_cascading_risk": 0}

    reachable = nx.descendants(G, resource_id)
    affected = []
    for nid in reachable:
        node = G.nodes[nid]
        affected.append({
            "id":            nid,
            "name":          node.get("name", str(nid)),
            "resource_uid":  node.get("resource_uid", str(nid)),
            "resource_type": node.get("resource_type", "unknown"),
            "risk_score":    node.get("risk_score", 0),
        })

    total_risk = sum(a["risk_score"] for a in affected)
    return {
        "source_id":            resource_id,
        "source_name":          G.nodes[resource_id].get("name", str(resource_id)),
        "affected_nodes":       affected,
        "count":                len(affected),
        "total_cascading_risk": round(total_risk, 2),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ATTACK PATHS
# ══════════════════════════════════════════════════════════════════════════════

def find_attack_paths(G: nx.DiGraph, source_id: int, target_id: int) -> List[List[int]]:
    """Find all simple paths between two nodes (attack paths). Max depth 8."""
    try:
        return list(nx.all_simple_paths(G, source=source_id, target=target_id, cutoff=8))
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return []


def find_highest_risk_path(G: nx.DiGraph) -> Optional[Dict]:
    """Find the highest-risk path across all node pairs (samples up to 50 pairs)."""
    if G.number_of_nodes() < 2:
        return None

    nodes = list(G.nodes)
    pairs = list(itertools.combinations(nodes, 2))[:50]
    best_path, best_risk = None, -1

    for source, target in pairs:
        try:
            path = nx.shortest_path(G, source=source, target=target)
            if len(path) < 2:
                continue
            total_risk = sum(G.nodes[n].get("risk_score", 0) for n in path)
            if total_risk > best_risk:
                best_risk, best_path = total_risk, path
        except nx.NetworkXNoPath:
            continue

    if best_path is None:
        return None

    return {
        "path":       best_path,
        "node_names": [G.nodes[n].get("name", str(n)) for n in best_path],
        "total_risk": round(best_risk, 2),
        "hops":       len(best_path) - 1,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  CENTRALITY
# ══════════════════════════════════════════════════════════════════════════════

def compute_centrality(G: nx.DiGraph) -> Dict[int, float]:
    """Betweenness centrality to identify critical bridge nodes."""
    if G.number_of_nodes() < 2:
        return {}
    try:
        return nx.betweenness_centrality(G, weight="risk_weight")
    except Exception:
        return {}
