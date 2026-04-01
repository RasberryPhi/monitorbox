"""
Box-Monitor — Lokale Inferenz
Laptop-Webcam + YOLOv8 + Flask API + ngrok

Start:
    python inference.py
    python inference.py --model ../models/best.pt --grid 3x3 --conf 0.45
"""

import argparse
import base64
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import cv2
from flask import Flask, jsonify
from flask_cors import CORS
from pyngrok import ngrok
from ultralytics import YOLO


# ── CLI-Argumente ──────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Box-Monitor Inferenz")
parser.add_argument("--model",  default="models/best.pt",
                    help="Pfad zur best.pt (Default: models/best.pt)")
parser.add_argument("--grid",   default="3x3",
                    help="Raster z.B. 3x3 oder 2x4 (Default: 3x3)")
parser.add_argument("--conf",   type=float, default=0.45,
                    help="Mindestkonfidenz 0–1 (Default: 0.45)")
parser.add_argument("--camera", type=int, default=0,
                    help="Kamera-Index (Default: 0 = Laptop-Webcam)")
parser.add_argument("--port",   type=int, default=5000,
                    help="Flask-Port (Default: 5000)")
parser.add_argument("--miss",   type=int, default=8,
                    help="Frames bis 'entnommen'-Event (Default: 8)")
args = parser.parse_args()

GRID_ROWS, GRID_COLS = map(int, args.grid.lower().split("x"))
CONF_THRESH = args.conf
CAMERA_IDX  = args.camera
DISAPPEAR_N = args.miss
PORT        = args.port
MODEL_PATH  = args.model

# Fallback auf COCO-Modell wenn best.pt nicht existiert
if not Path(MODEL_PATH).exists():
    print(f"⚠️  {MODEL_PATH} nicht gefunden — nutze yolov8n.pt (COCO)")
    MODEL_PATH = "yolov8n.pt"

# ── Globaler Zustand ───────────────────────────────────────────────
logs:         list = []
tracked:      dict = {}
inventory:    dict = {}
latest_frame        = None
frame_w, frame_h    = 640, 480


# ══════════════════════════════════════════════════════════════════
# Flask API
# ══════════════════════════════════════════════════════════════════

app = Flask(__name__)
CORS(app)


def get_zone(cx: float, cy: float) -> str:
    row = min(int(cy / frame_h * GRID_ROWS), GRID_ROWS - 1)
    col = min(int(cx / frame_w * GRID_COLS), GRID_COLS - 1)
    return f"{chr(65 + row)}{col + 1}"


def add_log(event: str, item: str, zone: str, confidence):
    entry = {
        "timestamp":  datetime.now().isoformat(),
        "event":      event,
        "item":       item,
        "zone":       zone,
        "confidence": round(float(confidence), 2) if confidence else None,
    }
    logs.append(entry)
    if len(logs) > 500:
        logs.pop(0)
    return entry


@app.route("/logs")
def api_logs():
    return jsonify(logs[-200:][::-1])


@app.route("/inventory")
def api_inventory():
    return jsonify(list(inventory.values()))


