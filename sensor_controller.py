import RPi.GPIO as GPIO
import time
import requests

# Configuration
API_URL = 'http://localhost:5000/api/bin-level'
BIN_HEIGHT_CM = 100  # Height of the bin in cm (Change this to your actual bin height)
POLL_INTERVAL = 2    # Seconds between checks

# GPIO Mode (BOARD / BCM)
GPIO.setmode(GPIO.BCM)

# Sensor Pins Configuration (Trigger, Echo) for 4 Compartments
# Change these PIN numbers to match your wiring
SENSORS = [
    {'id': 0, 'trig': 17, 'echo': 27}, # Compartment 1
    {'id': 1, 'trig': 22, 'echo': 23}, # Compartment 2
    {'id': 2, 'trig': 24, 'echo': 25}, # Compartment 3
    {'id': 3, 'trig': 5,  'echo': 6}   # Compartment 4
]

def setup_gpio():
    print("Setting up GPIO...")
    for sensor in SENSORS:
        GPIO.setup(sensor['trig'], GPIO.OUT)
        GPIO.setup(sensor['echo'], GPIO.IN)
        GPIO.output(sensor['trig'], False)
    
    print("Waiting for sensors to settle...")
    time.sleep(2)

def get_distance(trig_pin, echo_pin):
    # Send 10us pulse to trigger
    GPIO.output(trig_pin, True)
    time.sleep(0.00001)
    GPIO.output(trig_pin, False)

    start_time = time.time()
    stop_time = time.time()

    # Wait for echo to start
    timeout = time.time() + 0.1 # Timeout safety
    while GPIO.input(echo_pin) == 0:
        start_time = time.time()
        if start_time > timeout: return -1

    # Wait for echo to end
    while GPIO.input(echo_pin) == 1:
        stop_time = time.time()
        if stop_time > timeout: return -1

    # Calculate distance
    # Sound speed = 34300 cm/s, distance = (time * speed) / 2
    time_elapsed = stop_time - start_time
    distance = (time_elapsed * 34300) / 2

    return distance

def calculate_percent(distance):
    if distance == -1: return 0
    # If distance is small (trash is high), percent is high
    # If distance is large (trash is low), percent is low
    # Example: Bin Height 100cm.
    # Trash at 20cm from top -> 20cm empty space -> 80% full
    # Trash at 100cm from top -> 100cm empty space -> 0% full
    
    val = BIN_HEIGHT_CM - distance
    percent = (val / BIN_HEIGHT_CM) * 100
    
    return max(0, min(100, int(percent)))

def main():
    try:
        setup_gpio()
        print("Starting measurements...")

        while True:
            levels = []
            
            for sensor in SENSORS:
                dist = get_distance(sensor['trig'], sensor['echo'])
                percent = calculate_percent(dist)
                levels.append(percent)
                # print(f"Sensor {sensor['id']}: {dist:.1f}cm ({percent}%)")

            # Send to API
            try:
                payload = {'levels': levels}
                response = requests.post(API_URL, json=payload, timeout=1)
                if response.status_code == 200:
                    print(f"Sent update: {levels}")
                else:
                    print(f"Server error: {response.status_code}")
            except Exception as e:
                print(f"Connection error: {e}")

            time.sleep(POLL_INTERVAL)

    except KeyboardInterrupt:
        print("Measurement stopped by User")
        GPIO.cleanup()
    except Exception as e:
        print(f"Error: {e}")
        GPIO.cleanup()

if __name__ == '__main__':
    main()
