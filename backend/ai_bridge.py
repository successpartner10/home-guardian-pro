from fastapi import FastAPI, UploadFile, File
import cv2
import numpy as np
from ultralytics import YOLO
import base64
import time

app = FastAPI()

# lightweight YOLO model
model = YOLO("yolov8n.pt")

latest_events = []


# -------------------------------
# FRAME PROCESSING (CORE ENGINE)
# -------------------------------
def process_frame(frame):
    results = model(frame)

    events = []

    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])

            label = model.names[cls]

            if conf > 0.4:
                events.append({
                    "object": label,
                    "confidence": round(conf, 2),
                    "timestamp": time.time()
                })

    return frame, events


# -------------------------------
# CAMERA FRAME INPUT (FROM FRONTEND OR PHONE)
# -------------------------------
@app.post("/frame")
async def frame(file: UploadFile = File(...)):
    global latest_events

    img_bytes = await file.read()
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    processed, events = process_frame(frame)

    latest_events = events

    return {
        "status": "ok",
        "events": events
    }


# -------------------------------
# EVENT STREAM (FRONTEND POLLING)
# -------------------------------
@app.get("/events")
def get_events():
    return {
        "events": latest_events
    }

