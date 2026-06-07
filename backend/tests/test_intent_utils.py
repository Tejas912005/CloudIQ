"""
tests/test_intent_utils.py
--------------------------
Unit tests for the canonical intent resolver.
Run: pytest backend/tests/
"""
import pytest
import sys
import os

# Ensure backend/ is on the path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

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
