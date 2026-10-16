"""
Unit tests for LeafLens multi-crop aggregation logic.
Tests healthy, diseased, low-confidence/narrow-margin (uncertain),
and mixed-plant sanity check cases.
"""

import sys
from pathlib import Path
import numpy as np
import pytest

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from server import aggregate_crop_predictions
from labels import EXPECTED_CLASSES


@pytest.fixture
def mock_class_names():
    return EXPECTED_CLASSES


def test_healthy_case(mock_class_names):
    """Test when crops predict healthy tomato with high confidence."""
    # Tomato_healthy index
    healthy_idx = mock_class_names.index("Tomato_healthy")
    num_classes = len(mock_class_names)

    # 3 crops, each strongly predicting Tomato_healthy
    probs = np.zeros((3, num_classes), dtype=np.float32)
    probs[:, healthy_idx] = 0.92
    probs[:, (healthy_idx + 1) % num_classes] = 0.04
    probs[:, (healthy_idx + 2) % num_classes] = 0.04

    meta = [
        {"box": [0.1, 0.1, 0.5, 0.5], "green_ratio": 0.45},
        {"box": [0.2, 0.2, 0.6, 0.6], "green_ratio": 0.50},
        {"box": [0.3, 0.3, 0.7, 0.7], "green_ratio": 0.38},
    ]

    result = aggregate_crop_predictions(probs, meta, mock_class_names)
    assert result["verdict"] == "healthy"
    assert result["status"] == "healthy"
    assert result["plant"] == "Tomato"
    assert result["condition"] == "Healthy"
    assert result["confidence"] >= 0.90
    assert result["analysis_label"] == "Leaf analysis"
    assert len(result["crops"]) == 3


def test_diseased_case(mock_class_names):
    """Test when crops predict Potato early blight with high confidence."""
    blight_idx = mock_class_names.index("Potato___Early_blight")
    num_classes = len(mock_class_names)

    probs = np.zeros((2, num_classes), dtype=np.float32)
    probs[:, blight_idx] = 0.88
    probs[:, (blight_idx + 1) % num_classes] = 0.08
    probs[:, (blight_idx + 2) % num_classes] = 0.04

    meta = [
        {"box": [0.0, 0.0, 0.5, 0.5], "green_ratio": 0.30},
        {"box": [0.4, 0.4, 0.9, 0.9], "green_ratio": 0.25},
    ]

    result = aggregate_crop_predictions(probs, meta, mock_class_names)
    assert result["verdict"] == "diseased"
    assert result["status"] == "diseased"
    assert result["plant"] == "Potato"
    assert result["condition"] == "Early blight"
    assert result["confidence"] >= 0.85
    assert len(result["crops"]) == 2


def test_uncertain_low_confidence(mock_class_names):
    """Test when top confidence is below 0.60 threshold."""
    num_classes = len(mock_class_names)
    # Uniform / low confidence across multiple classes
    probs = np.full((2, num_classes), 1.0 / num_classes, dtype=np.float32)
    # Slight bump but top1 is only ~0.35
    probs[0, 0] = 0.35
    probs[1, 0] = 0.35

    meta = [
        {"box": [0, 0, 1, 1], "green_ratio": 0.4},
        {"box": [0, 0, 0.5, 0.5], "green_ratio": 0.5},
    ]

    result = aggregate_crop_predictions(probs, meta, mock_class_names)
    assert result["verdict"] == "uncertain"
    assert result["status"] == "uncertain"
    assert "Couldn't get a confident reading" in result["message"]


def test_uncertain_narrow_margin(mock_class_names):
    """Test when top1 is >= 0.60 but margin over top2 is < 0.15."""
    num_classes = len(mock_class_names)
    probs = np.zeros((1, num_classes), dtype=np.float32)
    probs[0, 0] = 0.62  # top1
    probs[0, 1] = 0.55  # top2 (margin = 0.07 < 0.15)
    # Normalize
    probs = probs / np.sum(probs)

    meta = [{"box": [0, 0, 1, 1], "green_ratio": 0.5}]

    result = aggregate_crop_predictions(probs, meta, mock_class_names)
    assert result["verdict"] == "uncertain"
    assert result["status"] == "uncertain"


def test_mixed_plants_sanity_check(mock_class_names):
    """Test when crops strongly disagree on plant (e.g. half Tomato, half Potato)."""
    tomato_idx = mock_class_names.index("Tomato_healthy")
    potato_idx = mock_class_names.index("Potato___Early_blight")
    num_classes = len(mock_class_names)

    probs = np.zeros((2, num_classes), dtype=np.float32)
    probs[0, tomato_idx] = 0.95
    probs[1, potato_idx] = 0.95

    meta = [
        {"box": [0.0, 0.0, 0.5, 0.5], "green_ratio": 0.5},
        {"box": [0.5, 0.5, 1.0, 1.0], "green_ratio": 0.5},
    ]

    result = aggregate_crop_predictions(probs, meta, mock_class_names)
    assert result["verdict"] == "uncertain"
    assert result["reason"] == "mixed_plants"
    assert "inconsistent across different plant types" in result["message"]


def test_no_usable_crops():
    """Test when all crops fail vegetation threshold (< 0.12)."""
    probs = np.zeros((2, len(EXPECTED_CLASSES)), dtype=np.float32)
    probs[:, 0] = 0.95

    meta = [
        {"box": [0, 0, 1, 1], "green_ratio": 0.05},
        {"box": [0, 0, 0.5, 0.5], "green_ratio": 0.02},
    ]

    result = aggregate_crop_predictions(probs, meta, EXPECTED_CLASSES)
    assert result["verdict"] == "uncertain"
    assert result["reason"] == "insufficient_leaf_regions"
