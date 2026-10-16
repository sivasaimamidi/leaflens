"""
LeafLens Training Pipeline
MobileNetV2 Transfer Learning for Leaf Disease Classification.
Handles dataset verification, cross-class collision checks, MD5 deduplication,
stratified train/val split, augmentation, two-stage training, metrics generation,
and TFLite export.
"""

import os
import sys
import json
import time
import hashlib
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Set, Optional

import numpy as np

# Ensure backend directory is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

# Ensure live line-buffering for logs on Windows
try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

from labels import CLASS_INFO, EXPECTED_CLASSES


def compute_md5(file_path: Path, chunk_size: int = 65536) -> str:
    """Compute MD5 hash of file contents."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()


def scan_and_deduplicate_dataset(
    dataset_root: Path,
    cache_path: Optional[Path] = None,
    force: bool = False,
) -> Tuple[Dict[str, List[Path]], Dict[str, int], int]:
    """
    Walk dataset root, validate classes, check cross-class hash collisions,
    and deduplicate images within each class. Caches results to avoid 1-min rehashing on repeat runs.
    """
    if not dataset_root.exists():
        raise FileNotFoundError(f"Dataset root directory does not exist: {dataset_root}")

    if cache_path and cache_path.exists() and not force:
        try:
            print(f"[*] Loading deduplication cache from {cache_path}...")
            with open(cache_path, "r") as f:
                data = json.load(f)
            valid_files = {k: [Path(p) for p in v] for k, v in data["valid_files"].items()}
            if len(valid_files) == 15 and all(len(p) > 0 for p in valid_files.values()):
                print(f"[+] Loaded {data['total_unique']} unique images across 15 classes from cache.")
                return valid_files, data.get("duplicates_removed", {}), data.get("total_scanned", data['total_unique'])
        except Exception as e:
            print(f"Cache load skipped: {e}")

    print(f"[*] Scanning dataset at: {dataset_root}")
    
    # 1. Discover valid class folders
    found_class_dirs: Dict[str, Path] = {}
    for entry in dataset_root.iterdir():
        if entry.is_dir():
            if entry.name in EXPECTED_CLASSES:
                image_files = [
                    p for p in entry.iterdir()
                    if p.is_file() and p.suffix.lower() in [".jpg", ".jpeg", ".png"]
                ]
                if image_files:
                    found_class_dirs[entry.name] = entry

    print(f"[*] Discovered {len(found_class_dirs)} valid class folders matching expected names.")
    if len(found_class_dirs) != len(EXPECTED_CLASSES):
        missing = set(EXPECTED_CLASSES) - set(found_class_dirs.keys())
        extra = set(found_class_dirs.keys()) - set(EXPECTED_CLASSES)
        raise ValueError(
            f"Expected exactly {len(EXPECTED_CLASSES)} classes, but found {len(found_class_dirs)}.\n"
            f"Missing classes: {sorted(list(missing))}\n"
            f"Extra / Unmatched: {sorted(list(extra))}"
        )

    # 2. De-duplicate images with cross-class collision detection
    seen_hashes: Dict[str, Tuple[str, Path]] = {}
    valid_files_by_class: Dict[str, List[Path]] = defaultdict(list)
    duplicates_removed_by_class: Dict[str, int] = defaultdict(int)
    total_images_found = 0

    for class_name in sorted(found_class_dirs.keys()):
        class_dir = found_class_dirs[class_name]
        raw_files = sorted([
            p for p in class_dir.iterdir()
            if p.is_file() and p.suffix.lower() in [".jpg", ".jpeg", ".png"]
        ])
        total_images_found += len(raw_files)

        for file_path in raw_files:
            file_hash = compute_md5(file_path)
            if file_hash in seen_hashes:
                prev_class, prev_path = seen_hashes[file_hash]
                if prev_class != class_name:
                    raise RuntimeError(
                        f"FATAL: Cross-class hash collision detected!\n"
                        f"Identical file content found in two different classes:\n"
                        f"  Class 1: {prev_class} -> {prev_path}\n"
                        f"  Class 2: {class_name} -> {file_path}\n"
                        f"Hash: {file_hash}\n"
                        f"Halting training to prevent label corruption."
                    )
                else:
                    duplicates_removed_by_class[class_name] += 1
            else:
                seen_hashes[file_hash] = (class_name, file_path)
                valid_files_by_class[class_name].append(file_path)

    total_duplicates = sum(duplicates_removed_by_class.values())
    total_valid = sum(len(f) for f in valid_files_by_class.values())

    print("\n" + "=" * 65)
    print("DATASET AUDIT AND DEDUPLICATION REPORT")
    print("=" * 65)
    print(f"Total raw images scanned : {total_images_found}")
    print(f"Exact duplicates removed : {total_duplicates}")
    print(f"Total unique images kept : {total_valid}")
    print("-" * 65)
    print(f"{'Class Name':<45} | {'Unique Count':<12}")
    print("-" * 65)
    for c in sorted(valid_files_by_class.keys()):
        print(f"{c:<45} | {len(valid_files_by_class[c]):<12}")
    print("=" * 65 + "\n")

    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w") as f:
            json.dump({
                "total_scanned": total_images_found,
                "total_unique": total_valid,
                "duplicates_removed": dict(duplicates_removed_by_class),
                "valid_files": {k: [str(p) for p in v] for k, v in valid_files_by_class.items()},
            }, f, indent=2)

    return valid_files_by_class, duplicates_removed_by_class, total_images_found

    return valid_files_by_class, duplicates_removed_by_class, total_images_found


def stratified_split(
    files_by_class: Dict[str, List[Path]],
    val_split: float = 0.2,
    seed: int = 123,
    quick: bool = False,
) -> Tuple[List[str], List[int], List[str], List[int], List[str]]:
    """
    Perform stratified 80/20 train/validation split per class with fixed seed.
    If quick=True, samples ~5% of data for fast smoke test.
    
    Returns:
        train_paths, train_labels, val_paths, val_labels, class_names
    """
    rng = np.random.default_rng(seed)
    class_names = sorted(list(files_by_class.keys()))
    class_to_idx = {name: idx for idx, name in enumerate(class_names)}

    train_paths: List[str] = []
    train_labels: List[int] = []
    val_paths: List[str] = []
    val_labels: List[int] = []

    for class_name in class_names:
        files = list(files_by_class[class_name])
        # Sort for deterministic shuffling across platforms
        files.sort()
        indices = np.arange(len(files))
        rng.shuffle(indices)

        if quick:
            # Use ~5% of files (minimum 10 per class)
            quick_count = max(10, int(len(files) * 0.05))
            indices = indices[:quick_count]

        split_idx = int(len(indices) * (1.0 - val_split))
        train_idx = indices[:split_idx]
        val_idx = indices[split_idx:]

        cls_id = class_to_idx[class_name]
        for idx in train_idx:
            train_paths.append(str(files[idx]))
            train_labels.append(cls_id)
        for idx in val_idx:
            val_paths.append(str(files[idx]))
            val_labels.append(cls_id)

    # Verification: no file in both sets
    overlap = set(train_paths).intersection(set(val_paths))
    if overlap:
        raise RuntimeError(f"Leakage error: {len(overlap)} files appear in both train and val!")

    print(f"[*] Stratified split complete: {len(train_paths)} train, {len(val_paths)} validation images.")
    return train_paths, train_labels, val_paths, val_labels, class_names


def build_model(num_classes: int = len(EXPECTED_CLASSES)):
    """
    Build MobileNetV2 transfer learning model.
    Includes mobilenet_v2.preprocess_input inside the model so server receives raw 0-255 RGB.
    """
    import tensorflow as tf
    from tensorflow.keras import layers, models

    inputs = layers.Input(shape=(224, 224, 3), name="image_input")
    # Preprocessing inside the model: scales [0, 255] to [-1, 1]
    preprocessed = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)

    base_model = tf.keras.applications.MobileNetV2(
        input_tensor=preprocessed,
        weights="imagenet",
        include_top=False,
    )
    # Stage 1: Freeze base model
    base_model.trainable = False

    x = layers.GlobalAveragePooling2D(name="avg_pool")(base_model.output)
    x = layers.Dense(128, activation="relu", name="dense_128")(x)
    x = layers.Dropout(0.3, name="dropout_head")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    model = models.Model(inputs=inputs, outputs=outputs, name="LeafLens_MobileNetV2")
    return model, base_model


def get_augmentation_layer():
    """Keras data augmentation pipeline for training."""
    import tensorflow as tf
    from tensorflow.keras import layers

    return tf.keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(25.0 / 360.0),
        layers.RandomZoom((-0.2, 0.2)),
        layers.RandomBrightness(0.2),
        layers.RandomContrast(0.2),
    ], name="data_augmentation")


def make_dataset(
    paths: List[str],
    labels: List[int],
    batch_size: int,
    is_training: bool = False,
    augmenter=None,
):
    """Create tf.data.Dataset with caching and prefetching."""
    import tensorflow as tf

    def load_image(path, label):
        img_raw = tf.io.read_file(path)
        img = tf.image.decode_jpeg(img_raw, channels=3)
        img = tf.image.resize(img, [224, 224])
        return img, label

    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))
    if is_training:
        dataset = dataset.shuffle(buffer_size=min(len(paths), 2048), seed=123, reshuffle_each_iteration=True)

    dataset = dataset.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)

    if is_training and augmenter is not None:
        dataset = dataset.map(lambda x, y: (augmenter(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)

    dataset = dataset.batch(batch_size)
    dataset = dataset.prefetch(buffer_size=tf.data.AUTOTUNE)
    return dataset


def export_tflite(model, tflite_path: Path):
    """Export model to TFLite with post-training quantization."""
    import tensorflow as tf

    print(f"[*] Exporting quantized TFLite model to {tflite_path}...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    with open(tflite_path, "wb") as f:
        f.write(tflite_model)
    size_mb = len(tflite_model) / (1024 * 1024)
    print(f"[+] TFLite model successfully written ({size_mb:.2f} MB).")


def plot_metrics_and_curves(
    history_stage1,
    history_stage2,
    y_true,
    y_pred,
    class_names,
    artifacts_dir: Path,
):
    """Generate and save training curves and confusion matrix."""
    import matplotlib.pyplot as plt
    import seaborn as sns
    from sklearn.metrics import confusion_matrix, classification_report

    # 1. Combine histories
    acc = list(history_stage1.history.get("accuracy", []))
    val_acc = list(history_stage1.history.get("val_accuracy", []))
    loss = list(history_stage1.history.get("loss", []))
    val_loss = list(history_stage1.history.get("val_loss", []))

    if history_stage2 is not None:
        acc += list(history_stage2.history.get("accuracy", []))
        val_acc += list(history_stage2.history.get("val_accuracy", []))
        loss += list(history_stage2.history.get("loss", []))
        val_loss += list(history_stage2.history.get("val_loss", []))

    epochs_range = range(1, len(acc) + 1)

    # 2. Plot Training Curves
    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(epochs_range, acc, label="Training Accuracy", color="#2f6b45", lw=2)
    plt.plot(epochs_range, val_acc, label="Validation Accuracy", color="#d35400", lw=2, linestyle="--")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.title("LeafLens Model Accuracy")
    plt.grid(True, alpha=0.3)
    plt.legend(loc="lower right")

    plt.subplot(1, 2, 2)
    plt.plot(epochs_range, loss, label="Training Loss", color="#2f6b45", lw=2)
    plt.plot(epochs_range, val_loss, label="Validation Loss", color="#c0392b", lw=2, linestyle="--")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.title("LeafLens Model Loss")
    plt.grid(True, alpha=0.3)
    plt.legend(loc="upper right")
    plt.tight_layout()

    curves_path = artifacts_dir / "training_curves.png"
    plt.savefig(curves_path, dpi=200)
    plt.close()
    print(f"[+] Saved training curves to: {curves_path}")

    # 3. Confusion Matrix
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(14, 12))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="YlGn",
        xticklabels=class_names,
        yticklabels=class_names,
    )
    plt.title("Confusion Matrix (Validation Set)", fontsize=14, pad=15)
    plt.ylabel("True Class", fontsize=12)
    plt.xlabel("Predicted Class", fontsize=12)
    plt.xticks(rotation=45, ha="right", fontsize=9)
    plt.yticks(rotation=0, fontsize=9)
    plt.tight_layout()

    cm_path = artifacts_dir / "confusion_matrix.png"
    plt.savefig(cm_path, dpi=200)
    plt.close()
    print(f"[+] Saved confusion matrix to: {cm_path}")

    # 4. Classification Report
    report = classification_report(y_true, y_pred, target_names=class_names, output_dict=True)
    return report, float(val_acc[-1]) if val_acc else 0.0, float(val_loss[-1]) if val_loss else 0.0


def main():
    parser = argparse.ArgumentParser(description="LeafLens MobileNetV2 Training Pipeline")
    parser.add_argument(
        "--data",
        type=str,
        default=r"C:\Users\dell\OneDrive\Desktop\ECS Project\ECS\DataSet\PlantVillage",
        help="Path to PlantVillage dataset root directory",
    )
    parser.add_argument("--epochs", type=int, default=10, help="Stage 1 training epochs (default 10)")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size (default 32)")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Smoke test mode: ~5%% data, 1 epoch per stage for fast verification",
    )
    parser.add_argument(
        "--finetune",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Whether to perform Stage 2 fine-tuning (default on)",
    )
    parser.add_argument("--finetune-epochs", type=int, default=3, help="Stage 2 fine-tuning epochs (default 3)")
    args = parser.parse_args()

    artifacts_dir = SCRIPT_DIR / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    # 1. Dataset Discovery & Deduplication
    data_path = Path(args.data)
    valid_files, dupes_removed, total_found = scan_and_deduplicate_dataset(
        data_path,
        cache_path=artifacts_dir / "dedup_cache.json",
    )

    # 2. Stratified 80/20 Train/Val Split
    stage1_epochs = 1 if args.quick else args.epochs
    stage2_epochs = 1 if args.quick else args.finetune_epochs

    train_paths, train_labels, val_paths, val_labels, class_names = stratified_split(
        valid_files,
        val_split=0.2,
        seed=123,
        quick=args.quick,
    )

    # 3. Save class_names.json directly from the run
    class_names_path = artifacts_dir / "class_names.json"
    with open(class_names_path, "w") as f:
        json.dump(class_names, f, indent=2)
    print(f"[+] Saved class_names.json ({len(class_names)} classes) to {class_names_path}")

    # 4. TensorFlow & GPU Configuration
    import tensorflow as tf
    gpus = tf.config.list_physical_devices("GPU")
    if gpus:
        print(f"[+] GPU detected: {[gpu.name for gpu in gpus]}. Enabling memory growth...")
        for gpu in gpus:
            try:
                tf.config.experimental.set_memory_growth(gpu, True)
            except Exception as e:
                print(f"Warning setting memory growth: {e}")
    else:
        print("[!] No GPU available or detected. Running on CPU.")
        if not args.quick:
            print("[*] Estimated training time on CPU: ~20-30 minutes for 10 epochs. Use --quick for rapid test.")

    # 5. Build Datasets
    augmenter = get_augmentation_layer()
    train_ds = make_dataset(train_paths, train_labels, args.batch_size, is_training=True, augmenter=augmenter)
    val_ds = make_dataset(val_paths, val_labels, args.batch_size, is_training=False)

    # 6. Build Model
    model, base_model = build_model(num_classes=len(class_names))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary(line_length=80)

    # 7. Stage 1 Training: Frozen Base
    print(f"\n[*] Starting Stage 1 Training (Frozen Base, {stage1_epochs} epochs)...")
    start_time = time.time()
    history_stage1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=stage1_epochs,
        verbose=1,
    )
    stage1_time = time.time() - start_time
    print(f"[+] Stage 1 completed in {stage1_time:.1f}s.")

    # 8. Stage 2 Training: Fine-Tuning (Unfreeze last ~30 layers)
    history_stage2 = None
    if args.finetune:
        print(f"\n[*] Starting Stage 2 Training: Unfreezing top ~30 layers ({stage2_epochs} epochs, lr=1e-5)...")
        base_model.trainable = True
        # Freeze all layers except the last 30
        for layer in base_model.layers[:-30]:
            layer.trainable = False

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )

        history_stage2 = model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=stage2_epochs,
            verbose=1,
        )

    # 9. Save Trained Keras Model
    keras_model_path = artifacts_dir / "plant_model.keras"
    model.save(keras_model_path)
    print(f"[+] Saved complete Keras model to: {keras_model_path}")

    # 10. Evaluate on Validation Set for Confusion Matrix & Metrics
    print("\n[*] Evaluating on full validation set for detailed metrics...")
    val_preds_prob = model.predict(val_ds, verbose=1)
    y_pred = np.argmax(val_preds_prob, axis=1)
    y_true = np.array(val_labels)

    report, final_val_acc, final_val_loss = plot_metrics_and_curves(
        history_stage1,
        history_stage2,
        y_true,
        y_pred,
        class_names,
        artifacts_dir,
    )

    metrics_output = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "quick_mode": args.quick,
        "classes_count": len(class_names),
        "total_images_scanned": total_found,
        "duplicates_removed": dupes_removed,
        "train_samples": len(train_paths),
        "val_samples": len(val_paths),
        "final_val_accuracy": float(final_val_acc),
        "final_val_loss": float(final_val_loss),
        "classification_report": report,
    }
    metrics_path = artifacts_dir / "metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics_output, f, indent=2)
    print(f"[+] Saved metrics.json to: {metrics_path}")

    # 11. Export Quantized TFLite Model
    tflite_path = artifacts_dir / "plant_model.tflite"
    export_tflite(model, tflite_path)

    print("\n" + "=" * 65)
    print("TRAINING PIPELINE SUMMARY")
    print("=" * 65)
    print(f"Validation Accuracy : {final_val_acc * 100:.2f}%")
    print(f"Validation Loss     : {final_val_loss:.4f}")
    print(f"Artifacts Generated :")
    print(f"  - {keras_model_path}")
    print(f"  - {tflite_path}")
    print(f"  - {class_names_path}")
    print(f"  - {metrics_path}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
