import os
import time
import json
from pathlib import Path
from PIL import Image
import numpy as np

os.environ['KERAS_HOME'] = r'C:\Users\dell\OneDrive\Desktop\ECS Project\leaflens\backend'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
import tensorflow as tf
from tensorflow.keras import layers, models

SCRIPT_DIR = Path(r'C:\Users\dell\OneDrive\Desktop\ECS Project\leaflens\backend')
DATASET_ROOT = Path(r'C:\Users\dell\OneDrive\Desktop\ECS Project\ECS\DataSet\PlantVillage')
FRONTEND_API_DIR = SCRIPT_DIR.parent / "frontend" / "api"

with open(FRONTEND_API_DIR / 'class_names.json') as f:
    class_names = json.load(f)

print(f"[*] Loading existing backbone feature extractor from plant_model.keras...")
existing_model = tf.keras.models.load_model(str(SCRIPT_DIR / "artifacts" / "plant_model.keras"))
base_extractor = models.Model(
    inputs=existing_model.input,
    outputs=existing_model.get_layer("global_average_pooling2d_1").output,
    name="MobileNetV2_FeatureExtractor"
)

def get_multiscale_crops(img: Image.Image) -> list:
    """Generate 1 full image + 3 distinct crops (70% center, 55% patch, flipped)."""
    rgb = img.convert('RGB')
    w, h = rgb.size
    crops = []
    
    # 1. Full image
    crops.append(rgb.resize((224, 224), Image.Resampling.BILINEAR))
    
    # 2. Horizontal flip
    crops.append(rgb.transpose(Image.FLIP_LEFT_RIGHT).resize((224, 224), Image.Resampling.BILINEAR))
    
    # 3. 70% zoom/crop
    x1, y1 = int(w * 0.15), int(h * 0.15)
    cw, ch = int(w * 0.70), int(h * 0.70)
    crops.append(rgb.crop((x1, y1, x1 + cw, y1 + ch)).resize((224, 224), Image.Resampling.BILINEAR))
    
    # 4. 50% subcrop (mimics the scanner subcrop tiles)
    x2, y2 = int(w * 0.25), int(h * 0.25)
    cw2, ch2 = int(w * 0.50), int(h * 0.50)
    crops.append(rgb.crop((x2, y2, x2 + cw2, y2 + ch2)).resize((224, 224), Image.Resampling.BILINEAR))
    
    return crops

print("[*] Extracting multi-scale features across all 18 classes...")
rng = np.random.default_rng(42)

train_X = []
train_y = []
val_X = []
val_y = []

# Snake plant classes get extra weight and all available images
for cls_idx, cls_name in enumerate(class_names):
    p_dir = DATASET_ROOT / cls_name
    all_files = sorted(list(p_dir.glob('*.*')))
    rng.shuffle(all_files)
    
    # Split
    is_snake = "Snake_Plant" in cls_name
    n_val = 30
    n_train = len(all_files) - n_val if is_snake else min(120, len(all_files) - n_val)
    
    val_files = all_files[:n_val]
    train_files = all_files[n_val:n_val + n_train]
    
    # Train features
    batch_images = []
    for p in train_files:
        try:
            with Image.open(p) as img:
                crops = get_multiscale_crops(img)
                for c in crops:
                    batch_images.append(np.array(c, dtype=np.float32))
                    train_y.append(cls_idx)
        except Exception:
            pass
            
    # Batch predict features in chunks of 64
    for i in range(0, len(batch_images), 64):
        chunk = np.stack(batch_images[i:i+64], axis=0)
        feats = base_extractor.predict(chunk, verbose=0)
        train_X.append(feats)
        
    # Val features (full images)
    val_batch = []
    for p in val_files:
        try:
            with Image.open(p) as img:
                im = img.convert('RGB').resize((224, 224), Image.Resampling.BILINEAR)
                val_batch.append(np.array(im, dtype=np.float32))
                val_y.append(cls_idx)
        except Exception:
            pass
    if val_batch:
        v_chunk = np.stack(val_batch, axis=0)
        v_feats = base_extractor.predict(v_chunk, verbose=0)
        val_X.append(v_feats)
        
    print(f"  [{cls_idx:02d}] {cls_name:<45}: {len(batch_images)} train vectors, {len(val_batch)} val")

X_train = np.concatenate(train_X, axis=0)
y_train = np.array(train_y)
X_val = np.concatenate(val_X, axis=0)
y_val = np.array(val_y)

print(f"\n[+] Total Training Vectors: {X_train.shape}, Val: {X_val.shape}")

# Build high-capacity regularized classification head
head = tf.keras.Sequential([
    layers.Input(shape=(1280,)),
    layers.BatchNormalization(),
    layers.Dense(384, activation="relu"),
    layers.Dropout(0.35),
    layers.Dense(192, activation="relu"),
    layers.Dropout(0.25),
    layers.Dense(len(class_names), activation="softmax"),
])

head.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

head.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    epochs=35,
    batch_size=64,
    verbose=1,
)

val_loss, val_acc = head.evaluate(X_val, y_val, verbose=0)
print(f"\n[+] Retrained Head Validation Accuracy: {val_acc * 100:.2f}% (Loss: {val_loss:.4f})")

# Assemble complete end-to-end model directly reusing the existing model's backbone
feature_vector = existing_model.get_layer("global_average_pooling2d_1").output
x = feature_vector
for layer in head.layers:
    x = layer(x)

new_full_model = models.Model(inputs=existing_model.input, outputs=x, name="LeafLens_MobileNetV2_18Class_MultiScale")
new_full_model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])

# Save Keras Model
keras_path = SCRIPT_DIR / "artifacts" / "plant_model.keras"
new_full_model.save(keras_path)
print(f"[+] Saved Keras: {keras_path}")

# Export Quantized TFLite
converter = tf.lite.TFLiteConverter.from_keras_model(new_full_model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_bytes = converter.convert()

tflite_backend = SCRIPT_DIR / "artifacts" / "plant_model.tflite"
with open(tflite_backend, "wb") as f:
    f.write(tflite_bytes)

tflite_frontend = FRONTEND_API_DIR / "plant_model.tflite"
with open(tflite_frontend, "wb") as f:
    f.write(tflite_bytes)

print(f"[+] Exported new multi-scale TFLite ({len(tflite_bytes)/(1024*1024):.2f} MB) to backend and frontend API!")
