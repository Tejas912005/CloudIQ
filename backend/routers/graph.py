"""
routers/graph.py
-----------------
Graph-based cloud risk endpoints:
  GET  /api/graph                          — full graph (nodes + edges + stats)
  GET  /api/graph/blast-radius?resource_id — cascading failure simulation
  GET  /api/graph/attack-paths?source&target — attack path detection
  GET  /api/graph/risk-analysis             — full node risk scoring
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from schemas.schemas import (
    GraphResponse, GraphNode, GraphEdge, GraphStats,
    BlastRadiusResponse, AffectedNode
)
from models.models import CloudResource, ResourceConnection
from services.graph_service import (
    build_graph, get_graph_stats, compute_risk_analysis,
    get_blast_radius, find_attack_paths, find_highest_risk_path
)

logger = logging.getLogger("cloudiq.router.graph")

router = APIRouter(prefix="/api/graph", tags=["Graph"])


@router.get("", response_model=GraphResponse)
def get_graph(db: Session = Depends(get_db)):
    """
    Returns the full cloud resource dependency graph.
    Nodes are colored by risk level (Low/Medium/High).
    Edges represent network/data dependencies.
    Use this to visualize your cloud topology and identify risk clusters.
    """
    try:
        # Get risk analysis to enrich node data
        risk_data = compute_risk_analysis(db)
        risk_map = {r["id"]: r for r in risk_data}

        G = build_graph(db)
        stats = get_graph_stats(G)

        # Build typed node list
        nodes = []
        for node_id in G.nodes:
            attrs = G.nodes[node_id]
            r_data = risk_map.get(node_id, {})
            nodes.append(GraphNode(
                id=node_id,
                name=attrs.get("name", ""),
                resource_uid=attrs.get("resource_uid", str(node_id)),
                resource_type=attrs.get("resource_type", ""),
                provider=attrs.get("provider", "AWS"),
                region=attrs.get("region", ""),
                risk_score=r_data.get("risk_score", attrs.get("risk_score", 0)),
                risk_level=r_data.get("risk_level", "Low"),
                status=attrs.get("status", "active"),
                sensitivity=attrs.get("sensitivity", "Low"),
                public_access=attrs.get("public_access", False),
                cpu_usage=attrs.get("cpu_usage", 0.0),
                memory_usage=attrs.get("memory_usage", 0.0),
                latency_ms=attrs.get("latency_ms", 0.0),
                error_rate=attrs.get("error_rate", 0.0),
                monthly_cost=attrs.get("monthly_cost", 0.0),
            ))

        # Build typed edge list
        connections = db.query(ResourceConnection).all()
        uid_map = {r.id: r.resource_uid for r in db.query(CloudResource).all()}

        edges = []
        for c in connections:
            if c.source_id and c.target_id:
                edges.append(GraphEdge(
                    source=c.source_id,
                    target=c.target_id,
                    source_uid=uid_map.get(c.source_id, str(c.source_id)),
                    target_uid=uid_map.get(c.target_id, str(c.target_id)),
                    connection_type=c.connection_type,
                    risk_weight=c.risk_weight,
                ))

        logger.info(f"[GRAPH] Serving graph: {len(nodes)} nodes, {len(edges)} edges")
        return GraphResponse(nodes=nodes, edges=edges, stats=GraphStats(**stats))

    except Exception as e:
        logger.error(f"[GRAPH] Error building graph: {e}")
        raise


@router.get("/blast-radius", response_model=BlastRadiusResponse)
def blast_radius(
    resource_id: int = Query(..., description="Database ID of the source resource"),
    db: Session = Depends(get_db)
):
    """
    Simulate cascading failure: if resource X fails, what else goes down?
    Returns all downstream nodes reachable from the given resource.
    Formula: EC2 → Database → Storage → Network (propagation)
    """
    resource = db.query(CloudResource).filter(CloudResource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail=f"Resource with id={resource_id} not found")

    G = build_graph(db)
    result = get_blast_radius(G, resource_id)

    affected = [
        AffectedNode(
            id=n["id"],
            name=n["name"],
            resource_uid=n["resource_uid"],
            resource_type=n["resource_type"],
            risk_score=n["risk_score"],
        )
        for n in result["affected_nodes"]
    ]

    logger.info(f"[GRAPH] Blast radius for {resource.name}: {result['count']} affected nodes")
    return BlastRadiusResponse(
        source_id=resource_id,
        source_name=result["source_name"],
        affected_nodes=affected,
        count=result["count"],
        total_cascading_risk=result["total_cascading_risk"],
    )


@router.get("/attack-paths")
def attack_paths(
    source: int = Query(..., description="Source resource database ID"),
    target: int = Query(..., description="Target resource database ID"),
    db: Session = Depends(get_db)
):
    """
    Find all attack paths between two nodes.
    Returns simple paths of length ≤ 8 ordered by total risk.
    """
    src = db.query(CloudResource).filter(CloudResource.id == source).first()
    tgt = db.query(CloudResource).filter(CloudResource.id == target).first()

    if not src:
        raise HTTPException(status_code=404, detail=f"Source resource id={source} not found")
    if not tgt:
        raise HTTPException(status_code=404, detail=f"Target resource id={target} not found")

    G = build_graph(db)
    paths = find_attack_paths(G, source, target)

    uid_map  = {r.id: r.resource_uid for r in db.query(CloudResource).all()}
    name_map = {r.id: r.name for r in db.query(CloudResource).all()}

    formatted = []
    for path in paths[:10]:  # cap at 10 paths
        formatted.append({
            "path_ids":   path,
            "path_uids":  [uid_map.get(n, str(n)) for n in path],
            "path_names": [name_map.get(n, str(n)) for n in path],
            "total_risk": sum(G.nodes[n].get("risk_score", 0) for n in path),
            "hops":       len(path) - 1,
        })

    formatted.sort(key=lambda x: x["total_risk"], reverse=True)
    logger.info(f"[GRAPH] Attack paths {src.name}→{tgt.name}: {len(paths)} found")
    return {"source": src.name, "target": tgt.name, "paths": formatted}


@router.get("/risk-analysis")
def risk_analysis(db: Session = Depends(get_db)):
    """
    Full graph-based risk analysis using:
    Risk Score = (Connectivity × 2) + Sensitivity + Exposure
    Returns all nodes sorted by risk_score descending.
    """
    results = compute_risk_analysis(db)
    logger.info(f"[GRAPH] Risk analysis complete: {len(results)} nodes")
    return {
        "nodes":             results,
        "total_nodes":       len(results),
        "high_risk_count":   sum(1 for n in results if n["risk_level"] == "High"),
        "medium_risk_count": sum(1 for n in results if n["risk_level"] == "Medium"),
        "low_risk_count":    sum(1 for n in results if n["risk_level"] == "Low"),
        "formula":           "Risk Score = (Connectivity × 2) + Sensitivity + Exposure",
    }
