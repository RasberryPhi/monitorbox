# ╔══════════════════════════════════════════════════════════════════╗
# ║   BOX-MONITOR — Fine-Tuning Notebook (Google Colab)             ║
# ║   Nur Training → exportiert best.pt → lokal weiternutzen        ║
# ╠══════════════════════════════════════════════════════════════════╣
# ║  Danach:                                                         ║
# ║    best.pt in backend/models/ ablegen                            ║
# ║    python backend/inference.py --model backend/models/best.pt   ║
# ╚══════════════════════════════════════════════════════════════════╝
#
# Laufzeit → Laufzeittyp ändern → T4 GPU
# Alle Zellen der Reihe nach ausführen


# ══════════════════════════════════════════════════════════════════
# ZELLE 1 — GPU prüfen & Abhängigkeiten installieren
# ══════════════════════════════════════════════════════════════════

# !nvidia-smi                              # GPU-Info anzeigen
# !pip install ultralytics roboflow -q


# ══════════════════════════════════════════════════════════════════
# ZELLE 2 — Konfiguration
# ══════════════════════════════════════════════════════════════════

# ── Roboflow ──────────────────────────────────────────────────────
RF_API_KEY   = "DEIN_API_KEY"  # https://app.roboflow.com → Settings → API Keys

# ── Basismodell ───────────────────────────────────────────────────
# yolov8n.pt  → schnellstes Modell,  ~3.2M Parameter  (Laptop-CPU geeignet)
# yolov8s.pt  → gute Balance,        ~11M Parameter   ← empfohlen
# yolov8m.pt  → genauer, langsamer,  ~25M Parameter
BASE_MODEL   = "yolov8s.pt"

# ── Trainingsdauer ────────────────────────────────────────────────
EPOCHS       = 60      # auf T4: ~45–70 Min je nach Datasetgröße
PATIENCE     = 20      # Early Stopping wenn kein Fortschritt

# ── Bildgröße & Batch ─────────────────────────────────────────────
IMG_SIZE     = 640
BATCH        = 16      # bei OOM (Out of Memory) → 8

# ── Transfer Learning ─────────────────────────────────────────────
FREEZE       = 10      # erste 10 Layer einfrieren (Backbone bleibt)
LR0          = 0.001   # niedrige LR wegen Pretrained-Gewichten
LRF          = 0.01    # finale LR-Ratio

# ── Ausgabepfad ───────────────────────────────────────────────────
PROJECT_NAME = "box-monitor"
RUN_NAME     = "food-v1"


# ══════════════════════════════════════════════════════════════════
# ZELLE 3 — Dataset herunterladen
# ══════════════════════════════════════════════════════════════════
#
# Verfügbare Datasets:
#
#   ⭐ A: Fridge objects v11     — 963 Bilder, Kühlschrankinhalt
#         https://universe.roboflow.com/fooddetection-essdj/fridge-objects/dataset/11
#
#   ⭐ B: Fridge detection       — 3.148 Bilder, breite Lebensmittel-Abdeckung
#         https://universe.roboflow.com/project-9e2x4/fridge-detection
#
#   ⭐ C: Food Detection Dataset — 8.924 Bilder, größtes Foodset
#         https://universe.roboflow.com/fooddetection-htdbb/food-detection-dataset
#
#     D: Food Waste Detection   — 7.622 Bilder, Verpackungen & Reste
#         https://universe.roboflow.com/abrars-models/food-waste-detection-yolo-v8
#
#     E: Grocery v2             — 2.756 Bilder, Supermarktprodukte
#         https://universe.roboflow.com/yolov8grocery/grocery-enjpf/dataset/2
#
# Tipp: Mehrere Datasets lassen sich auf roboflow.com direkt im Browser
#       mergen (Fork → Merge) und als ein einziges Projekt exportieren.

from roboflow import Roboflow
import yaml

rf = Roboflow(api_key=RF_API_KEY)

# ── Option A: Fridge objects (klein, schneller Einstieg) ──────────
project = rf.workspace("fooddetection-essdj").project("fridge-objects")
dataset = project.version(11).download("yolov8")

# ── Option B: Fridge detection (mittelgroß, empfohlen) ────────────
# project = rf.workspace("project-9e2x4").project("fridge-detection")
# dataset = project.version(1).download("yolov8")

# ── Option C: Food Detection Dataset (groß, beste Abdeckung) ──────
# project = rf.workspace("fooddetection-htdbb").project("food-detection-dataset")
# dataset = project.version(1).download("yolov8")

# ── Option D: Food Waste Detection ────────────────────────────────
# project = rf.workspace("abrars-models").project("food-waste-detection-yolo-v8")
# dataset = project.version(1).download("yolov8")

# ── Option E: Grocery ─────────────────────────────────────────────
# project = rf.workspace("yolov8grocery").project("grocery-enjpf")
# dataset = project.version(2).download("yolov8")

