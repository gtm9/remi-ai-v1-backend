import argparse
import os
import sys
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from gradio_client import Client
import warnings

# Suppress warnings for consistency
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# Command-line arguments
parser = argparse.ArgumentParser(description="IndexTTS API Service (Gradio Client)")
parser.add_argument("--verbose", action="store_true", default=False, help="Enable verbose mode")
parser.add_argument("--port", type=int, default=8000, help="Port to run the API on")
parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to run the API on")
parser.add_argument("--gradio_url", type=str, default="http://127.0.0.1:7860", help="URL of the running Gradio app")
cmd_args = parser.parse_args()

# Initialize Gradio client
try:
    client = Client(cmd_args.gradio_url)
except Exception as e:
    print(f"Failed to connect to Gradio app at {cmd_args.gradio_url}: {str(e)}")
    sys.exit(1)

# FastAPI app
app = FastAPI(title="IndexTTS API Service", description="API for interacting with IndexTTS Gradio app")

# Pydantic model for TTS request
class TTSRequest(BaseModel):
    text: str
    infer_mode: str = "ordinary reasoning"
    max_text_tokens_per_sentence: int = 120
    sentences_bucket_max_size: int = 4
    do_sample: bool = True
    top_p: float = 0.8
    top_k: int = 30
    temperature: float = 1.0
    length_penalty: float = 0.0
    num_beams: int = 3
    repetition_penalty: float = 10.0
    max_mel_tokens: int = 600

@app.post("/upload_prompt", summary="Upload reference audio file to Gradio app")
async def upload_prompt(file: UploadFile = File(...)):
    """
    Upload a reference audio file to the Gradio app's prompt_audio component.
    Returns the filename of the uploaded audio.
    """
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    # Save the uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
        temp_file.write(await file.read())
        temp_file_path = temp_file.name

    try:
        # Upload the file to Gradio's prompt_audio component
        result = client.predict(
            audio=temp_file_path,
            fn_index=0  # Corresponds to the prompt_audio.upload event
        )
        # The result contains the updated button state or the uploaded file path
        uploaded_filename = os.path.basename(temp_file_path)
        return {"filename": uploaded_filename, "path": temp_file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading to Gradio: {str(e)}")
    finally:
        os.unlink(temp_file_path)  # Clean up temporary file

@app.post("/generate_speech", response_class=FileResponse, summary="Generate speech via Gradio app")
async def generate_speech(
    prompt_filename: str = Form(...),
    tts_request: TTSRequest = Form(...),
):
    """
    Generate speech by sending text and parameters to the Gradio app.
    Returns the generated audio file.
    """
    # Verify prompt file exists locally (since it was uploaded)
    if not os.path.exists(prompt_filename):
        raise HTTPException(status_code=404, detail="Prompt audio file not found")

    try:
        # Submit request to Gradio app's gen_button.click event
        result = client.predict(
            prompt_audio=prompt_filename,
            input_text_single=tts_request.text,
            infer_mode=tts_request.infer_mode,
            max_text_tokens_per_sentence=tts_request.max_text_tokens_per_sentence,
            sentences_bucket_max_size=tts_request.sentences_bucket_max_size,
            do_sample=tts_request.do_sample,
            top_p=tts_request.top_p,
            top_k=tts_request.top_k,
            temperature=tts_request.temperature,
            length_penalty=tts_request.length_penalty,
            num_beams=tts_request.num_beams,
            repetition_penalty=tts_request.repetition_penalty,
            max_mel_tokens=tts_request.max_mel_tokens,
            fn_index=1  # Corresponds to gen_button.click event
        )
        
        # The result is the path to the generated audio file
        if not os.path.exists(result):
            raise HTTPException(status_code=500, detail="Gradio app failed to generate audio")
        
        # Return the generated audio file
        output_filename = os.path.basename(result)
        return FileResponse(result, media_type="audio/wav", filename=output_filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating speech via Gradio: {str(e)}")

@app.get("/health", summary="Check API and Gradio app connectivity")
async def health_check():
    """
    Check if the API service and Gradio app are running.
    """
    try:
        # Attempt a simple prediction to verify Gradio connectivity
        client.predict(fn_index=0)
        return {"status": "healthy", "gradio_connected": True}
    except Exception as e:
        return {"status": "healthy", "gradio_connected": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=cmd_args.host, port=cmd_args.port)
    