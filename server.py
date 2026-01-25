from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import threading
import time
import requests
from datetime import datetime
import urllib3

# Disable SSL Warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__, static_url_path='', static_folder='.')
CORS(app)

# Firebase Configuration
FIREBASE_DB_URL = os.environ.get("FIREBASE_DB_URL", "https://smartbin-tce-default-rtdb.asia-southeast1.firebasedatabase.app")

# Default State
default_state = {
    "counts": {
        "plastic_bottle": 0, "plastic_cap": 0, "plastic_cup": 0, "aluminum_can": 0,
        "plastic_bag": 0, "plastic_film": 0, "battery": 0, "paper_box": 0,
        "paper_carton": 0, "glass_bottle": 0
    },
    "bin_levels": [0, 0, 0, 0],
    "history": {},
    "last_reset_date": datetime.now().strftime('%Y-%m-%d')
}

# In-memory state (acts as cache)
current_data = default_state.copy()
data_lock = threading.Lock()
is_dirty = False



def load_initial_data():
    """Load data from Firebase on startup"""
    global current_data
    try:
        print("Loading data from Firebase...")
        response = requests.get(f"{FIREBASE_DB_URL}/.json", verify=False)
        if response.status_code == 200 and response.json():
            remote_data = response.json()
            # Merge with default state to ensure structure
            for key in default_state['counts']:
                if 'counts' not in remote_data: remote_data['counts'] = {}
                if key not in remote_data['counts']: remote_data['counts'][key] = 0
            
            if 'bin_levels' not in remote_data:
                remote_data['bin_levels'] = [0, 0, 0, 0]
                
            if 'history' not in remote_data:
                remote_data['history'] = {}

            if 'last_reset_date' not in remote_data:
                remote_data['last_reset_date'] = datetime.now().strftime('%Y-%m-%d')
                
            current_data = remote_data
            print("Data loaded successfully")
    except Exception as e:
        print(f"Failed to load initial data: {e}")

# Load initial data
load_initial_data()

def check_daily_reset():
    """Check if we entered a new day and reset counts if needed"""
    global current_data, is_dirty
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    with data_lock:
        last_reset = current_data.get('last_reset_date', '')
        
        if last_reset != today_str:
            print(f"🔄 New Day Detected! ({last_reset} -> {today_str}) Resetting counts...")
            
            # Reset Counts
            current_data['counts'] = {k: 0 for k in current_data['counts']}
            
            # Update Reset Date
            current_data['last_reset_date'] = today_str
            
            # Save immediately
            save_to_firebase()

@app.route('/', methods=['GET'])
def home():
    return app.send_static_file('index.html')

@app.route('/api/status', methods=['GET'])
def get_status():
    check_daily_reset() # Check for reset on status poll
    return jsonify(current_data)

def save_to_firebase():
    """Helper to save immediate state to Firebase"""
    try:
        # Save entire state for safety
        requests.patch(f"{FIREBASE_DB_URL}/.json", json=current_data, verify=False)
        print("✅ Saved to Firebase")
    except Exception as e:
        print(f"❌ Save Error: {e}")

@app.route('/api/detect', methods=['POST'])
def detect_object():
    content = request.json
    class_id = content.get('class_id')
    
    check_daily_reset() # Check for reset before adding count
    
    if class_id in current_data['counts']:
        count_to_add = content.get('count', 1)
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        with data_lock:
            # Update RAM
            current_data['counts'][class_id] += count_to_add
            
            if 'history' not in current_data: current_data['history'] = {}
            if today_str not in current_data['history']:
                current_data['history'][today_str] = {k: 0 for k in current_data['counts']}
            
            if class_id not in current_data['history'][today_str]:
                current_data['history'][today_str][class_id] = 0
            
            current_data['history'][today_str][class_id] += count_to_add
            
        # DIRECT SAVE - No background thread
        save_to_firebase()
            
        return jsonify({"success": True, "new_count": current_data['counts'][class_id]})
    
    return jsonify({"success": False, "error": "Invalid Class ID"}), 400

@app.route('/api/reset', methods=['POST'])
def reset_data():
    with data_lock:
        current_data['counts'] = {k: 0 for k in current_data['counts']}
    save_to_firebase()
    return jsonify({"success": True})

@app.route('/api/bin-level', methods=['POST'])
def set_bin_level():
    content = request.json
    levels = content.get('levels')
    level = content.get('level')
    
    with data_lock:
        if levels and isinstance(levels, list) and len(levels) == 4:
            current_data['bin_levels'] = levels
            save_to_firebase()
            return jsonify({"success": True})
            
        if level is not None:
             current_data['bin_levels'][0] = int(level)
             save_to_firebase()
             return jsonify({"success": True})
             
    return jsonify({"success": False}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

