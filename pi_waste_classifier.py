import requests
import time
import sys
import random

# =================CONFIGURATION=================
# Change this to the IP address of your computer running the dashboard
SERVER_IP = "10.227.50.224" 
SERVER_PORT = 5000
API_URL = f"http://{SERVER_IP}:{SERVER_PORT}/api/detect"

# Waste Classes (Must match server.py)
WASTE_CLASSES = {
    0: 'plastic_bottle',
    1: 'plastic_cap',
    2: 'plastic_cup',
    3: 'aluminum_can',
    4: 'plastic_bag',
    5: 'plastic_film',
    6: 'battery',
    7: 'paper_box',
    8: 'paper_carton',
    9: 'glass_bottle'
}

# ===============================================

def send_detection(class_id_name, count=1):
    """
    Send detection data to the server.
    :param class_id_name: String ID of the waste (e.g., 'can', 'plastic_bottle')
    :param count: Number of items detected
    """
    try:
        payload = {
            'class_id': class_id_name,
            'count': count
        }
        print(f"Sending: {payload} -> {API_URL}")
        
        response = requests.post(API_URL, json=payload, timeout=2)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Total {class_id_name}: {data.get('new_count')}")
        else:
            print(f"❌ Error {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"⚠️ Connection Failed: {e}")
        print("Check if the server is running and the IP address is correct.")

# ================= AI INTEGRATION =================
try:
    from picamera2 import Picamera2
    from ultralytics import YOLO
    import cv2
    import torch
except ImportError:
    print("⚠️ Libraries missing (picamera2, ultralytics, cv2, torch).")
    print("Running in Simulation Mode only.")

def run_ai_camera():
    # ================= CPU Optimize =================
    torch.set_num_threads(4)

    # ================= Model Path =================
    # Update this path to match your actual model location on the Pi
    MODEL_PATH = "/home/smartbin_tce/Desktop/run_pi5_transfer511/weights/best.pt"

    print(f"📦 Loading Model from {MODEL_PATH}...")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return

    # ================= Camera Init =================
    print("📷 Starting Camera (Pi Camera Module 3)... Press 'q' to exit")

    try:
        picam2 = Picamera2()
        config = picam2.create_preview_configuration(
            main={"size": (640, 640), "format": "RGB888"}
        )
        picam2.configure(config)

        # ================= Auto Focus (Pi Cam M3) =================
        picam2.set_controls({
            "AfMode": 2,      # 2 = Continuous Auto Focus
            "AfRange": 1,     # 1 = Normal (approx 10cm - infinity)
            "AfSpeed": 1      # 1 = Normal speed
        })

        picam2.start()
        time.sleep(1)
    except Exception as e:
        print(f"❌ Error starting camera: {e}")
        return

    # ================= YOLO Params =================
    FRAME_SKIP = 3        # Detect every 3 frames
    IMGSZ = 320           # Reduce size for speed
    CONF = 0.5
    IOU = 0.45

    frame_count = 0
    annotated_frame = None

    # ================= Mapping =================
    # LABEL_MAPPING Removed - Model names should match server keys
    # If mismatches occur, re-add mapping here.

    # ================= Cooldown State =================
    # Dict to store last detection time: {'can': 17000000.00}
    last_detection_time = {}
    COOLDOWN_SECONDS = 5.0  # Wait 5 seconds before counting the same object type again

    # ================= Confirmation State =================
    CONFIRMATION_THRESHOLD = 3  # Reduced from 5 to 3 for easier detection
    current_streak_count = 0
    current_streak_label = None

    print("✅ AI System Ready. Polling for waste...")

    # ================= Main Loop =================
    while True:
        try:
            frame = picam2.capture_array()
            frame_count += 1

            # ----- Run YOLO -----
            if frame_count % FRAME_SKIP == 0:
                results = model(
                    frame,
                    imgsz=IMGSZ,
                    conf=CONF,
                    iou=IOU,
                    device="cpu",
                    half=False,
                    verbose=False
                )

                annotated_frame = frame.copy()
                
                # Check detections
                detected_box = None
                max_conf = 0
                
                # Find best detection in this frame
                for box in results[0].boxes:
                    score = float(box.conf[0])
                    if score > max_conf:
                        max_conf = score
                        detected_box = box

                if detected_box:
                    x1, y1, x2, y2 = map(int, detected_box.xyxy[0])
                    cls_id = int(detected_box.cls[0])
                    label_name = model.names[cls_id]
                    
                    display_label = f"{label_name} ({max_conf:.2f})"
                    
                    # Draw Bounding Box
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(annotated_frame, display_label, (x1, max(y1 - 8, 15)), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                    # --- STREAK LOGIC ---
                    if label_name == current_streak_label:
                        current_streak_count += 1
                        print(f"👀 Streak {current_streak_count}/{CONFIRMATION_THRESHOLD}: {label_name} ({max_conf:.2f})")
                    else:
                        # New object detected, reset streak
                        current_streak_label = label_name
                        current_streak_count = 1
                        print(f"👀 Pending confirmation: {label_name} ({max_conf:.2f})...")

                    # Check if guaranteed
                    if current_streak_count >= CONFIRMATION_THRESHOLD:
                         # --- SEND LOGIC ---
                        current_time = time.time()
                        last_time = last_detection_time.get(label_name, 0)
                        
                        if (current_time - last_time) > COOLDOWN_SECONDS:
                            print(f"🎯 Confirmed {label_name} (Streak: {current_streak_count}) - Sending...")
                            send_detection(label_name, 1)
                            last_detection_time[label_name] = current_time
                            # Optional: Reset streak to prevent rapid fire after cooldown? 
                            # No, let cooldown handle it.
                else:
                    # No detection this frame -> Reset streak
                    if current_streak_count > 0:
                        print("❌ Lost detection - Reset streak")
                    current_streak_count = 0
                    current_streak_label = None

            # ----- Fallback frame -----
            if annotated_frame is None:
                annotated_frame = frame

            # ----- Display (Reduce FPS for stability) -----
            if frame_count % 2 == 0:
                cv2.imshow("Smart Bin AI - Press q to exit", annotated_frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error in loop: {e}")
            break

    # ================= Cleanup =================
    cv2.destroyAllWindows()
    picam2.close()
    print("✅ Camera closed")

if __name__ == '__main__':
    # Check if we should run AI mode or Simulation
    # Simple logic: If we can import picamera2, try AI mode.
    # But user might want to force simulation on PC.
    
    try:
        if len(sys.argv) > 1 and sys.argv[1] == '--sim':
            simulation_mode()
        elif 'picamera2' in sys.modules:
            # If library is present, likely on Pi
            run_ai_camera()
        else:
            # Fallback
            print("Picamera2 not found. Starting Simulation Mode.")
            simulation_mode()
    finally:
        input("\nPress Enter to exit...")
