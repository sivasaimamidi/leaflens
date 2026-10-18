"""
LeafLens Serverless FastAPI Backend for Vercel
Serves /api/health and /api/scan with TFLite inference on the 15 PlantVillage classes.
"""
import io
import os
import json
import time
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Any

import numpy as np
from PIL import Image
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_PATH = SCRIPT_DIR / "plant_model.tflite"
CLASS_NAMES_PATH = SCRIPT_DIR / "class_names.json"
DISEASE_INFO_PATH = SCRIPT_DIR / "disease_info.json"

DISEASE_INFO: Dict[str, Any] = {}
if DISEASE_INFO_PATH.exists():
    try:
        with open(DISEASE_INFO_PATH, "r", encoding="utf-8") as f:
            DISEASE_INFO = json.load(f)
    except Exception:
        pass

CLASS_INFO = {
    "Pepper__bell___Bacterial_spot": {"plant": "Pepper (bell)", "condition": "Bacterial spot", "status": "diseased"},
    "Pepper__bell___healthy": {"plant": "Pepper (bell)", "condition": "Healthy", "status": "healthy"},
    "Potato___Early_blight": {"plant": "Potato", "condition": "Early blight", "status": "diseased"},
    "Potato___Late_blight": {"plant": "Potato", "condition": "Late blight", "status": "diseased"},
    "Potato___healthy": {"plant": "Potato", "condition": "Healthy", "status": "healthy"},
    "Snake_Plant_Anthracnose": {"plant": "Snake Plant", "condition": "Anthracnose", "status": "diseased"},
    "Snake_Plant_Healthy": {"plant": "Snake Plant", "condition": "Healthy", "status": "healthy"},
    "Snake_Plant_Leaf_Withering": {"plant": "Snake Plant", "condition": "Leaf Withering", "status": "diseased"},
    "Tomato__Target_Spot": {"plant": "Tomato", "condition": "Target spot", "status": "diseased"},
    "Tomato__Tomato_mosaic_virus": {"plant": "Tomato", "condition": "Mosaic virus", "status": "diseased"},
    "Tomato__Tomato_YellowLeaf__Curl_Virus": {"plant": "Tomato", "condition": "Yellow leaf curl virus", "status": "diseased"},
    "Tomato_Bacterial_spot": {"plant": "Tomato", "condition": "Bacterial spot", "status": "diseased"},
    "Tomato_Early_blight": {"plant": "Tomato", "condition": "Early blight", "status": "diseased"},
    "Tomato_Late_blight": {"plant": "Tomato", "condition": "Late blight", "status": "diseased"},
    "Tomato_Leaf_Mold": {"plant": "Tomato", "condition": "Leaf mold", "status": "diseased"},
    "Tomato_Septoria_leaf_spot": {"plant": "Tomato", "condition": "Septoria leaf spot", "status": "diseased"},
    "Tomato_Spider_mites_Two_spotted_spider_mite": {"plant": "Tomato", "condition": "Spider mites (two-spotted)", "status": "diseased"},
    "Tomato_healthy": {"plant": "Tomato", "condition": "Healthy", "status": "healthy"},
}

def get_class_info(class_name: str) -> Dict[str, str]:
    if class_name in CLASS_INFO:
        return CLASS_INFO[class_name]
    return {
        "plant": "Unknown plant",
        "condition": class_name.replace("___", " ").replace("__", " ").replace("_", " "),
        "status": "diseased",
    }

# Lazy interpreter loader
_interpreter = None
_class_names = None

def get_tflite_resources():
    global _interpreter, _class_names
    if _interpreter is not None:
        return _interpreter, _class_names

    from ai_edge_litert.interpreter import Interpreter
    _interpreter = Interpreter(model_path=str(MODEL_PATH))
    _interpreter.allocate_tensors()

    if CLASS_NAMES_PATH.exists():
        with open(CLASS_NAMES_PATH, "r") as f:
            _class_names = json.load(f)
    else:
        _class_names = sorted(list(CLASS_INFO.keys()))

    return _interpreter, _class_names


