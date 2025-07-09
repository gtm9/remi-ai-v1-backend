// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer'); // For handling file uploads
const path = require('path');
const fs = require('fs/promises'); // Node's file system module with promises
const { Client } = require('@gradio/client'); // Gradio client library

const app = express();
const PORT = process.env.PORT || 3000; // Server will run on port 3000

// --- Middleware ---
// CORS: Allows your React Native app to make requests to this server
app.use(cors({
    origin: [
        'http://localhost:8081', // Expo Metro bundler
        'http://localhost',      // iOS Simulator
        'exp://localhost:19000', // Expo Go default
        // Add your actual local IP for testing on physical devices:
        // 'http://192.168.1.X:8080', // Replace with your computer's actual local IP and port
        'http://10.0.2.2:8080',   // Android Emulator loopback to host machine
    ],
    methods: ['GET', 'POST', 'DELETE', 'PUT'], // Specify allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
}));

// Body Parsers:
// app.use(express.json()); // For parsing application/json (if sending JSON in body)
// app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Multer for file uploads:
// Configure storage to save files temporarily
const upload = multer({
    dest: 'uploads/', // Temporary directory to store uploaded files
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
});

// --- Gradio Configuration ---
const GRADIO_API_URL = "https://a65746cba64da85b13.gradio.live/";
const GRADIO_PREDICT_PATH = "/gen_single";

// --- Routes ---

// Basic test route
app.get('/', (req, res) => {
    res.send('Express Gradio Proxy Server is running!');
});

// Route to handle Gradio predictions
app.post('/predict-gradio', upload.single('audio_file'), async (req, res) => {
    // `upload.single('audio_file')` expects a field named 'audio_file' in the FormData
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const tempFilePath = req.file.path; // Path to the temporarily saved file

    try {
        // Extract other parameters from the form body (sent as a JSON string)
        const paramsString = req.body.params;
        let gradioParams;
        try {
            gradioParams = JSON.parse(paramsString);
        } catch (jsonError) {
            await fs.unlink(tempFilePath); // Clean up temp file
            return res.status(400).json({ error: 'Invalid JSON for parameters.' });
        }

        console.log(`Received audio file: ${req.file.originalname}, saved to ${tempFilePath}`);
        console.log('Received parameters:', gradioParams);

        // Connect to Gradio Client and make prediction
        const client = await Client.connect(GRADIO_API_URL);

        // Prepare inputs for Gradio client
        // The `prompt` is now the path to the temporary audio file
        const inputs = {
            prompt: tempFilePath, // Gradio client should accept a file path in Node.js
            text: gradioParams.text || "Hello!!",
            infer_mode: gradioParams.infer_mode || "ordinary reasoning",
            max_text_tokens_per_sentence: gradioParams.max_text_tokens_per_sentence || 20,
            sentences_bucket_max_size: gradioParams.sentences_bucket_max_size || 1,
            param_5: gradioParams.param_5 !== undefined ? gradioParams.param_5 : true,
            param_6: gradioParams.param_6 !== undefined ? gradioParams.param_6 : 0,
            param_7: gradioParams.param_7 !== undefined ? gradioParams.param_7 : 0,
            param_8: gradioParams.param_8 !== undefined ? gradioParams.param_8 : 0.1,
            param_9: gradioParams.param_9 !== undefined ? gradioParams.param_9 : 3,
            param_10: gradioParams.param_10 !== undefined ? gradioParams.param_10 : 1,
            param_11: gradioParams.param_11 !== undefined ? gradioParams.param_11 : 3,
            param_12: gradioParams.param_12 !== undefined ? gradioParams.param_12 : 50,
        };

        const result = await client.predict(
            GRADIO_PREDICT_PATH,
            inputs
        );

        console.log('Gradio prediction result:', result);

        res.json(result);

    } catch (error) {
        console.error('Error during Gradio prediction:', error);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    } finally {
        // Always clean up the temporary file
        try {
            await fs.unlink(tempFilePath);
            console.log(`Cleaned up temporary file: ${tempFilePath}`);
        } catch (cleanupError) {
            console.error(`Error cleaning up file ${tempFilePath}:`, cleanupError);
        }
    }
});


// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
    console.log(`Access from physical device/emulator at http://YOUR_MACHINE_IP:${PORT}`);
});


// redis://myid:My@011235Hash@myserver.src.xyz:6379