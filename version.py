# make_gradio_request.py
import requests
import json
import os

# --- Configuration ---
# IMPORTANT: Replace with the actual URL of your running Express/FastAPI backend
# If your backend is on localhost:3000 and you're running this script on the same machine:
BACKEND_URL = "http://localhost:3000"
# If your backend is exposed via ngrok/Cloudflare Tunnel:
# BACKEND_URL = "https://your-ngrok-subdomain.ngrok-free.app"
# If your backend is deployed to Heroku:
# BACKEND_URL = "https://your-heroku-app.herokuapp.com"

PREDICT_ENDPOINT = f"{BACKEND_URL}/predict-gradio"

# Path to your sample audio file
# Make sure this file exists in the same directory as this script, or provide a full path.
AUDIO_FILE_PATH = "./audio_sample.m4a" # Or .wav, .mp3, etc.

# --- Gradio Parameters (as a Python dictionary) ---
# This dictionary will be converted to a JSON string and sent as the 'params' form field.
GRADIO_PARAMS = {
    "text": "This is a test request from Python!",
    "infer_mode": "ordinary reasoning",
    "max_text_tokens_per_sentence": 20,
    "sentences_bucket_max_size": 1,
    "param_5": True,
    "param_6": 0,
    "param_7": 0,
    "param_8": 0.1,
    "param_9": 3,
    "param_10": 1,
    "param_11": 3,
    "param_12": 50,
}

# --- Main Request Logic ---
def make_prediction_request():
    if not os.path.exists(AUDIO_FILE_PATH):
        print(f"Error: Audio file not found at {AUDIO_FILE_PATH}")
        print("Please create or place an audio file (e.g., audio_sample.m4a) in the same directory.")
        return

    try:
        # Open the audio file in binary read mode
        with open(AUDIO_FILE_PATH, 'rb') as audio_file:
            # Prepare the 'files' dictionary for multipart/form-data
            # The key 'audio_file' must match the field name expected by your backend.
            # The tuple format is (filename, file_object, content_type)
            files = {
                'audio_file': (os.path.basename(AUDIO_FILE_PATH), audio_file, 'audio/m4a') # Adjust MIME type if different
            }

            # Prepare the 'data' dictionary for other form fields
            # The 'params' key must match the field name expected by your backend.
            # The value is the JSON dictionary converted to a string.
            data = {
                'params': json.dumps(GRADIO_PARAMS)
            }

            print(f"Making POST request to: {PREDICT_ENDPOINT}")
            print(f"Sending audio file: {os.path.basename(AUDIO_FILE_PATH)}")
            print(f"Sending parameters: {json.dumps(GRADIO_PARAMS, indent=2)}")

            # Make the POST request
            response = requests.post(PREDICT_ENDPOINT, files=files, data=data)

            # Check if the request was successful (status code 2xx)
            response.raise_for_status()

            # Parse and print the JSON response
            result = response.json()
            print("\n--- Prediction Result ---")
            print(json.dumps(result, indent=2))

    except requests.exceptions.HTTPError as e:
        print(f"\nHTTP Error: {e.response.status_code} - {e.response.text}")
    except requests.exceptions.ConnectionError as e:
        print(f"\nConnection Error: Could not connect to the backend server at {BACKEND_URL}")
        print("Please ensure your Express/FastAPI server is running and accessible.")
        print(f"If running on localhost, check your `BACKEND_URL` in this script.")
        print(f"If on a physical device, ensure your phone/emulator can reach your computer's IP.")
    except requests.exceptions.RequestException as e:
        print(f"\nAn error occurred: {e}")
    except json.JSONDecodeError:
        print(f"\nError: Could not decode JSON response. Raw response: {response.text}")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")

# --- Run the request ---
if __name__ == "__main__":
    # You can create a dummy audio file for testing if you don't have one
    if not os.path.exists(AUDIO_FILE_PATH):
        print(f"Creating a dummy audio file at {AUDIO_FILE_PATH} for testing...")
        try:
            with open(AUDIO_FILE_PATH, 'wb') as f:
                f.write(b'\x00' * 1024) # Write 1KB of null bytes
            print("Dummy file created. You can replace it with a real audio file.")
        except Exception as e:
            print(f"Could not create dummy file: {e}")
            print("Please create an audio file manually or adjust AUDIO_FILE_PATH.")

    make_prediction_request()