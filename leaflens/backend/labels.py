"""
Class mapping table for LeafLens.
Maps the 18 unified plant class directory names to display-friendly plant name,
condition name, and binary status ('healthy' or 'diseased').
"""

from typing import Dict, Any, Optional

CLASS_INFO: Dict[str, Dict[str, str]] = {
    "Pepper__bell___Bacterial_spot": {
        "plant": "Pepper (bell)",
        "condition": "Bacterial spot",
        "status": "diseased",
    },
    "Pepper__bell___healthy": {
        "plant": "Pepper (bell)",
        "condition": "Healthy",
        "status": "healthy",
    },
    "Potato___Early_blight": {
        "plant": "Potato",
        "condition": "Early blight",
        "status": "diseased",
    },
    "Potato___Late_blight": {
        "plant": "Potato",
        "condition": "Late blight",
        "status": "diseased",
    },
    "Potato___healthy": {
        "plant": "Potato",
        "condition": "Healthy",
        "status": "healthy",
    },
    "Snake_Plant_Anthracnose": {
        "plant": "Snake Plant",
        "condition": "Anthracnose",
        "status": "diseased",
    },
    "Snake_Plant_Healthy": {
        "plant": "Snake Plant",
        "condition": "Healthy",
        "status": "healthy",
    },
    "Snake_Plant_Leaf_Withering": {
        "plant": "Snake Plant",
        "condition": "Leaf Withering",
        "status": "diseased",
    },
    "Tomato__Target_Spot": {
        "plant": "Tomato",
        "condition": "Target spot",
        "status": "diseased",
    },
    "Tomato__Tomato_mosaic_virus": {
        "plant": "Tomato",
        "condition": "Mosaic virus",
        "status": "diseased",
    },
    "Tomato__Tomato_YellowLeaf__Curl_Virus": {
        "plant": "Tomato",
        "condition": "Yellow leaf curl virus",
        "status": "diseased",
    },
    "Tomato_Bacterial_spot": {
        "plant": "Tomato",
        "condition": "Bacterial spot",
        "status": "diseased",
    },
    "Tomato_Early_blight": {
        "plant": "Tomato",
        "condition": "Early blight",
        "status": "diseased",
    },
    "Tomato_Late_blight": {
        "plant": "Tomato",
        "condition": "Late blight",
        "status": "diseased",
    },
    "Tomato_Leaf_Mold": {
        "plant": "Tomato",
        "condition": "Leaf mold",
        "status": "diseased",
    },
    "Tomato_Septoria_leaf_spot": {
        "plant": "Tomato",
        "condition": "Septoria leaf spot",
        "status": "diseased",
    },
    "Tomato_Spider_mites_Two_spotted_spider_mite": {
        "plant": "Tomato",
        "condition": "Spider mites (two-spotted)",
        "status": "diseased",
    },
    "Tomato_healthy": {
        "plant": "Tomato",
        "condition": "Healthy",
        "status": "healthy",
    },
}

EXPECTED_CLASSES = [
    "Pepper__bell___Bacterial_spot",
    "Pepper__bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Snake_Plant_Anthracnose",
    "Snake_Plant_Healthy",
    "Snake_Plant_Leaf_Withering",
    "Tomato__Target_Spot",
    "Tomato__Tomato_mosaic_virus",
    "Tomato__Tomato_YellowLeaf__Curl_Virus",
    "Tomato_Bacterial_spot",
    "Tomato_Early_blight",
    "Tomato_Late_blight",
    "Tomato_Leaf_Mold",
    "Tomato_Septoria_leaf_spot",
    "Tomato_Spider_mites_Two_spotted_spider_mite",
    "Tomato_healthy",
]


def get_class_info(class_name: str) -> Dict[str, str]:
    """Return dictionary with plant, condition, and status for a class name."""
    if class_name in CLASS_INFO:
        return CLASS_INFO[class_name]
    return {
        "plant": "Unknown plant",
        "condition": class_name.replace("___", " ").replace("__", " ").replace("_", " "),
        "status": "diseased",
    }


def get_plant_name(class_name: str) -> str:
    return get_class_info(class_name)["plant"]


def get_condition_name(class_name: str) -> str:
    return get_class_info(class_name)["condition"]


def get_status(class_name: str) -> str:
    return get_class_info(class_name)["status"]
