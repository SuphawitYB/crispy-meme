import requests
import json
from datetime import datetime, timedelta
import urllib3

# Disable SSL Warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

FIREBASE_DB_URL = "https://smartbin-tce-default-rtdb.asia-southeast1.firebasedatabase.app"

# Calculate Dates based on system time (2026-01-24)
today = datetime.now()
day1 = (today - timedelta(days=1)).strftime('%Y-%m-%d') # Yesterday
day2 = (today - timedelta(days=2)).strftime('%Y-%m-%d') # Day before yesterday

print(f"Seeding data for {day2} and {day1}...")

# Mock Data
history_data = {
    day2: {
        "plastic_bottle": 15, "plastic_cap": 12, "plastic_cup": 8, "aluminum_can": 20,
        "plastic_bag": 5, "plastic_film": 3, "battery": 1, "paper_box": 4,
        "paper_carton": 6, "glass_bottle": 2
    },
    day1: {
        "plastic_bottle": 25, "plastic_cap": 20, "plastic_cup": 15, "aluminum_can": 10,
        "plastic_bag": 8, "plastic_film": 12, "battery": 0, "paper_box": 2,
        "paper_carton": 8, "glass_bottle": 5
    }
}

# Current Counts (Sum of history roughly)
# We won't update current 'counts' to avoid messing up live demo flow too much, 
# or maybe we should? Let's just update history to show the graph.
# The user asked for "Database for 2 days", implying history.

try:
    # Patch History
    url_history = f"{FIREBASE_DB_URL}/history.json"
    requests.patch(url_history, json=history_data, verify=False)
    
    # Patch Counts (Initial Empty or Zero)
    url_counts = f"{FIREBASE_DB_URL}/counts.json"
    counts_data = {
        "plastic_bottle": 0, "plastic_cap": 0, "plastic_cup": 0, "aluminum_can": 0,
        "plastic_bag": 0, "plastic_film": 0, "battery": 0, "paper_box": 0,
        "paper_carton": 0, "glass_bottle": 0
    }
    response = requests.patch(url_counts, json=counts_data, verify=False)
    
    if response.status_code == 200:
        print("[OK] Success! Added 2 days of history.")
        print("Refresh your dashboard to see the graph.")
    else:
        print(f"[FAIL] Failed: {response.text}")

except Exception as e:
    print(f"[ERROR] Error: {e}")
