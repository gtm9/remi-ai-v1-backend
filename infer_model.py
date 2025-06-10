import json
import os
import sys
import time
import argparse
import tempfile
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from indextts.infer import IndexTTS
from tools.i18n.i18n import I18nAuto
import warnings

# Suppress warnings as in the original code
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# Command-line arguments
parser = argparse.ArgumentParser(description="IndexTTS API Service")
parser.add_argument("--verbose", action="store_true", default=False, help="Enable verbose mode")
parser.add_argument("--port", type=int, default=8000, help="Port to run the API on")
parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to run the API on")
parser.add_argument("--model_dir", type=str, default="checkpoints", help="Model checkpoints directory")
cmd_args = parser.parse_args()

# Validate model directory and required files
if not os.path.exists(cmd_args.model_dir):
    print(f"Model directory {cmd_args.model_dir} does not exist. Please download the model first.")
    sys.exit(1)

for file in ["bigvgan_generator.pth", "bpe.model", "gpt.pth", "config.yaml"]:
    file_path = os.path.join(cmd_args.model_dir, file)
    if not os.path.exists(file_path):
        print(f"Required file {file_path} does not exist. Please download it.")
        sys.exit(1)

# Initialize IndexTTS
i18n = I18nAuto(language="zh_CN")
tts = IndexTTS(model_dir=cmd_args.model_dir, cfg_path=os.path.join(cmd_args.model_dir, "config.yaml"))

# Create directories for prompts and outputs
os.makedirs("prompts", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

# FastAPI app
app = FastAPI(title="IndexTTS API Service", description="API for IndexTTS speech generation")

# Pydantic model for text input and generation parameters
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

@app.post("/upload_prompt", summary="Upload reference audio file")
async def upload_prompt(file: UploadFile = File(...)):
    """
    Upload a reference audio file to be used as a prompt for TTS.
    Returns the filename of the saved audio.
    """
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    # Save the uploaded file to the prompts directory
    filename = f"prompt_{int(time.time())}_{file.filename}"
    file_path = os.path.join("prompts", filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    return {"filename": filename, "path": file_path}

@app.post("/generate_speech", response_class=FileResponse, summary="Generate speech from text and prompt audio")
async def generate_speech(
    prompt_filename: str = Form(...),
    tts_request: TTSRequest = Form(...),
):
    """
    Generate speech from text using a reference audio prompt.
    Returns the generated audio file.
    """
    # Validate prompt file exists
    prompt_path = os.path.join("prompts", prompt_filename)
    if not os.path.exists(prompt_path):
        raise HTTPException(status_code=404, detail="Prompt audio file not found")

    # Prepare output path
    output_filename = f"spk_{int(time.time())}.wav"
    output_path = os.path.join("outputs", output_filename)

    # Prepare TTS parameters
    kwargs = {
        "do_sample": tts_request.do_sample,
        "top_p": tts_request.top_p,
        "top_k": tts_request.top_k if tts_request.top_k > 0 else None,
        "temperature": tts_request.temperature,
        "length_penalty": tts_request.length_penalty,
        "num_beams": tts_request.num_beams,
        "repetition_penalty": tts_request.repetition_penalty,
        "max_mel_tokens": tts_request.max_mel_tokens,
    }

    # Generate speech
    try:
        if tts_request.infer_mode == "ordinary reasoning":
            output = tts.infer(
                prompt_path,
                tts_request.text,
                output_path,
                verbose=cmd_args.verbose,
                max_text_tokens_per_sentence=tts_request.max_text_tokens_per_sentence,
                **kwargs
            )
        else:
            output = tts.infer_fast(
                prompt_path,
                tts_request.text,
                output_path,
                verbose=cmd_args.verbose,
                max_text_tokens_per_sentence=tts_request.max_text_tokens_per_sentence,
                sentences_bucket_max_size=tts_request.sentences_bucket_max_size,
                **kwargs
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating speech: {str(e)}")

    # Verify output file exists
    if not os.path.exists(output):
        raise HTTPException(status_code=500, detail="Failed to generate audio file")

    return FileResponse(output, media_type="audio/wav", filename=output_filename)

@app.get("/health", summary="Check API health")
async def health_check():
    """
    Check if the API service is running.
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=cmd_args.host, port=cmd_args.port)
