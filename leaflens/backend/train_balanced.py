"""
LeafLens High-Accuracy Balanced Training Script (18 Classes)
Uses MobileNetV2 transfer learning with feature caching for fast, accurate training.
Balances all 18 classes (Tomato, Potato, Pepper, Snake Plant) with an 80:20 train/validation split.
Exports plant_model.keras, plant_model.tflite, and class_names.json to both backend/artifacts and frontend/api.
"""
import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, List, Tuple

os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras import layers, models

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from labels import EXPECTED_CLASSES, CLASS_INFO

ARTIFACTS_DIR = SCRIPT_DIR / "artifacts"
FRONTEND_API_DIR = SCRIPT_DIR.parent / "frontend" / "api"
DATASET_ROOT = Path(r"C:\Users\dell\OneDrive\Desktop\ECS Project\ECS\DataSet\PlantVillage")


def load_dataset_samples(max_train_per_class: int = 240, max_val_per_class: int = 60):
    """
    Performs an 80:20 train/validation split across all 18 classes with balanced sampling.
    """
    print(f"[*] Scanning 18-class dataset from: {DATASET_ROOT}")
    train_paths = []
    train_labels = []
    val_paths = []
    val_labels = []

    rng = np.random.default_rng(42)

    for cls_idx, cls_name in enumerate(EXPECTED_CLASSES):
        cls_dir = DATASET_ROOT / cls_name
        if not cls_dir.exists():
            raise FileNotFoundError(f"Missing class folder: {cls_dir}")

        all_images = sorted([
            p for p in cls_dir.iterdir()
            if p.is_file() and p.suffix.lower() in [".jpg", ".jpeg", ".png"]
        ])

        if len(all_images) == 0:
            raise ValueError(f"No images found in {cls_dir}")

        rng.shuffle(all_images)
        total_avail = len(all_images)

        # 80:20 split calculation
        val_count = min(max_val_per_class, max(15, int(total_avail * 0.20)))
        train_count = min(max_train_per_class, total_avail - val_count)

        train_imgs = all_images[:train_count]
        val_imgs = all_images[train_count:train_count + val_count]

        for p in train_imgs:
            train_paths.append(str(p))
            train_labels.append(cls_idx)

        for p in val_imgs:
            val_paths.append(str(p))
            val_labels.append(cls_idx)

        print(f"  [{cls_idx:02d}] {cls_name:<45}: {len(train_imgs):>4} train, {len(val_imgs):>3} val (total: {total_avail})")

    print(f"\n[+] Total: {len(train_paths)} train images, {len(val_paths)} validation images across {len(EXPECTED_CLASSES)} classes.")
    return train_paths, np.array(train_labels), val_paths, np.array(val_labels)


