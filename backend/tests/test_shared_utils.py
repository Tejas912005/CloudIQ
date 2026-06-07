"""tests/test_shared_utils.py"""
import sys
import os

# Ensure backend/ is on the path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

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
