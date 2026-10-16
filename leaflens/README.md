# LeafLens — Smart Plant Leaf Disease Classification Prototype
> **ECS Mini-Project (2026–2027)**  
> Software prototype simulating an embedded hardware plant inspection device (Camera + RGB Traffic-Light Indicator + Buzzer / LCD).

---

## 1. Project Overview

**LeafLens** is a locally-runnable leaf disease classification prototype designed to inspect and monitor crop health. It simulates a planned physical hardware device consisting of a camera focused on plant leaves and an RGB traffic-light status indicator:

- 🟢 **Healthy** — Leaf analysis indicates healthy crop tissue with high confidence.
- 🔴 **Needs Attention** — Specific leaf disease or pathogen symptoms detected.
- 🟡 **Not Sure / Uncertain** — Leaf analysis unclear, insufficient organic leaf tissue detected, or image outside supported crop scope.

### Strict Crop Scope (15 Classes)
The model is strictly bounded to three agricultural crops across 15 distinct classes:
1. **Pepper (bell)**: Healthy, Bacterial spot
2. **Potato**: Healthy, Early blight, Late blight
3. **Tomato**: Healthy, Bacterial spot, Early blight, Late blight, Leaf mold, Septoria leaf spot, Spider mites (two-spotted), Target spot, Tomato yellow leaf curl virus, Tomato mosaic virus

> [!IMPORTANT]
> **Prototype Scope & Purpose**: LeafLens is a **leaf disease classification prototype**, not a general botanical diagnosis engine. It does not provide chemical treatment prescriptions, manage user accounts, or upload data to cloud servers.

---

## 2. Privacy & Performance Commitments

- 🔒 **Privacy Guarantee**:  
  **"Images are processed locally for this prototype and are not uploaded or stored."**  
  All camera frames and uploaded photos remain entirely on the local device and in-memory. No images or telemetry are transmitted to any remote cloud service or stored to persistent disk storage.

- ⚡ **Performance Target**:  
  **Target: under 3 seconds on a normal laptop.**  
  Client-side multi-frame capture and backend multi-crop batch inference are designed to complete in under 3 seconds on standard laptop hardware.

---

## 3. Tech Stack & Architecture

- **Frontend**:
  - **Framework**: React 19 + TypeScript + Vite 8
  - **Styling**: Pure vanilla CSS (No external UI frameworks, no Tailwind, no animation libraries).
  - **Typography**: Local `@font-face` woff2 assets for **Epilogue Black** (900 weight headlines) and **DM Sans Regular** (400 weight body text).
  - **Color Palette**: Plant-based muted greens (`#b9d3b3`, `#dcebd7`, `#0d2418`, `#eef5ea`, `#2f6b45`, `#3f8258`, `#255338`).
  - **Interactive Pots Mascot**: Custom layered SVG pots with dual-axis eye tracking (desktop rAF lerp with 8px deadzone and bounds containment, mobile 4s synchronized circular orbit, respects `prefers-reduced-motion`).
  - **Camera API**: `navigator.mediaDevices.getUserMedia` with front/back camera cycling, active camera labeling, and fallback photo upload.
  - **Leaf Map**: Interactive SVG/Canvas overlay displaying color-coded bounding boxes for each candidate leaf patch.

- **Backend**:
  - **Framework**: Python 3.10+ with FastAPI and Uvicorn.
  - **Dependencies**: Managed via `backend/requirements.txt`.
  - **Deep Learning Model**: Transfer learning with **MobileNetV2** (ImageNet pre-trained base).
  - **Input Preprocessing**: Internal `tf.keras.applications.mobilenet_v2.preprocess_input` layer allowing raw `[0, 255]` RGB inputs.
  - **Crop Pipeline**: Each captured frame creates one full-frame crop and nine overlapping crops. Four captured frames can produce up to 40 crops before candidate filtering.
  - **Candidate Filtering**: Broad vegetation filtering (accepting green, chlorotic yellow, and necrotic brown lesion tones).
  - **Inference Gating**: Weighted probability aggregation across surviving crops, confidence and prediction-margin gating (`confidence >= 0.60`, `margin >= 0.15`), and cross-crop plant consistency checking (`mixed_plants`).
  - **Hardware Export**: Post-training quantized **TFLite** export (`plant_model.tflite`, ~2.56 MB) for future Raspberry Pi deployment.

---

## 4. Dataset Audit & Safe Deduplication

The dataset source is Kaggle **PlantVillage** for Pepper (bell), Potato, and Tomato.

### Cross-Class Hash Collision Verification
During data loading, an MD5 hash was computed across all image files.
1. **Zero Cross-Class Contradictions**: The audit confirmed that zero duplicate hashes exist across different class folders. (Any cross-class collision triggers a fatal error).
2. **Intra-Class Deduplication**: Duplicates within the same class folder were safely removed to prevent data leakage between train and validation splits.
3. **Audit Results**:
   - **Total images scanned**: 20,638
   - **Intra-class duplicates removed**: 14 (8 in `Tomato_Late_blight`, 6 in `Tomato_healthy`)
   - **Final unique dataset**: 20,624 images across exactly 15 classes.

---

## 5. Current Training Status & Metrics (Verified)

> [!NOTE]
> **Verified Status**:
> - **Quick-mode training completed.**
> - **1,028 sampled images were used**: 819 training and 209 validation images.
> - **Current quick-mode validation accuracy**: **55.98%** (validation loss: 1.5375).
> - **Full training is still required before reporting final PlantVillage metrics.**