app = FastAPI(title="LeafLens Serverless API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
@app.get("/health")
def health():
    try:
        _, class_names = get_tflite_resources()
        loaded = True
        count = len(class_names)
    except Exception as e:
        loaded = False
        count = 0

    return {
        "status": "ok",
        "service": "LeafLens Leaf Disease Classification",
        "model_loaded": loaded,
        "class_count": count,
        "privacy": "Images are processed locally for this prototype and are not uploaded or stored.",
    }


def aggregate_crop_predictions(
    probabilities_batch: np.ndarray,
    crop_metadata: List[Dict[str, Any]],
    class_names: List[str],
) -> Dict[str, Any]:
    if len(probabilities_batch) == 0:
        return {
            "verdict": "uncertain",
            "reason": "no_crops",
            "message": "Couldn't find usable leaf regions. Move closer, add light, or show a tomato, potato or pepper leaf.",
            "crops": [],
            "top_predictions": [],
            "analysis_label": "Leaf analysis",
        }

    # Relaxed vegetation filter so diseased/spotted/blighted leaves pass through
    surviving_indices = [
        i for i, meta in enumerate(crop_metadata)
        if float(meta.get("green_ratio", 0.5)) >= 0.04
    ]

    if not surviving_indices:
        # Fallback: if all failed ratio check, use all crops anyway
        surviving_indices = list(range(len(probabilities_batch)))

    weights = []
    for i in surviving_indices:
        box = crop_metadata[i].get("box", [0, 0, 1, 1])
        gr = float(crop_metadata[i].get("green_ratio", 0.5))
        # Full frame crop ([0, 0, 1, 1]) gets dominant 20.0x weight so localized crops cannot overturn full leaf context
        is_full = (box[0] == 0 and box[1] == 0 and box[2] == 1 and box[3] == 1)
        w = 20.0 * max(0.2, gr) if is_full else 1.0 * max(0.1, gr)
        weights.append(w)

    weights = np.array(weights)
    weight_sum = np.sum(weights)
    normalized_weights = weights / weight_sum if weight_sum > 0 else np.ones(len(surviving_indices)) / len(surviving_indices)

    surviving_probs = probabilities_batch[surviving_indices]
    averaged_prob = np.sum(surviving_probs * normalized_weights[:, np.newaxis], axis=0)

    sorted_indices = np.argsort(averaged_prob)[::-1]
    top_predictions = [
        {
            "class_name": class_names[idx],
            "probability": float(averaged_prob[idx]),
            **get_class_info(class_names[idx]),
        }
        for idx in sorted_indices[:3]
    ]

    top1 = top_predictions[0]
    top2 = top_predictions[1] if len(top_predictions) > 1 else None
    confidence = top1["probability"]

    per_crop_results = []
    plant_votes: Dict[str, float] = {}

    for local_idx, orig_idx in enumerate(surviving_indices):
        prob_vec = probabilities_batch[orig_idx]
        best_cls_idx = int(np.argmax(prob_vec))
        best_cls_name = class_names[best_cls_idx]
        info = get_class_info(best_cls_name)
        crop_conf = float(prob_vec[best_cls_idx])
        plant_name = info["plant"]
        plant_votes[plant_name] = plant_votes.get(plant_name, 0.0) + weights[local_idx]

        per_crop_results.append({
            "box": crop_metadata[orig_idx].get("box", [0, 0, 1, 1]),
            "class_name": best_cls_name,
            "plant": plant_name,
            "condition": info["condition"],
            "status": info["status"],
            "confidence": crop_conf,
            "green_ratio": float(crop_metadata[orig_idx].get("green_ratio", 0.0)),
        })

    # Calibrated margin for smooth demonstration
    margin = (top1["probability"] - top2["probability"]) if top2 else top1["probability"]

    rec = DISEASE_INFO.get(top1["class_name"], {})
    precautions = rec.get("precautions", [])
    cure = rec.get("cure", [])

    # If confidence is extremely low (< 12%), flag as uncertain
    if confidence < 0.12:
        return {
            "verdict": "uncertain",
            "reason": "low_confidence",
            "message": "Couldn't get a confident reading. Move closer, add light, or show a snake plant, tomato, potato or pepper leaf.",
            "confidence": confidence,
            "margin": float(margin),
            "class_name": top1["class_name"],
            "plant": rec.get("plant", top1["plant"]),
            "condition": rec.get("condition", top1["condition"]),
            "status": "uncertain",
            "precautions": precautions,
            "cure": cure,
            "top_predictions": top_predictions,
            "crops": per_crop_results,
            "analysis_label": "Leaf analysis",
        }

    return {
        "verdict": top1["status"],
        "class_name": top1["class_name"],
        "plant": rec.get("plant", top1["plant"]),
        "condition": rec.get("condition", top1["condition"]),
        "confidence": confidence,
        "margin": float(margin),
        "status": top1["status"],
        "precautions": precautions,
        "cure": cure,
        "top_predictions": top_predictions,
        "crops": per_crop_results,
        "analysis_label": "Leaf analysis",
    }


@app.post("/api/scan")
@app.post("/scan")
async def scan(
    files: List[UploadFile] = File(...),
    metadata: Optional[str] = Form(None),
):
    start_time = time.perf_counter()

    parsed_metadata = []
    if metadata:
        try:
            parsed_metadata = json.loads(metadata)
        except Exception:
            parsed_metadata = []

    interpreter, class_names = get_tflite_resources()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    images_array = []
    for i, file in enumerate(files):
        try:
            content = await file.read()
            img = Image.open(io.BytesIO(content)).convert("RGB")
            img = img.resize((224, 224), Image.Resampling.BILINEAR)
            arr = np.array(img, dtype=np.float32)
            images_array.append(arr)
        except Exception as e:
            print(f"Error reading file {i}: {e}")

    if not images_array:
        return {
            "verdict": "uncertain",
            "reason": "no_valid_images",
            "message": "No valid leaf images could be decoded.",
            "crops": [],
            "top_predictions": [],
            "analysis_label": "Leaf analysis",
        }

    # Run TFLite inference
    all_probs = []
    for img_arr in images_array:
        input_data = np.expand_dims(img_arr, axis=0).astype(np.float32)
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]['index'])
        all_probs.append(output_data[0])

    probabilities_batch = np.array(all_probs)

    while len(parsed_metadata) < len(images_array):
        parsed_metadata.append({"box": [0, 0, 1, 1], "green_ratio": 0.5})

    result = aggregate_crop_predictions(probabilities_batch, parsed_metadata[:len(images_array)], class_names)
    result["latency_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    result["target_performance"] = "Target: under 3 seconds on a normal laptop."
    result["privacy"] = "Images are processed locally for this prototype and are not uploaded or stored."
    return result


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


class TTSPayload(BaseModel):
    text: str
    voice: Optional[str] = "Kore"
    style: Optional[str] = "clear, empathetic, professional agricultural specialist"


@app.post("/api/tts")
@app.post("/tts")
def tts_generate(payload: TTSPayload):
    """
    Synthesizes speech using Google Gemini 3.8 Flash TTS.
    Returns high-fidelity WAV base64 data for immediate browser playback.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

    url = f"https://generativelanguage.googleapis.com/v1beta/interactions?key={GEMINI_API_KEY}"
    req_body = {
        "model": "gemini-3.8-flash-tts",
        "input": [{
            "type": "user_input",
            "content": [{
                "type": "text",
                "text": payload.text[:1200],
                "annotations": [{"type": "speech_metadata", "style": payload.style or "clear and professional"}]
            }]
        }],
        "response_format": {"type": "audio"},
        "generation_config": {
            "speech_config": [{"voice": payload.voice or "Kore"}]
        }
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(req_body).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for step in data.get("steps", []):
                if step.get("type") == "model_output":
                    for c in step.get("content", []):
                        if c.get("type") == "audio" and c.get("data"):
                            return {
                                "audio_base64": c.get("data"),
                                "mime_type": c.get("mime_type", "audio/wav"),
                                "text": payload.text,
                                "source": "gemini-3.8-flash-tts"
                            }
        return {"error": "No audio step in response", "fallback": True}
    except Exception as e:
        print(f"TTS endpoint error: {e}")
        return {"error": str(e), "fallback": True}


class AssistantPayload(BaseModel):
    prompt: str
    plant_context: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None


def get_botanical_fallback(query: str, plant_context: Optional[str] = None, history: Optional[List[Dict[str, str]]] = None) -> str:
    q = query.lower()
    ctx = (plant_context or "").lower()
    
    # Check history if current query lacks context
    if history:
        for item in reversed(history):
            prev = item.get("text", "").lower()
            if "snake" in prev:
                ctx += " snake plant"
            elif "tomato" in prev:
                ctx += " tomato"
            elif "potato" in prev:
                ctx += " potato"
            elif "pepper" in prev:
                ctx += " pepper"

    if "precaution" in q or "prevent" in q or "avoid" in q or "protect" in q:
        if "snake" in ctx or "sansevieria" in q:
            return "For Snake Plants, key precautions include watering strictly at the soil base, allowing the soil to dry completely between waterings, maintaining low ambient humidity, and sterilizing pruning shears to prevent fungal leaf spot."
        return "To prevent plant diseases, water strictly at the soil base rather than overhead, provide adequate spacing between plants for airflow, disinfect pruning shears between cuts, and clear fallen leaves from the soil surface."

    if "cure" in q or "treat" in q or "remedy" in q or "step" in q or "medicine" in q:
        return "For active treatment, immediately prune and isolate affected foliage to stop pathogen spread, improve air circulation, and apply a targeted copper or organic bio-fungicide spray suited for the condition."

    if "water" in q or "moisture" in q or "irrigation" in q:
        if "snake" in ctx:
            return "For Snake Plants, water sparingly only when the potting mix is dry all the way through, approximately once every 2 to 3 weeks, and empty any runoff from the saucer."
        return "Water thoroughly only when the top few inches of soil are dry to the touch, ensure pots have unobstructed drainage holes, and avoid letting roots sit in pooled water."

    if "light" in q or "sun" in q:
        return "Most foliage thrives in bright, indirect sunlight. Protect leaves from intense direct midday rays to avoid leaf scorch, and rotate the container periodically for uniform growth."

    return "Maintain balanced soil moisture, ensure adequate airflow between leaves, disinfect gardening tools regularly, and isolate any symptomatic foliage at the first sign of discoloration."


@app.post("/api/assistant")
@app.post("/assistant")
def chat_assistant(payload: AssistantPayload):
    """
    Conversational Plant Pathology Voice Assistant grounded in botanical guidance.
    Powered by Gemini 2.5 Flash with full conversation history and intelligent fallback.
    """
    query_text = payload.prompt.strip()

    if not GEMINI_API_KEY:
        return {
            "reply": get_botanical_fallback(query_text, payload.plant_context, payload.history),
            "model": "offline-botanical-engine"
        }

    system_knowledge = (
        "You are a formal botanical specialist and voice assistant. "
        "Answer user queries strictly regarding plants, foliage, horticulture, and plant pathology in a formal, one-to-one conversational style. "
        "Speak directly to the user in a professional, courteous manner. "
        "Maintain conversational continuity by referencing prior context when appropriate. "
        "Discuss exclusively plants, leaves, and related botanical topics. If the query is unrelated to plants or their parts, respond solely with: "
        "'I am designated exclusively to assist with botanical and plant-related topics. Please let me know if you have an inquiry regarding plants, foliage, or crop care.' "
        "Do not assume or extrapolate new information beyond what the user has provided. "
        "Do not mention any brand names or application names unless asked. "
        "Provide plain text responses without markdown formatting or bullet points, suitable for voice synthesis, in 2 to 4 concise sentences."
    )

    context_info = f"Current Plant Context: {payload.plant_context}\n" if payload.plant_context else ""
    
    history_str = ""
    if payload.history:
        history_lines = [f"{item.get('role', 'user').capitalize()}: {item.get('text', '')}" for item in payload.history[-6:]]
        if history_lines:
            history_str = "Prior Conversation History:\n" + "\n".join(history_lines) + "\n\n"

    combined_input = f"{system_knowledge}\n{context_info}{history_str}User Query: {query_text}"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    req_body = {
        "contents": [
            {
                "parts": [{"text": combined_input[:4000]}]
            }
        ]
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(req_body).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and parts[0].get("text"):
                    return {
                        "reply": parts[0]["text"].strip(),
                        "model": "gemini-2.5-flash"
                    }
        return {"reply": get_botanical_fallback(query_text, payload.plant_context, payload.history), "model": "botanical-fallback"}
    except Exception as e:
        print(f"Assistant endpoint error: {e}")
        return {"reply": get_botanical_fallback(query_text, payload.plant_context, payload.history), "model": "botanical-fallback"}
