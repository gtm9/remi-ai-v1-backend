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
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import BodyParser from 'body-parser';
import * as FirebaseService from './FirebaseService.js';
import {Expo} from "expo-server-sdk";
import Agenda from 'agenda';

const jsonParser = BodyParser.json();
const httpParser = BodyParser.urlencoded({ extended: true });

const expo = new Expo();

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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
        'http://localhost',
        'http://localhost:5173',
        'https://76e6d2e8f49f.ngrok-free.app',
        'exp://localhost:19000', // Expo Go default
        'http://10.0.2.2:8080',   // Android Emulator loopback to host machine
        'https://kjauxcs-gtm94-8081.exp.direct'
        // Add your actual local IP for testing on physical devices:
        // 'http://192.168.1.X:8080', // Replace with your computer's actual local IP and port
    ],
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));

// Body Parser: NOW expecting JSON in the body
app.use(express.json()); // USE THIS FOR BODY PARSING

// --- Gradio Configuration ---
const GRADIO_API_URL = "http://localhost:7860"; // Replace with your Gradio server URL
const GRADIO_PREDICT_PATH = "/gen_single";

// Directory for temporary downloaded files (using __dirname for absolute path)
const TEMP_DOWNLOAD_DIR = path.join(__dirname, 'temp_downloads');
// Ensure the directory exists asynchronously
fs.mkdir(TEMP_DOWNLOAD_DIR, { recursive: true }).catch(console.error);


// --- Routes ---

// Make call
// app.post('/make-call', async (req, res) => {
//     const generatedAudioUrl = req.body.generatedAudioUrl.uri;
//     console.log("53 generatedAudioUrl",req.body.generatedAudioUrl.uri)
//     const phoneNumber = "+1" + req.body.reminder.phoneNumber;
//     // phoneNumber = +17373143030
//     console.log("56 phoneNumber",req.body.reminder.phoneNumber)
//     const client = await SignalWire({ project: "83090b4a-5137-41db-93ad-784af9857fd9", token: "PT69a6951c78fa5ba46e3aa96d394a04d78a586f83e1e2949d" })
//     const voiceClient = client.voice;

//     const call = await voiceClient.dialPhone({
//     from: "+15134341884",
//     to: phoneNumber,
//     });

//     await call.playAudio({
//         url: generatedAudioUrl,
//         listen: {
//             onStarted: () => console.log("Started playing"),
//             onFailed: (err) => console.log("Failed to play", err),
//             onUpdated: (event) => console.log("Updated playing", event.state),
//             onEnded: async (event) => {
//                 console.log("Ended playing", event.state);
//                 try {
//                     await call.hangup();
//                 } catch (err) {
//                     console.warn("Hangup error (likely call already ended):", err?.message || err);
//                 }
//             }
//         }
//     }).onStarted();

//     // // Listen for incoming calls
//     // await voiceClient.listen({
//     //     topics: ["office"],
//     //     onCallReceived: async (call) => {
//     //         console.log("Call received");
//     //         // Answer the call and play an audio file. Listens for playback events. Ends the call after the audio file is finished playing.
//     //         call.answer();
//     //         await call.playTTS({
//     //         text: "Hello, this is a test call from SignalWire",
//     //         listen: {
//     //             onStarted: () => console.log("TTS started"),
//     //             onFailed: () => console.log("TTS failed"),
//     //             onUpdated: (tts) => console.log("TTS state:", tts.state),
//     //             onEnded: () => {
//     //             console.log("TTS ended");
//     //             // Hangup the call
//     //             call.hangup();
//     //             }
//     //         }
//     //         }).onStarted();
//     //         await call.playAudio({
//     //             url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
//     //             listen: {
//     //                 onStarted: () => console.log("Started playing"),
//     //                 onFailed: (err) => console.log("Failed to play", err),
//     //                 onUpdated: (event) => console.log("Updated playing", event.state),
//     //                 onEnded: (event) => {
//     //                     console.log("Ended playing", event.state);
//     //                     // Hangup the call
//     //                     call.hangup();
//     //                     }
//     //             }
//     //         }).onStarted();
//     //     }
//     // });
//     res.status(200).json({ status: 'ok', message: 'call is being made', timestamp: new Date().toISOString() });
// });

