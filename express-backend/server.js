// server.js
import express from 'express';
import cors from 'cors';
// import multer from 'multer'; // Multer is removed as per your last request, so keep it commented or remove
import path from 'path';
import fs from 'fs/promises'; // Node's file system module with promises
import { Client } from '@gradio/client'; // Direct ES Module import now!
import crypto from 'crypto'; // For generating unique filenames
import { fileURLToPath } from 'url'; // To get __filename equivalent
import { dirname } from 'path';     // To get __dirname equivalent
import { SignalWire } from "@signalwire/realtime-api";

// Polyfill for __filename and __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// CORS: Allows your React Native app to make requests to this server
app.use(cors({
    origin: [
        'http://localhost:8081', // Expo Metro bundler
        'http://localhost',      // iOS Simulator
        'exp://localhost:19000', // Expo Go default
        'http://10.0.2.2:8080',   // Android Emulator loopback to host machine
        // Add your actual local IP for testing on physical devices:
        // 'http://192.168.1.X:8080', // Replace with your computer's actual local IP and port
    ],
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body Parser: NOW expecting JSON in the body
app.use(express.json()); // USE THIS FOR BODY PARSING

// --- Gradio Configuration ---
const GRADIO_API_URL = "https://f4940f9875a945e06d.gradio.live/";
const GRADIO_PREDICT_PATH = "/gen_single";

// Directory for temporary downloaded files (using __dirname for absolute path)
const TEMP_DOWNLOAD_DIR = path.join(__dirname, 'temp_downloads');
// Ensure the directory exists asynchronously
fs.mkdir(TEMP_DOWNLOAD_DIR, { recursive: true }).catch(console.error);


// --- Routes ---

// Make call
app.get('/make-call', async (req, res) => {
    console.log("51 making call",req)
    const client = await SignalWire({ project: "83090b4a-5137-41db-93ad-784af9857fd9", token: "PT69a6951c78fa5ba46e3aa96d394a04d78a586f83e1e2949d" })
    const voiceClient = client.voice;

    const call = await voiceClient.dialPhone({
    from: "+15134341884",
    to: "+17373143030"
    });

    await call.playTTS({ text: "Welcome to SignalWire!" });
    res.status(200).json({ status: 'ok', message: 'call is being made', timestamp: new Date().toISOString() });
});

// Health Check API
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

// Basic test route
app.get('/', (req, res) => {
    res.send('Express Gradio Proxy Server is running!');
});

// Route to handle Gradio predictions
// No `multer` middleware needed anymore as we're not receiving a file upload
app.post('/predict-gradio', async (req, res) => {
    // Client is now directly imported, no need for dynamic check at route level
    // if (!Client) { /* ... */ } // Remove this check, it's not needed with static import

    // Now, expect audioUrl and params directly in the JSON body
    const { audioUrl, ...gradioParams } = req.body;
    console.log('67 req.body',req.body)

    if (!audioUrl) {
        return res.status(400).json({ error: 'No audioUrl provided in the request body.' });
    }

    let tempFilePath = null; // Initialize to null
    let processedResult = null;
    try {
        console.log(`Received audio URL: ${audioUrl}`);
        console.log('Received parameters:', gradioParams);

        const response_0 = await fetch(audioUrl);
        const exampleAudio = await response_0.blob();

        // 1. Download the audio file from the provided URL
        console.log(`Attempting to download audio from: ${audioUrl}`);
        const response = await fetch(audioUrl); // Node.js v18+ has native fetch
        if (!response.ok) {
            throw new Error(`Failed to download audio from URL: ${response.status} ${response.statusText}`);
        }

        // Generate a unique filename for the downloaded audio
        const fileExtension = path.extname(new URL(audioUrl).pathname) || '.m4a'; // Extract from URL or default
        const uniqueFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
        tempFilePath = path.join(TEMP_DOWNLOAD_DIR, uniqueFilename); // Use the correct absolute path

        // Save the downloaded audio to a temporary file
        const arrayBuffer = await response.arrayBuffer(); // Get response as ArrayBuffer
        await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer)); // Write Buffer to file

        console.log(`Audio downloaded and saved to: ${tempFilePath}`);

        // 2. Connect to Gradio Client and make prediction
        const client = await Client.connect(GRADIO_API_URL);

        const inputs = {
            prompt: exampleAudio, // Use the path to the downloaded local file
            text: gradioParams.text,
            infer_mode: gradioParams.infer_mode || "ordinary reasoning",
            max_text_tokens_per_sentence: gradioParams.max_text_tokens_per_sentence || 20,
            sentences_bucket_max_size: 1,
            param_5: gradioParams.param_5 !== undefined ? gradioParams.param_5 : true,
            param_6: gradioParams.param_6 !== undefined ? gradioParams.param_6 : 0,
            param_7: gradioParams.param_7 !== undefined ? gradioParams.param_7 : 0,
            param_8: gradioParams.param_8 !== undefined ? gradioParams.param_8 : 0.1,
            param_9: gradioParams.param_9 !== undefined ? gradioParams.param_9 : 0,
            param_10: gradioParams.param_10 !== undefined ? gradioParams.param_10 : 1,
            param_11: gradioParams.param_11 !== undefined ? gradioParams.param_11 : 3,
            param_12: gradioParams.param_12 !== undefined ? gradioParams.param_12 : 50,
        };

        const result = await client.predict(
            GRADIO_PREDICT_PATH,
            inputs
        );

        console.log('124 Gradio prediction result:', result);
        console.log('125 result[0]:', result.data[0].value.url.includes('gradio.live/gradio_api/file='));

        // --- NEW LOGIC TO PROCESS THE URL ---
        if (result.data[0].value.url.includes('gradio.live/gradio_api/file=')) {
            let problematicUrl = result.data[0].value.url;
            try {
                // Find the index of "file="
                const fileParamIndex = problematicUrl.indexOf('file=');
                if (fileParamIndex !== -1) {
                    const baseUrlPart = problematicUrl.substring(0, fileParamIndex + 5); // Keep "file="
                    const filePathPart = problematicUrl.substring(fileParamIndex + 5); // This is the C:\Users\... part

                    // URL-encode the backslashes
                    const encodedFilePathPart = encodeURIComponent(filePathPart); // Encodes '/', ':', '\' etc.
                    // This is more robust. However, `encodeURIComponent` also encodes forward slashes,
                    // which might not be what Gradio expects for its internal path.
                    // A more targeted approach is to only replace backslashes:
                    const backslashEncodedFilePathPart = filePathPart.replace(/\\/g, '%5C');
                    console.log("144 backslashEncodedFilePathPart",backslashEncodedFilePathPart)

                    // Reconstruct the URL using the base and the correctly encoded path
                    result.data[0].value.url = `${baseUrlPart}${backslashEncodedFilePathPart}`;
                    console.log('Converted Gradio URL for client:', result.data[0].value.url);
                }
            } catch (urlProcessingError) {
                console.error("Error processing Gradio output URL:", urlProcessingError);
                // Fallback: If processing fails, send the original problematic URL.
            }
        }
        processedResult = result; // Use the (potentially modified) result

                // --- Final response to frontend ---
        const finalResponseToFrontend = {
            predictedAudioUrl: processedResult,
            // You can also include other outputs if your Gradio model has them:
            // e.g., textOutput: gradioRawResult.data[1].value, // If a second output is text
            // Optional: for advanced debugging, you can send the raw result too:
            // rawGradioResult: gradioRawResult
        };


        console.log('Gradio prediction processedResult:', finalResponseToFrontend);
        res.json(finalResponseToFrontend)

    } catch (error) {
        console.error('Error during Gradio prediction:', error);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    } finally {
        // Clean up the temporary downloaded file
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
                console.log(`Cleaned up temporary file: ${tempFilePath}`);
            } catch (cleanupError) {
                console.error(`Error cleaning up file ${tempFilePath}:`, cleanupError);
            }
        }
    }
});


// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
    console.log(`Access from physical device/emulator at http://YOUR_MACHINE_IP:${PORT}`);
});
