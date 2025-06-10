from flask import Flask, request, jsonify
import os
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Play, Hangup, Say
import os

app = Flask(__name__)

# Your Twilio Account SID and Auth Token from environment variables
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER")

client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
else:
    print("WARNING: Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) not set. "
          "Call functionality will be limited. Please set them as environment variables.")

@app.route('/', methods=['GET'])
def get_status():
    return jsonify({"status": "Server is running!", "api_version": "1.0"})

# --- Modified: Main POST endpoint to make a call with AMD ---
@app.route('/make-call', methods=['POST'])
def make_call():
    if not client:
        return jsonify({"error": "Twilio client not initialized. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."}), 500
    if not TWILIO_PHONE_NUMBER:
        return jsonify({"error": "TWILIO_PHONE_NUMBER not set. Cannot make calls."}), 500

    to_phone_number = request.json.get('phone_number')

    if not to_phone_number:
        return jsonify({"error": "Phone number is required"}), 400

    try:
        # IMPORTANT: Replace 'http://your-ngrok-url.ngrok.io' with your actual ngrok URL
        # If testing locally, this must be your ngrok public URL.
        base_url = "http://your-ngrok-url.ngrok.io" # e.g., https://abcdef123456.ngrok.io

        call = client.calls.create(
            to=to_phone_number,
            from_=TWILIO_PHONE_NUMBER,
            url=f"{base_url}/initial-call-instructions", # Initial TwiML instructions
            machine_detection='DetectMessageEnd',       # Enable Answering Machine Detection
            async_amd_status_callback=f"{base_url}/amd-callback", # URL to notify with AMD result
            async_amd_status_callback_method='POST'    # Method for the AMD callback
        )
        return jsonify({"message": "Call initiated with AMD. Check AMD callback for result.", "call_sid": call.sid}), 200
    except Exception as e:
        print(f"Error initiating call: {e}")
        return jsonify({"error": f"Failed to initiate call: {str(e)}"}), 500

# --- NEW: Initial TwiML endpoint for calls with AMD ---
# This endpoint is called by Twilio as soon as the call is "answered" (could be human or machine)
# The key is that AMD is running in the background.
@app.route('/initial-call-instructions', methods=['POST'])
def initial_call_instructions():
    """
    This TwiML is executed immediately after the call is answered,
    while AMD runs in the background.
    """
    response = VoiceResponse()
    # You can play a short silence here or a brief message,
    # or just let AMD run. For AMD with DetectMessageEnd, Twilio
    # will hold the line until the greeting ends before executing next TwiML.
    # If AMD is 'Enable', this TwiML will run immediately upon answer.
    # For this example, we'll keep it simple and just let AMD work.
    # If you want to play a sound that will be interrupted if AMD triggers a new action,
    # you can put it here.
    response.say("Please wait while we connect your call.") # This might be cut short by AMD.
    # If you remove the .say() and only let AMD determine, you can
    # also use <Play loop="0"> a silent MP3 to keep the line open indefinitely
    # until AMD callback or timeout.
    return str(response), 200, {'Content-Type': 'text/xml'}


# --- NEW: AMD Callback Endpoint ---
@app.route('/amd-callback', methods=['POST'])
def amd_callback():
    """
    This endpoint receives the Answering Machine Detection results from Twilio.
    Twilio sends parameters like 'AnsweredBy', 'CallSid', etc.
    """
    call_sid = request.form.get('CallSid')
    answered_by = request.form.get('AnsweredBy') # Will be 'human', 'machine_end_beep', 'machine_end_silence', 'fax', 'unknown'

    print(f"AMD Callback received for Call SID: {call_sid}")
    print(f"Answered By: {answered_by}")

    # Now, based on 'answered_by', you can decide what to do
    response = VoiceResponse()

    if answered_by == 'human':
        response.say("Hello, a human has answered. This is a personalized message for you.")
        # Optionally, connect to an agent, start an IVR, etc.
        # response.dial('+19876543210')
    elif answered_by.startswith('machine'): # Catches machine_start, machine_end_beep, machine_end_silence, machine_end_other
        response.say("Please leave your message after the beep.")
        response.record(timeout=10, transcribe=True, transcribe_callback="/transcription-callback") # Record voicemail
        response.hangup() # Hang up after recording
    else: # fax or unknown
        response.say("Sorry, we couldn't detect a human. Goodbye.")
        response.hangup()

    # Log the decision for debugging
    print(f"TwiML response for AMD: {str(response)}")

    return str(response), 200, {'Content-Type': 'text/xml'}

# --- NEW: Transcription Callback Endpoint (optional, if you record voicemails) ---
@app.route('/transcription-callback', methods=['POST'])
def transcription_callback():
    """
    This endpoint receives the transcription of a recorded voicemail.
    """
    call_sid = request.form.get('CallSid')
    recording_url = request.form.get('RecordingUrl')
    transcription_text = request.form.get('TranscriptionText')

    print(f"Transcription Callback received for Call SID: {call_sid}")
    print(f"Recording URL: {recording_url}")
    print(f"Transcription: {transcription_text}")

    # Here you would typically save this information to a database,
    # send an email, trigger another process, etc.
    return '', 200 # Twilio expects a 200 OK

# --- Existing: TwiML endpoint to play audio and then hang up (still usable directly if AMD is not used) ---
@app.route('/play-audio-and-hangup', methods=['POST'])
def play_audio_and_hangup():
    response = VoiceResponse()
    audio_file_url = "http://com.twilio.loudecho.twinumbers.s3.amazonaws.com/Twilio.mp3" # Twilio sample audio
    response.play(audio_file_url)
    response.hangup()
    return str(response), 200, {'Content-Type': 'text/xml'}

# --- Existing: API endpoint for a simple test call (without AMD) ---
@app.route('/test-call', methods=['POST'])
def test_call():
    # ... (Keep this as is, or modify to use AMD for testing)
    if not client:
        return jsonify({"error": "Twilio client not initialized. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."}), 500
    if not TWILIO_PHONE_NUMBER:
        return jsonify({"error": "TWILIO_PHONE_NUMBER not set. Cannot make test calls."}), 500

    to_phone_number = request.json.get('phone_number')

    if not to_phone_number:
        return jsonify({"error": "Phone number for test call is required."}), 400

    try:
        test_twiml = VoiceResponse()
        test_twiml.say("This is a simple test call from your Twilio API setup. If you hear this, your configuration is likely working!")
        test_twiml.hangup()

        call = client.calls.create(
            to=to_phone_number,
            from_=TWILIO_PHONE_NUMBER,
            twiml=str(test_twiml) # Embed the TwiML directly
        )
        return jsonify({
            "message": "Simple test call initiated successfully (without AMD).",
            "call_sid": call.sid,
            "status": "Check the provided phone number. If it rings and plays the message, Twilio is configured correctly."
        }), 200
    except Exception as e:
        print(f"Error initiating test call: {e}")
        return jsonify({
            "error": f"Failed to initiate test call: {str(e)}",
            "details": "This might indicate an issue with your Twilio credentials, "
                       "the 'from' Twilio phone number, or the 'to' phone number format/verification status."
        }), 500

if __name__ == '__main__':
    # Make sure to run ngrok if testing locally: ngrok http 5000
    # Then update base_url in make_call with your ngrok URL.
    app.run(debug=True, port=5000)