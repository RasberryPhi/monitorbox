# Box-Monitor

YOLOv8-gestützte Lebensmittel-Erkennung mit Webcam + Live-Dashboard auf GitHub Pages.

```
box-monitor/
├── backend/
│   ├── inference.py        ← lokal starten (Webcam + Flask + ngrok)
│   ├── requirements.txt
│   └── models/
│       └── best.pt         ← hier ablegen (nach Colab-Training)
├── dashboard/              ← React-App → GitHub Pages
│   ├── src/
│   │   ├── main.jsx
│   │   └── App.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── .github/workflows/
    └── deploy.yml          ← automatischer Deploy bei push auf main
```

---

## Schritt 1 — Fine-Tuning in Colab

1. `box_monitor_colab.py` in Colab hochladen und als Zellen ausführen  
2. Nach dem Training: `box-monitor/food-v1/weights/best.pt` herunterladen  
3. Datei in `backend/models/best.pt` ablegen

---

## Schritt 2 — Backend lokal einrichten

```bash
cd backend
pip install -r requirements.txt

# Beim allerersten Start: ngrok-Token einmalig setzen
ngrok config add-authtoken DEIN_TOKEN   # https://dashboard.ngrok.com

# Backend starten (Webcam-Index 0 = Laptop-Kamera)
python inference.py

# Mit eigenem Modell:
python inference.py --model models/best.pt --grid 3x3 --conf 0.45
```

Die ngrok-URL erscheint im Terminal — ins Dashboard eintragen.

**Optionale Flags:**

| Flag | Default | Bedeutung |
|---|---|---|
| `--model` | `models/best.pt` | Pfad zur YOLOv8-Gewichtsdatei |
| `--camera` | `0` | Kamera-Index (0 = Laptop, 1 = ext. USB) |
| `--grid` | `3x3` | Raster-Aufteilung z.B. `2x4` |
| `--conf` | `0.45` | Mindestkonfidenz |
| `--miss` | `8` | Frames bis "entnommen"-Event |
| `--port` | `5000` | Flask-Port |

---

## API-Endpunkte

| Endpunkt | Beschreibung |
|---|---|
| `GET /logs` | Letzte 200 Events (neuste zuerst) |
| `GET /inventory` | Aktuell erkannte Objekte |
| `GET /snapshot` | Kamera-Frame als Base64-JPEG |
| `GET /status` | Systemstatus (Anzahl, Modell, Grid) |

---

## Genutzte Datasets (Roboflow)

| Dataset | Bilder | Link |
|---|---|---|
| Fridge objects v11 | 963 | https://universe.roboflow.com/fooddetection-essdj/fridge-objects/dataset/11 |
| Fridge detection | 3.148 | https://universe.roboflow.com/project-9e2x4/fridge-detection |
| Food Detection Dataset | 8.924 | https://universe.roboflow.com/fooddetection-htdbb/food-detection-dataset |
| Food Waste Detection | 7.622 | https://universe.roboflow.com/abrars-models/food-waste-detection-yolo-v8 |
| Grocery v2 | 2.756 | https://universe.roboflow.com/yolov8grocery/grocery-enjpf/dataset/2 |
