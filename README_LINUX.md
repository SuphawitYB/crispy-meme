# How to Run on Ubuntu / Raspberry Pi OS

This project is fully compatible with Linux (Ubuntu, Debian, Raspberry Pi OS).

## 1. Prerequisites (Terminal)
Open your terminal and run the following commands to install Python and Git (if needed):

```bash
sudo apt update
sudo apt install python3 python3-pip git -y
```

## 2. Setup the Server (Backend)

1.  **Navigate to the folder** where you placed the files (or clone your repo).
2.  **Install Library**:
    ```bash
    pip3 install flask flask-cors
    ```
    *(Note: On some newer Ubuntu versions, you might need to use a virtual environment)*:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install flask flask-cors
    ```

3.  **Start the Server**:
    ```bash
    python3 server.py
    ```
    You should see: `Running on http://0.0.0.0:5000`

## 3. Open the Dashboard (Frontend)
Since this is a simple HTML file, you have two options:

**Option A: Open directly in Browser**
Double-click `index.html` in your file manager.

**Option B: Host it (Optional)**
If you want to access the dashboard from *another* computer on the network, you can run a simple HTTP server in the project folder:
```bash
python3 -m http.server 8000
```
Then open `http://<YOUR_UBUNTU_IP>:8000` in your browser.

## 4. Find your IP Address
To link your AI Camera or access the dashboard from other devices, find your IP:
```bash
hostname -I
```
Take the first IP address (e.g., `192.168.1.105`) and put it in `script.js` if needed.

## 5. Raspberry Pi Integration

To collect data (Waste Counts & Bin Levels) from a Raspberry Pi, use the provided Python scripts.

### 5.1 Waste Object Detection (Simulated or AI Integration)

This script sends daily waste count data to the server.
1. Open `pi_waste_classifier.py`.
2. Edit `SERVER_IP` to match your PC's IP address (from Step 4).
3. Run the script to simulate detections:
   ```bash
   python3 pi_waste_classifier.py
   ```
   You can press keys 1-10 to simulate adding trash items. This data will be saved in the `history` of the dashboard.

### 5.2 Ultrasonic Bin Level Sensors

This script monitors how full the bins are.
1. Connect 4 Ultrasonic Sensors (HC-SR04) to your Pi.
2. Open `sensor_controller.py` and edit `API_URL` to match your PC's IP.
3. Run the script:
   ```bash
   python3 sensor_controller.py
   ```