// Make call
const makeCall = async (reminder) => {
    const generatedAudioUrl = reminder.generatedUrl;
    console.log("53 generatedAudioUrl",reminder)
    const phoneNumber = "+1" + reminder.phoneNumber;
    // phoneNumber = +17373143030
    console.log("56 phoneNumber",reminder.phoneNumber)
    const client = await SignalWire({ project: "83090b4a-5137-41db-93ad-784af9857fd9", token: "PT69a6951c78fa5ba46e3aa96d394a04d78a586f83e1e2949d" })
    const voiceClient = client.voice;

    const call = await voiceClient.dialPhone({
    from: "+15134341884",
    to: phoneNumber,
    });

    await call.playAudio({
        url: generatedAudioUrl,
        listen: {
            onStarted: () => console.log("Started playing"),
            onFailed: (err) => console.log("Failed to play", err),
            onUpdated: (event) => console.log("Updated playing", event.state),
            onEnded: async (event) => {
                console.log("Ended playing", event.state);
                try {
                    await call.hangup();
                } catch (err) {
                    console.warn("Hangup error (likely call already ended):", err?.message || err);
                }
            }
        }
    }).onStarted();
};

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

    if (!audioUrl) {
        return res.status(400).json({ error: 'No audioUrl provided in the request body.' });
    }

    let tempFilePath = null; // Initialize to null
    let processedResult = null;
    try {
        const m4aTempPath = path.join(TEMP_DOWNLOAD_DIR, `input_${Date.now()}.m4a`);
        const wavTempPath = path.join(TEMP_DOWNLOAD_DIR, `output_${Date.now()}.wav`);
   
        const response_0 = await fetch(audioUrl);
        if (!response_0.ok) {
            throw new Error(`Failed to download audio from URL: ${response_0.status} ${response_0.statusText}`);
        }
        const m4aBuffer = Buffer.from(await response_0.arrayBuffer());
        await fs.writeFile(m4aTempPath, m4aBuffer); // Save m4a

        // Convert m4a to wav using ffmpeg
        await new Promise((resolve, reject) => {
            ffmpeg(m4aTempPath)
                .toFormat('wav')
                .on('end', resolve)
                .on('error', reject)
                .save(wavTempPath);
        });

        // Now read the wav file as a buffer
        const wavBuffer = await fs.readFile(wavTempPath);

        console.log(`Audio downloaded and saved to: ${wavTempPath}`);

        // 2. Connect to Gradio Client and make prediction
        const client = await Client.connect(GRADIO_API_URL);

        const inputs = {
            prompt: new File([wavBuffer], 'audio.wav', { type: 'audio/wav' }),
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
        processedResult = result.data[0].value.url; // Use the (potentially modified) result
        // --- Upload to Cloudflare ---
        // 1. Download the audio file from the Gradio public URL
        const gradioAudioUrl = processedResult;
  
        const audioResponse = await fetch(gradioAudioUrl);
        if (!audioResponse.ok) {
            throw new Error(`Failed to download audio from Gradio URL: ${audioResponse.status} ${audioResponse.statusText}`);
        }
        console.log('Audio downloaded from Gradio URL successfully.',audioResponse);
        const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

        const formData = new FormData();
        const fileName = `uploaded_${Date.now()}.wav`; // Use correct extension if known
        const blob = new Blob([audioBuffer], { type: 'audio/wav' }); // Set correct MIME type if known
        formData.append('file', blob, fileName);

        const url = new URL('https://myportal-api.src.xyz/api/v1.1/R2/Upload');
        url.searchParams.append('selectR2Bucket', 'REMI_AI_VOICE_AUDIO_BUCKET');
        url.searchParams.append('filePath', 'generated_audio_sources');
        url.searchParams.append('id', `uploaded_${Date.now()}`);
        url.searchParams.append('type', 'generated_audio');

        const generatedAudioResponse = await fetch(url, {
            method: 'POST',
            headers: {
                accept: '*/*',
            },
            body: formData,
        });

        if (!generatedAudioResponse.ok) {
            const errorText = await generatedAudioResponse.text();
            throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
        }

        const responseData = await generatedAudioResponse.json();
        console.log('Upload successful:', responseData);

        // --- Final response to frontend ---
        const finalResponseToFrontend = {
            predictedAudioUrl: {
                url: responseData.fileUrl, // Use the URL from the upload response
                fileKey: responseData.fileKey, // Use the file key from the upload response
                eTag: responseData.eTag, // Use the type from the upload response
            },
            // You can also include other outputs if your Gradio model has them:
            // e.g., textOutput: gradioRawResult.data[1].value, // If a second output is text
            // Optional: for advanced debugging, you can send the raw result too:
            // rawGradioResult: gradioRawResult
        };

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

app.get('/getReminders', httpParser, async (req, res) => {
    const reminders = await FirebaseService.getAllReminders();
    res.status(201).json(reminders);
});


// app.post('/sample', jsonParser, async (req, res) => {
//     console.log("Received request to save sample:", req.body);
//     const moistureLevel = Number(req.body.moisture);
//     const userId = String(req.body.userId);
//     FirebaseService.saveSample(moistureLevel,userId);
//     res.status(200).send('Moisture level saved successfully');
// });

// app.get('/analytics', httpParser, async (req, res) => {
//     console.log("req._parsedUrl.query for analytics:", req._parsedUrl.query);
//     console.log("req.query for analytics:", req.query);
//     const userId = String(req.query.userId);
//     console.log("userId for analytics:", userId);
//     const samples = await FirebaseService.getSamples(userId);
//     res.status(200).send(samples)
// });

app.post('/registerPushToken', jsonParser, async (req, res) => {
    console.log("Received request to save token:", req.body);
    const userId = String(req.body.userId);
    const token = String(req.body.token);
    await FirebaseService.saveToken(userId, token);
    res.status(200).send('Token saved successfully');
});

app.post('/sendNotification', jsonParser, async (req, res) => {
    const { token } = await FirebaseService.getToken('0000001');

    expo.sendPushNotificationsAsync([
        {
            to: token,
            title: 'Test Notification',
            body: 'This is a test notification from the Express server.',
            data: { extraData: 'This is some extra data' },
        },
    ])
    
    // expo.sendPushNotificationsAsync([
    //     {
    //         to: token,
    //         title: 'Test Notification',
    //         body: 'This is a test notification from the Express server.',
    //         data: { extraData: 'This is some extra data' },
    //     },
    // ])
    res.status(200).send('Notification sent successfully');
});

app.post('/storeNotification', jsonParser, async (req, res) => {
    const { token } = await FirebaseService.getToken('0000001');

    expo.sendPushNotificationsAsync([
        {
            to: token,
            title: 'Test Notification',
            body: 'This is a test notification from the Express server.',
            data: { extraData: 'This is some extra data' },
        },
    ])

    res.status(200).send('Notification sent successfully');
});

// --- Reminder Scheduler Functions (Integrated) ---
async function addScheduledTask(reminder) {
    /**
     * Adds a new reminder task to Firestore to be scheduled.
     * @param {object} reminder - The reminder object containing details.
     */
    try {
        console.log(`Adding reminder task: Title='${reminder.reminderTitle}', Scheduled for='${reminder.scheduledTime}'`);
        const scheduledTimeISO = reminder.scheduledTime; // Store as ISO string for portability

        await FirebaseService.saveReminder({
            id: reminder.id,
            phoneNumber: reminder.phoneNumber,
            scheduledTime: scheduledTimeISO,
            reminderTitle: reminder.reminderTitle,
            reminderDescription: reminder.reminderDescription,
            sourceAudio: reminder.sourceAudio,
            reminderDescriptionAudio: reminder.reminderDescriptionAudio,
            status: 'pending',
            created_at: FirebaseService.getServerTimeStamp()
        });
        console.log(`Reminder task added: Title='${reminder.reminderTitle}', Scheduled for='${scheduledTimeISO}'`);
        return reminder.id;
    } catch (error) {
        console.error(`Error adding task to Firestore: ${error.message}`);
        return null;
    }
}

async function getAllPendingTasks() {
    /**
     * Retrieves all pending tasks from Firestore.
     * @returns {Promise<Array<object>>} A list of pending tasks.
     */
    try {
        // const snapshot = await remindersCollection.where('status', '==', 'pending').get();
        const snapshot = await FirebaseService.getPendingReminders();
        const parsedTasks = [];
        snapshot.forEach(doc => {
            const data = doc;
            try {
                parsedTasks.push({
                    id: doc.id, // Firestore document ID
                    phoneNumber: data.phoneNumber,
                    scheduled_time: new Date(data.scheduled_time), // Convert ISO string back to Date
                    reminder_title: data.reminder_title,
                    reminder_description: data.reminder_description
                });
            } catch (parseError) {
                console.error(`Error parsing task data (ID: ${doc.id}): ${parseError.message}`);
            }
        });
        console.log(`Retrieved pending tasks from Firestore.`,parsedTasks);
        return parsedTasks;
    } catch (error) {
        console.error(`Error retrieving tasks from Firestore: ${error.message}`);
        return [];
    }
}

async function updateTaskStatus(taskId, status, result = null) {
    /**
     * Updates the status and result of a task in Firestore.
     * @param {string} taskId - The ID of the task to update (Firestore document ID).
     * @param {string} status - The new status ('completed', 'failed', 'error', etc.).
     * @param {string} [result=null] - A string containing the result or error message.
     */
    try {
        await FirebaseService.updateReminder(taskId,{
            status: status,
            last_run: FirebaseService.getServerTimeStamp(), // Use server timestamp
            result: result
        });
    } catch (error) {
        console.error(`Error updating task status (ID: ${taskId}): ${error.message}`);
    }
}

const uri = "mongodb+srv://svcid:d9rNIM6KCAxACAzu@org-myportal-mongodb-pr.io6qsbt.mongodb.net/?retryWrites=true&w=majority&appName=org-myportal-mongodb-prod";

// --- Agenda Scheduler Logic ---
// Agenda does not natively support Firestore for its internal job persistence.
// We will rely on re-scheduling tasks from Firestore on application startup.
const agenda = new Agenda({
  db: { address: uri, collection: 'reminderJobs' },
  processEvery: '30 seconds', // Polling interval for checking due jobs
  maxConcurrency: 10 // Limit concurrent job processing
});


// Define the job that will make the API call
agenda.define('make api call', async (job) => {
    const { taskId, reminderTitle, reminderDescription, generatedUrl, phoneNumber, reminderTime } = job.attrs.data;
    console.log(`520 job.attrs.data`,job.attrs.data);
    // Construct the payload for the API call from reminder details
    const payload = {
        phoneNumber: phoneNumber,
        generatedUrl: generatedUrl, // Assuming this is part of the reminder object
        reminderTitle: reminderTitle,
        reminderDescription: reminderDescription,
        reminderTime: reminderTime, // Store as ISO string for consistency
        triggered_at: new Date().toISOString()
    };

    console.log(`[${new Date().toISOString()}] Executing reminder task ${taskId}'`);
    console.log("Payload being sent:", payload);

    try {
        // Assuming a POST request with JSON payload. Adjust method (GET, PUT, etc.) as needed.
        console.log(`[${new Date().toISOString()}] Reminder task ${taskId} completed successfully.`);
        await makeCall(payload);
        await updateTaskStatus(taskId, 'completed');
    } catch (error) {
        let errorMessage = 'An unexpected error occurred';
        if (error) {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                errorMessage = `HTTP Error: ${error.response.status}, Response: ${JSON.stringify(error.response.data).substring(0, 200)}`;
            } else if (error.request) {
                // The request was made but no response was received
                errorMessage = 'No response received from API (connection error or timeout)';
            } else {
                // Something happened in setting up the request that triggered an Error
                errorMessage = `Error setting up request: ${error.message}`;
            }
        } else {
            errorMessage = `Unexpected error: ${error.message}`;
        }
        console.error(`[${new Date().toISOString()}] Reminder task ${taskId} failed: ${errorMessage}`);
        await updateTaskStatus(taskId, 'failed', errorMessage);
    }
});

async function schedulePendingTasks() {
    /**
     * Loads all pending tasks from Firestore and adds them to Agenda.
     */
    const tasks = await getAllPendingTasks();
    console.log(`540 Found tasks`, tasks);
    if (tasks.length === 0) {
        console.log("No pending tasks found in Firestore to schedule.");
        return;
    }

    console.log(`Found ${tasks.length} pending tasks. Scheduling them now...`);
    for (const task of tasks) {
        console.log("549 task",task)
        // Agenda's `schedule` method will schedule a one-time job at the specified date.
        agenda.schedule(task.scheduledDateTime, 'make api call', {
            taskId: task.id,
            phoneNumber: task.phoneNumber,
            reminderTitle: task.reminder_title,
            reminderDescription: task.reminder_description
        });
        console.log(`[${new Date()}]Scheduled job for Firestore ID '${task.id}' for ${task.scheduled_time} to call an XXXPHONENUMBERXX (Reminder: '${task.reminder_title}')`);
    }
}

async function startScheduler() {
    /**
     * Initializes and starts the Agenda scheduler.
     */
    await agenda.start();
    console.log("Agenda scheduler started. Waiting for tasks...");
    await schedulePendingTasks();
}

// --- NEW: API Endpoint to Add a Reminder ---
app.post('/addReminder', async (req, res) => {
    console.log("602 req",req)
    const reminder = req.body; // Expecting the entire reminder object in the request body
    console.log("555 Received reminder data:", req.body);

    if (!reminder) {
        return res.status(400).json({ error: 'Missing reminder' });
    }

    try {
        const scheduledDateTime = new Date(reminder.scheduledTime); // Expecting ISO string or valid date string
        if (isNaN(scheduledDateTime.getTime())) {
            return res.status(400).json({ error: 'Invalid scheduledTime format' });
        }

        console.log("615 current date and timexx:", new Date(Date.now()));
        console.log("616 Scheduled date and time:", scheduledDateTime);

        const taskId = await addScheduledTask(reminder);
        if (taskId) {
            // Immediately schedule the newly added task with Agenda
            agenda.schedule(scheduledDateTime, 'make api call', {
                taskId: reminder.id,
                phoneNumber: reminder.phoneNumber,
                generatedUrl: reminder.reminderDescriptionAudio, // Assuming this is part of the reminder object
                reminderTitle: reminder.reminderTitle,
                reminderDescription: reminder.reminderDescription,
                reminderTime: scheduledDateTime.toISOString() // Store as ISO string for consistency
            });
            console.log(`New reminder added and scheduled via API: ID=${taskId}`);
            res.status(201).json({ message: 'Reminder added and scheduled successfully', taskId: taskId });
        } else {
            res.status(500).json({ error: 'Failed to add reminder to database.' });
        }
    } catch (error) {
        console.error('Error in /addReminder:', error);
        res.status(500).json({ error: 'Internal server error while adding reminder.' });
    }
});

// 3. PATCH to update a reminder
// Using PATCH for partial updates
app.patch('/updateReminder/:reminderId', async (req, res) => {
  try {
    const { reminderId } = req.params;
    const updatedFields = req.body; // Expects JSON body with fields to update

    console.log("650 updatedReminders reminderId updatedFields",reminderId,updatedFields)

    if (Object.keys(updatedFields).length === 0) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    const updatedReminder = await FirebaseService.updateReminder(reminderId,updatedFields); // Use the helper to determine path
    // Check if the reminder exists before trying to update
    if (!updatedReminder) {
        return res.status(404).json({ message: "Reminder not found for update" });
    }

    // --- Agenda.js Rescheduling Logic ---
    // This block will handle canceling old jobs and scheduling new ones based on the updated time.

    // First, cancel any existing scheduled job for this reminder ID.
    // This is important to prevent old schedules from triggering if the time changes.
    // Assuming your 'make api call' job uses 'data.taskId' to identify the reminder.
    await agenda.cancel({ 'data.taskId': updatedReminder.id });
    console.log(`Cancelled existing job for taskId: ${updatedReminder.id}`);

    // Check if the updated reminder has a scheduledTime and if it's a valid future date
    if (updatedReminder.scheduledTime) {
        const scheduledDateTime = new Date(updatedReminder.scheduledTime);
        const now = new Date();

        // Validate the date format
        if (isNaN(scheduledDateTime.getTime())) {
            // If scheduledTime is provided but invalid, respond with an error
            return res.status(400).json({ error: 'Invalid scheduledTime format provided for update.' });
        }

        console.log("future",scheduledDateTime > now)
        // Schedule the job ONLY if the scheduledDateTime is in the future
        if (scheduledDateTime > now) {
            await agenda.schedule(scheduledDateTime, 'make api call', {
                taskId: updatedReminder.id,
                phoneNumber: updatedReminder.phoneNumber,
                generatedUrl: updatedReminder.reminderDescriptionAudio, // Ensure this field exists in updatedReminder
                reminderTitle: updatedReminder.reminderTitle,
                reminderDescription: updatedReminder.reminderDescription,
                reminderTime: scheduledDateTime.toISOString() // Store as ISO string for consistency
            });
            console.log(`Reminder ${updatedReminder.id} rescheduled for: ${scheduledDateTime.toISOString()}`);
        } else {
            console.log(`Reminder ${updatedReminder.id} not rescheduled as scheduledTime is in the past or present.`);
        }
    } else {
        // If `scheduledTime` was explicitly removed or not provided in the update,
        // the `agenda.cancel` above already handled unscheduling any old job.
        console.log(`No scheduledTime provided for reminder ${updatedReminder.id}, ensuring no job is scheduled.`);
    }

    res.status(200).json({ message: "Reminder updated successfully", reminder: { id: reminderId, ...updatedReminder } });
  } catch (error) {
    console.error(`Error updating reminder ${req.params.reminderId}:`, error);
    res.status(500).json({ message: "Failed to update reminder", error: error.message });
  }
});

// 4. DELETE a reminder
app.delete('/deleteReminder/:reminderId', async (req, res) => {
  try {
    const { reminderId } = req.params;
    const reminderRef = await FirebaseService.deleteReminder(reminderId); // Use the helper to determine path
    console.log("682 deleteReminder reminderRef",reminderId,reminderRef)
    if (reminderRef) {
    res.status(200).json({ message: `Reminder with ID ${reminderId} deleted successfully` });
    }
  } catch (error) {
    console.error(`Error deleting reminder ${req.params.reminderId}:`, error);
    res.status(500).json({ message: "Failed to delete reminder", error: error.message });
  }
});

// --- Start the server ---
// Wrap app.listen in an async IIFE to ensure Firebase and scheduler are initialized
(async () => {
    // Initialize Firebase Admin SDK
    app.listen(PORT, async () => {
        console.log(`Express server running on http://localhost:${PORT}`);
        console.log(`Access from physical device/emulator at http://YOUR_MACHINE_IP:${PORT}`);
        await startScheduler(); // Start the scheduler after the server is listening
    });
})();


// --- Graceful Shutdown ---
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down Agenda...');
    await agenda.stop();
    // No explicit db.close() for Firebase Admin SDK as it manages its own connections.
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received (Ctrl+C). Shutting down Agenda...');
    await agenda.stop();
    // No explicit db.close() for Firebase Admin SDK as it manages its own connections.
    process.exit(0);
});