# ── Option F: Eigenes gemergtes Projekt ───────────────────────────
# project = rf.workspace("DEIN_WORKSPACE").project("DEIN_PROJEKT")
# dataset = project.version(1).download("yolov8")

print(f"\n✅ Dataset: {dataset.location}")
with open(f"{dataset.location}/data.yaml") as f:
    meta = yaml.safe_load(f)
print(f"   Klassen ({meta['nc']}): {meta['names']}")


# ══════════════════════════════════════════════════════════════════
# ZELLE 4 — Fine-Tuning
# ══════════════════════════════════════════════════════════════════

from ultralytics import YOLO

model = YOLO(BASE_MODEL)
print(f"🚀 Starte Training: {BASE_MODEL} → {PROJECT_NAME}/{RUN_NAME}")
print(f"   Epochs: {EPOCHS}  |  Batch: {BATCH}  |  Freeze: {FREEZE}\n")

results = model.train(
    data     = f"{dataset.location}/data.yaml",

    # Dauer
    epochs   = EPOCHS,
    patience = PATIENCE,

    # Größe & Batch
    imgsz    = IMG_SIZE,
    batch    = BATCH,

    # Transfer Learning
    freeze   = FREEZE,
    lr0      = LR0,
    lrf      = LRF,

    # Augmentierungen — für Top-Down-Aufnahmen optimiert
    degrees  = 45.0,   # starke Rotation (Objekte liegen in jeder Richtung)
    fliplr   = 0.5,    # horizontales Spiegeln
    flipud   = 0.5,    # vertikales Spiegeln (bei Top-Down sinnvoll!)
    hsv_h    = 0.015,  # Farbton-Variation
    hsv_s    = 0.7,    # Sättigungs-Variation
    hsv_v    = 0.4,    # Helligkeits-Variation (Küchenbeleuchtung variiert stark)
    scale    = 0.5,    # Zoom-Variation

    # Ausgabe
    project  = PROJECT_NAME,
    name     = RUN_NAME,
    device   = 0,
    verbose  = True,
)

BEST_PT = f"{PROJECT_NAME}/{RUN_NAME}/weights/best.pt"
print(f"\n✅ Training abgeschlossen!")
print(f"   Bestes Modell gespeichert: {BEST_PT}")


# ══════════════════════════════════════════════════════════════════
# ZELLE 5 — Evaluierung
# ══════════════════════════════════════════════════════════════════

model_eval = YOLO(BEST_PT)
metrics    = model_eval.val(verbose=False)

map50   = metrics.box.map50
map5095 = metrics.box.map
prec    = metrics.box.mp
recall  = metrics.box.mr

print("\n📊 Validierungsergebnis:")
print(f"   mAP50:     {map50:.3f}   {'✅' if map50 > 0.70 else '⚠️  Ziel: > 0.70'}")
print(f"   mAP50-95:  {map5095:.3f}   {'✅' if map5095 > 0.50 else '⚠️  Ziel: > 0.50'}")
print(f"   Precision: {prec:.3f}")
print(f"   Recall:    {recall:.3f}")
print(f"\n   Klassen: {list(model_eval.names.values())}")

if map50 < 0.60:
    print("\n💡 mAP50 unter 0.60 — Verbesserungsoptionen:")
    print("   • Mehr Epochs (EPOCHS = 100)")
    print("   • Größeres Basismodell (yolov8m.pt)")
    print("   • Mehr Daten: zweites Dataset auf roboflow.com mergen")
    print("   • FREEZE = 0 (ganzes Netz trainieren, braucht mehr Daten)")


# ══════════════════════════════════════════════════════════════════
# ZELLE 6 — Testbild aus Validierungsset (optional)
# ══════════════════════════════════════════════════════════════════

import glob
from IPython.display import display
from PIL import Image

val_imgs = glob.glob(f"{dataset.location}/valid/images/*.jpg")

if val_imgs:
    res = model_eval.predict(val_imgs[0], conf=0.4, verbose=False)
    display(Image.fromarray(res[0].plot()[:, :, ::-1]))  # BGR → RGB
    detections = [
        (model_eval.names[int(c)], round(float(s), 2))
        for c, s in zip(res[0].boxes.cls, res[0].boxes.conf)
    ]
    print(f"   Erkannt: {detections if detections else 'keine'}")
else:
    print("   Keine Validierungsbilder gefunden")


# ══════════════════════════════════════════════════════════════════
# ZELLE 7 — best.pt herunterladen
# ══════════════════════════════════════════════════════════════════
#
# → Datei speichern als: backend/models/best.pt

from google.colab import files

print(f"⬇️  Lade {BEST_PT} herunter …")
files.download(BEST_PT)

print("\n✅ Fertig! Nächste Schritte:")
print("   1. best.pt → backend/models/best.pt ablegen")
print("   2. python backend/inference.py --model backend/models/best.pt")
print("   3. ngrok-URL ins Dashboard eintragen → live!")