### Quick-Mode Baseline Classification Report (209 Validation Samples)

| Class | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: |
| `Pepper__bell___Bacterial_spot` | 1.00 | 0.20 | 0.33 | 10 |
| `Pepper__bell___healthy` | 0.82 | 0.93 | 0.88 | 15 |
| `Potato___Early_blight` | 1.00 | 0.70 | 0.82 | 10 |
| `Potato___Late_blight` | 0.71 | 0.50 | 0.59 | 10 |
| `Potato___healthy` | 0.00 | 0.00 | 0.00 | 2 |
| `Tomato_Bacterial_spot` | 0.58 | 0.64 | 0.61 | 22 |
| `Tomato_Early_blight` | 0.00 | 0.00 | 0.00 | 10 |
| `Tomato_Late_blight` | 0.41 | 0.68 | 0.51 | 19 |
| `Tomato_Leaf_Mold` | 0.50 | 0.10 | 0.17 | 10 |
| `Tomato_Septoria_leaf_spot` | 0.71 | 0.28 | 0.40 | 18 |
| `Tomato_Spider_mites_Two_spotted_spider_mite` | 0.29 | 1.00 | 0.45 | 17 |
| `Tomato__Target_Spot` | 0.50 | 0.43 | 0.46 | 14 |
| `Tomato__Tomato_YellowLeaf__Curl_Virus` | 0.84 | 0.84 | 0.84 | 32 |
| `Tomato__Tomato_mosaic_virus` | 0.00 | 0.00 | 0.00 | 4 |
| `Tomato_healthy` | 0.75 | 0.38 | 0.50 | 16 |
| **Overall Accuracy** | | | **55.98%** | **209** |

---

## 6. Real-World Benchmark & Out-of-Distribution Handling

> [!WARNING]
> LeafLens uses vegetation filtering, confidence thresholds, prediction-margin thresholds, and crop-consistency checks to reduce unsupported-image mistakes. These safeguards cannot guarantee rejection of every unsupported plant or non-plant image.

### Test Asset Sample Counts & Evaluation
- **Original Baseline Test Suite (6 images)**:
  - `healthy_leaf`: 1 image (`pepper_healthy_heldout.jpg`)
  - `diseased_leaf`: 1 image (`tomato_late_blight_heldout.jpg`)
  - `unsupported_plants`: 1 image (`purple_flower.jpg`)
  - `non_plants`: 3 images (`ceramic_pots.webp`, `ui_screenshot.png`, `white_wall.jpg`)

- **Expanded Test Suite (19 images)**:
  - `healthy_leaf` (3 images): Pepper healthy, Potato healthy, Tomato healthy
  - `diseased_leaf` (5 images): Pepper bacterial spot, Potato early blight, Tomato bacterial spot, Tomato late blight, Tomato target spot
  - `unsupported_plants` (4 images): Aloe succulent, Monstera leaf, Purple flower, Yellow marigold flower
  - `non_plants` (7 images): Blue sky with clouds, Brick wall texture, Ceramic pots, Human face portrait, UI screenshot, White wall, Wood desk surface

*Broader field testing across diverse lighting conditions, garden backgrounds, and camera sensors remains necessary before claiming general real-world accuracy.*

---

## 7. Automated Unit Tests

Automated tests are defined in `backend/test_aggregation.py` and run against the dependencies in `backend/requirements.txt`:

```powershell
cd leaflens/backend
.\.venv\Scripts\python.exe -m pytest test_aggregation.py -q
```

**Verified Test Output**:
```text
......                                                                   [100%]
6 passed in 7.21s
```

---

## 8. Quick Start & Execution Commands

### 1. Set Up Backend Virtual Environment
```bash
cd leaflens/backend
python -m venv .venv

# Activate environment (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install all runtime & test dependencies
pip install -r requirements.txt
```

### 2. Training the Model
```bash
# Quick-mode training (~5% data, smoke test)
python train.py --quick

# Full production training (required for final PlantVillage metrics)
python train.py --epochs 4 --finetune-epochs 2
```

### 3. Running Backend Server
```bash
uvicorn server:app --host 127.0.0.1 --port 8000
```
Verify health: `curl http://127.0.0.1:8000/api/health`

### 4. Running Frontend Application
```bash
cd leaflens/frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Testing on Mobile Device (LAN)
```bash
# In frontend directory:
npm run dev -- --host

# Or with HTTPS enabled via basic-ssl plugin:
$env:VITE_HTTPS="1"; npm run dev -- --host
```

---

## 9. Known Limitations (Section 9 Disclosure)

1. **Strict 3-Crop Scope**: The model is trained exclusively on Tomato, Potato, and Pepper (bell) across 15 classes. Other plant species are outside the training domain and rejected only via candidate filtering and confidence/margin gates.
2. **Laboratory vs. Field Bias**: PlantVillage images are clean, isolated leaves photographed against neutral grey backgrounds under studio lighting. Real-world leaves with shadows, soil backgrounds, or partial framing may exhibit lower confidence.
3. **Prototype Role**: LeafLens is a software prototype for validating computer vision pipelines and user experience before hardware assembly. The exported `plant_model.tflite` model bridges this prototype to the planned Raspberry Pi embedded device.