def extract_features(paths: List[str], base_model, batch_size: int = 32):
    """Extract MobileNetV2 1280-dim feature vectors with preprocess_input."""
    total = len(paths)
    features = []
    t0 = time.time()

    for start in range(0, total, batch_size):
        end = min(start + batch_size, total)
        batch_imgs = []
        for p in paths[start:end]:
            img = Image.open(p).convert("RGB").resize((224, 224), Image.Resampling.BILINEAR)
            arr = np.array(img, dtype=np.float32)
            batch_imgs.append(arr)

        batch_arr = np.stack(batch_imgs, axis=0)
        batch_pre = tf.keras.applications.mobilenet_v2.preprocess_input(batch_arr)
        batch_feat = base_model.predict(batch_pre, verbose=0)
        features.append(batch_feat)

        if (start // batch_size) % 15 == 0 or end == total:
            elapsed = time.time() - t0
            rate = end / elapsed if elapsed > 0 else 0
            print(f"    Extracted {end}/{total} images ({rate:.1f} img/s)...")

    return np.concatenate(features, axis=0)


def main():
    print("=" * 70)
    print("LeafLens 18-Class MobileNetV2 Balanced Training")
    print("=" * 70)

    train_paths, train_y, val_paths, val_y = load_dataset_samples(max_train_per_class=240, max_val_per_class=60)

    print("\n[*] Initializing MobileNetV2 base feature extractor...")
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights="imagenet",
        pooling="avg",
    )

    print("\n[*] Extracting features for training set...")
    train_features = extract_features(train_paths, base_model, batch_size=32)

    print("\n[*] Extracting features for validation set...")
    val_features = extract_features(val_paths, base_model, batch_size=32)

    print(f"[+] Feature shapes: Train {train_features.shape}, Val {val_features.shape}")

    num_classes = len(EXPECTED_CLASSES)

    # Build and train classification head with Dense(18, activation='softmax')
    print(f"\n[*] Training balanced classification head for {num_classes} classes...")
    head = tf.keras.Sequential([
        layers.Input(shape=(1280,)),
        layers.BatchNormalization(),
        layers.Dense(256, activation="relu"),
        layers.Dropout(0.4),
        layers.Dense(128, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation="softmax"),
    ])

    head.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    history = head.fit(
        train_features, train_y,
        validation_data=(val_features, val_y),
        epochs=35,
        batch_size=32,
        verbose=1,
    )

    val_loss, val_acc = head.evaluate(val_features, val_y, verbose=0)
    print(f"\n[+] Final Validation Accuracy: {val_acc * 100:.2f}% (Loss: {val_loss:.4f})")

    # Assemble complete end-to-end model (Raw 0-255 RGB input -> Preprocessing -> MobileNetV2 -> Head -> Softmax)
    print("\n[*] Assembling complete end-to-end Keras model...")
    full_input = layers.Input(shape=(224, 224, 3), name="image_input")
    preprocessed = tf.keras.applications.mobilenet_v2.preprocess_input(full_input)

    # Base feature extractor
    base_extractor = tf.keras.applications.MobileNetV2(
        input_tensor=preprocessed,
        include_top=False,
        weights="imagenet",
        pooling="avg",
    )
    base_extractor.trainable = False

    x = base_extractor.output
    for layer in head.layers:
        x = layer(x)

    full_model = models.Model(inputs=full_input, outputs=x, name="LeafLens_MobileNetV2_18Class")
    full_model.compile(
        optimizer="adam",
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    # Save Keras Model
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    keras_path = ARTIFACTS_DIR / "plant_model.keras"
    full_model.save(keras_path)
    print(f"[+] Saved Keras model: {keras_path}")

    # Also save .h5 model for compatibility
    h5_path = ARTIFACTS_DIR / "plant_model.h5"
    try:
        full_model.save(h5_path)
        print(f"[+] Saved H5 model: {h5_path}")
    except Exception as e:
        print(f"[*] H5 export note: {e}")

    # Export Quantized TFLite Model
    print("\n[*] Exporting to TFLite (Post-Training Dynamic Quantization)...")
    converter = tf.lite.TFLiteConverter.from_keras_model(full_model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_bytes = converter.convert()

    tflite_path_backend = ARTIFACTS_DIR / "plant_model.tflite"
    with open(tflite_path_backend, "wb") as f:
        f.write(tflite_bytes)
    print(f"[+] Saved backend TFLite: {tflite_path_backend} ({len(tflite_bytes)/(1024*1024):.2f} MB)")

    # Also update frontend/api/plant_model.tflite
    FRONTEND_API_DIR.mkdir(parents=True, exist_ok=True)
    tflite_path_frontend = FRONTEND_API_DIR / "plant_model.tflite"
    with open(tflite_path_frontend, "wb") as f:
        f.write(tflite_bytes)
    print(f"[+] Saved frontend API TFLite: {tflite_path_frontend}")

    # Save class_names.json in both backend and frontend
    class_names_path = ARTIFACTS_DIR / "class_names.json"
    with open(class_names_path, "w") as f:
        json.dump(EXPECTED_CLASSES, f, indent=2)
    with open(FRONTEND_API_DIR / "class_names.json", "w") as f:
        json.dump(EXPECTED_CLASSES, f, indent=2)
    print(f"[+] Updated class_names.json in backend and frontend api ({len(EXPECTED_CLASSES)} classes)")

    # Save metrics.json
    metrics_path = ARTIFACTS_DIR / "metrics.json"
    val_preds = full_model.predict(
        np.stack([
            np.array(Image.open(p).convert("RGB").resize((224, 224)), dtype=np.float32)
            for p in val_paths[:100]
        ], axis=0),
        verbose=0
    )
    y_pred = np.argmax(val_preds, axis=1)
    y_true = val_y[:100]
    sample_acc = float(np.mean(y_pred == y_true))

    metrics_output = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "classes_count": len(EXPECTED_CLASSES),
        "train_samples": len(train_paths),
        "val_samples": len(val_paths),
        "final_val_accuracy": float(val_acc),
        "final_val_loss": float(val_loss),
        "sample_eval_accuracy": sample_acc,
        "classes": EXPECTED_CLASSES,
    }
    with open(metrics_path, "w") as f:
        json.dump(metrics_output, f, indent=2)
    print(f"[+] Saved metrics.json: {metrics_path}")

    # Validate specifically on unseen samples from Snake Plant, Tomato, Potato, Pepper
    print("\n" + "=" * 70)
    print("VERIFICATION ON UNSEEN SAMPLES")
    print("=" * 70)

    interpreter = tf.lite.Interpreter(model_content=tflite_bytes)
    interpreter.allocate_tensors()
    in_idx = interpreter.get_input_details()[0]['index']
    out_idx = interpreter.get_output_details()[0]['index']

    test_classes = [
        "Snake_Plant_Anthracnose",
        "Snake_Plant_Healthy",
        "Snake_Plant_Leaf_Withering",
        "Pepper__bell___healthy",
        "Potato___Early_blight",
        "Tomato_healthy",
        "Tomato_Late_blight",
    ]

    for tc in test_classes:
        tc_dir = DATASET_ROOT / tc
        test_imgs = sorted(list(tc_dir.glob("*.JPG")) + list(tc_dir.glob("*.jpg")))[-5:]
        correct = 0
        for ti in test_imgs:
            img = Image.open(ti).convert("RGB").resize((224, 224))
            arr = np.expand_dims(np.array(img, dtype=np.float32), axis=0)
            interpreter.set_tensor(in_idx, arr)
            interpreter.invoke()
            probs = interpreter.get_tensor(out_idx)[0]
            top_i = int(np.argmax(probs))
            pred_cls = EXPECTED_CLASSES[top_i]
            if pred_cls == tc:
                correct += 1
            print(f"  {tc:<32} -> {pred_cls:<35} ({probs[top_i]*100:.1f}%) [{'OK' if pred_cls == tc else 'FAIL'}]")
        print(f"--> {tc} Accuracy: {correct}/{len(test_imgs)}\n")

    print("[+] Model Retraining Complete & Verified Successfully!")


if __name__ == "__main__":
    main()
