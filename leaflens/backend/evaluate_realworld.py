"""
Evaluation script for LeafLens Real-World Test Set.
Evaluates photos across 4 categories:
1. Healthy leaves (Tomato, Potato, Pepper)
2. Diseased leaves (Tomato, Potato, Pepper)
3. Unsupported plants (Crops other than tomato/potato/pepper, houseplants)
4. Non-plant images (Walls, faces, furniture, textures)

Reports real-world accuracy, out-of-distribution rejection rate, and latency.
"""

import sys
import io
import time
import glob
from pathlib import Path
from typing import Dict, List, Any

import numpy as np
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
TEST_ASSETS_DIR = PROJECT_ROOT / "test_assets" / "real_world"

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from server import aggregate_crop_predictions, load_model_if_available
import server


def compute_broad_vegetation_ratio(img: Image.Image) -> float:
    """Evaluate fraction of organic leaf pixels (green, chlorotic yellow, brown lesions)."""
    rgb_arr = np.array(img.convert("RGB"), dtype=np.float32)
    r = rgb_arr[:, :, 0]
    g = rgb_arr[:, :, 1]
    b = rgb_arr[:, :, 2]

    # Normalize to 0-1
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    delta = mx - mn

    v = mx / 255.0
    s = np.where(mx == 0, 0, delta / mx)

    # Hue calculation
    h = np.zeros_like(mx)
    mask_r = (mx == r) & (delta != 0)
    mask_g = (mx == g) & (delta != 0)
    mask_b = (mx == b) & (delta != 0)

    h[mask_r] = (((g[mask_r] - b[mask_r]) / delta[mask_r]) % 6) * 60
    h[mask_g] = (((b[mask_g] - r[mask_g]) / delta[mask_g]) + 2) * 60
    h[mask_b] = (((r[mask_b] - g[mask_b]) / delta[mask_b]) + 4) * 60
    h[h < 0] += 360

    is_green = (h >= 35) & (h <= 105) & (s > 0.15) & (v > 0.15)
    is_yellow = (h >= 20) & (h < 35) & (s > 0.15) & (v > 0.20)
    is_brown = (h >= 10) & (h <= 25) & (s > 0.12) & (v >= 0.10) & (v <= 0.70)
    is_foliage = (g > b + 15) & (g > r * 0.85) & (s > 0.12)

    veg_mask = is_green | is_yellow | is_brown | is_foliage
    return float(np.mean(veg_mask))


def extract_crops_from_image(img: Image.Image):
    """Replicates the multi-crop scanner pipeline: 1 full-frame + 3x3 overlapping crops."""
    w, h = img.size
    size = min(w, h)
    sx = (w - size) // 2
    sy = (h - size) // 2
    square_img = img.crop((sx, sy, sx + size, sy + size))

    crops = []
    crop_metas = []

    # 1. Full square crop
    full_crop = square_img.resize((224, 224), Image.Resampling.BILINEAR)
    full_ratio = compute_broad_vegetation_ratio(full_crop)
    if full_ratio >= 0.12:
        crops.append(np.array(full_crop, dtype=np.float32))
        crop_metas.append({"box": [0, 0, 1, 1], "green_ratio": full_ratio})

    # 2. 3x3 overlapping crops
    stride = 0.25
    crop_sz = 0.5
    for row in range(3):
        for col in range(3):
            px1 = int(col * stride * size)
            py1 = int(row * stride * size)
            px2 = int(px1 + crop_sz * size)
            py2 = int(py1 + crop_sz * size)

            c_img = square_img.crop((px1, py1, px2, py2)).resize((224, 224), Image.Resampling.BILINEAR)
            ratio = compute_broad_vegetation_ratio(c_img)
            if ratio >= 0.12:
                crops.append(np.array(c_img, dtype=np.float32))
                crop_metas.append({
                    "box": [col * stride, row * stride, col * stride + crop_sz, row * stride + crop_sz],
                    "green_ratio": ratio,
                })

    return crops, crop_metas


def evaluate_single_image(image_path: Path):
    """Run single image through full scan pipeline."""
    img = Image.open(image_path).convert("RGB")
    crops, metas = extract_crops_from_image(img)

    if len(crops) < 2:
        return {
            "verdict": "uncertain",
            "reason": "insufficient_leaf_regions",
            "message": "Couldn't find clear leaf regions.",
            "crops_passed": len(crops),
        }

    batch_arr = np.stack(crops, axis=0)
    probabilities = server.MODEL.predict(batch_arr, verbose=0)
    res = aggregate_crop_predictions(probabilities, metas, server.CLASS_NAMES)
    res["crops_passed"] = len(crops)
    return res


def run_evaluation():
    print("=" * 70)
    print("LEALLENS REAL-WORLD TEST SET BENCHMARK")
    print("=" * 70)

    if not load_model_if_available():
        print("[!] Error: Model not available. Run train.py first.")
        return

    categories = ["healthy_leaf", "diseased_leaf", "unsupported_plants", "non_plants"]
    summary: Dict[str, Dict[str, Any]] = {}

    for cat in categories:
        cat_dir = TEST_ASSETS_DIR / cat
        cat_dir.mkdir(parents=True, exist_ok=True)
        img_paths = list(cat_dir.glob("*.jpg")) + list(cat_dir.glob("*.png")) + list(cat_dir.glob("*.jpeg")) + list(cat_dir.glob("*.webp"))

        print(f"\n--- Category: {cat} ({len(img_paths)} images) ---")
        verdicts = []
        latencies = []

        for p in img_paths:
            t0 = time.perf_counter()
            res = evaluate_single_image(p)
            elapsed = (time.perf_counter() - t0) * 1000
            latencies.append(elapsed)
            verdicts.append(res["verdict"])
            print(f"  {p.name:<30} -> Verdict: {res['verdict']:<10} | Crops: {res.get('crops_passed', 0)} | Time: {elapsed:.1f}ms")

        summary[cat] = {
            "total": len(img_paths),
            "verdicts": verdicts,
            "avg_latency_ms": np.mean(latencies) if latencies else 0.0,
        }

    print("\n" + "=" * 70)
    print("REAL-WORLD EVALUATION RESULTS")
    print("=" * 70)
    for cat, data in summary.items():
        v_counts = {}
        for v in data["verdicts"]:
            v_counts[v] = v_counts.get(v, 0) + 1
        print(f"{cat:<20} | Total: {data['total']:<3} | Avg Latency: {data['avg_latency_ms']:.1f}ms | Distribution: {v_counts}")
    print("=" * 70)


if __name__ == "__main__":
    run_evaluation()