@app.route("/snapshot")
def api_snapshot():
    if latest_frame is None:
        return jsonify({"error": "Kein Frame"}), 404
    _, buf = cv2.imencode(".jpg", latest_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return jsonify({"image": base64.b64encode(buf).decode()})


@app.route("/status")
def api_status():
    return jsonify({
        "inventory_count": len(inventory),
        "log_count":       len(logs),
        "last_event":      logs[-1]["timestamp"] if logs else None,
        "grid":            f"{GRID_ROWS}x{GRID_COLS}",
        "model":           MODEL_PATH,
    })


# ══════════════════════════════════════════════════════════════════
# Erkennungs-Loop
# ══════════════════════════════════════════════════════════════════

def draw_grid(frame):
    h, w = frame.shape[:2]
    for r in range(1, GRID_ROWS):
        y = int(r * h / GRID_ROWS)
        cv2.line(frame, (0, y), (w, y), (160, 160, 160), 1)
    for c in range(1, GRID_COLS):
        x = int(c * w / GRID_COLS)
        cv2.line(frame, (x, 0), (x, h), (160, 160, 160), 1)
    for r in range(GRID_ROWS):
        for c in range(GRID_COLS):
            cv2.putText(
                frame, f"{chr(65 + r)}{c + 1}",
                (int(c * w / GRID_COLS) + 5, int(r * h / GRID_ROWS) + 16),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1,
            )
    return frame


def detection_loop():
    global tracked, inventory, latest_frame, frame_w, frame_h

    model = YOLO(MODEL_PATH)
    print(f"✅ Modell: {MODEL_PATH}")
    print(f"   Klassen ({len(model.names)}): {list(model.names.values())}")

    cap = cv2.VideoCapture(CAMERA_IDX)
    if not cap.isOpened():
        print(f"❌ Kamera {CAMERA_IDX} nicht erreichbar")
        sys.exit(1)

    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)  or 640)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)
    print(f"📹 Kamera {CAMERA_IDX}: {frame_w}×{frame_h}px")

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue

        res = model.track(
            frame,
            persist = True,
            verbose = False,
            conf    = CONF_THRESH,
            tracker = "bytetrack.yaml",
        )
        seen_ids = set()

        if res[0].boxes.id is not None:
            for box, tid, conf, cls in zip(
                res[0].boxes.xyxy.cpu(),
                res[0].boxes.id.cpu().int(),
                res[0].boxes.conf.cpu(),
                res[0].boxes.cls.cpu().int(),
            ):
                tid  = int(tid)
                item = model.names[int(cls)]
                cx   = float((box[0] + box[2]) / 2)
                cy   = float((box[1] + box[3]) / 2)
                zone = get_zone(cx, cy)
                seen_ids.add(tid)

                if tid not in tracked:
                    tracked[tid]   = {"item": item, "zone": zone, "miss": 0}
                    inventory[tid] = {
                        "id": tid, "item": item,
                        "zone": zone, "since": datetime.now().isoformat(),
                    }
                    add_log("hinzugefügt", item, zone, conf)
                    print(f"  ➕  {item} → Zone {zone}")
                else:
                    old_zone = tracked[tid]["zone"]
                    if old_zone != zone:
                        tracked[tid]["zone"] = zone
                        if tid in inventory:
                            inventory[tid]["zone"] = zone
                        add_log("verschoben", item, zone, conf)
                        print(f"  ↔️   {item}: {old_zone} → {zone}")
                    tracked[tid]["miss"] = 0

        for tid in list(tracked):
            if tid not in seen_ids:
                tracked[tid]["miss"] += 1
                if tracked[tid]["miss"] >= DISAPPEAR_N:
                    obj = tracked.pop(tid)
                    inventory.pop(tid, None)
                    add_log("entnommen", obj["item"], obj["zone"], None)
                    print(f"  ➖  {obj['item']} aus Zone {obj['zone']}")

        annotated    = res[0].plot()
        latest_frame = draw_grid(annotated)


# ══════════════════════════════════════════════════════════════════
# Start
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    threading.Thread(
        target=lambda: app.run(port=PORT, debug=False, use_reloader=False),
        daemon=True,
    ).start()

    threading.Thread(target=detection_loop, daemon=True).start()

    time.sleep(2)

    # ngrok-Token beim ersten Start setzen:
    #   ngrok config add-authtoken DEIN_TOKEN
    public_url = ngrok.connect(PORT).public_url

    print("\n" + "═" * 52)
    print("✅  BOX-MONITOR läuft lokal")
    print("═" * 52)
    print(f"   🌐  API:   {public_url}")
    print(f"   Endpunkte: /logs  /inventory  /snapshot  /status")
    print(f"\n   👆  URL ins Dashboard eintragen und verbinden!")
    print("═" * 52)
    print("   Stoppen: Strg+C\n")

    try:
        while True:
            time.sleep(60)
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}]"
                f"  In Box: {len(inventory)}  |  Events: {len(logs)}"
            )
    except KeyboardInterrupt:
        print("\n⏹  Gestoppt.")
