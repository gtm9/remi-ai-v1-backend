import { initializeApp} from 'firebase/app';
import { child, get, getDatabase, ref, set, update, remove, onValue } from 'firebase/database';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD_aplzB7jBianVS_zeChz_rPikY8PXWqU",
  authDomain: "remi-b83d9.firebaseapp.com",
  projectId: "remi-b83d9",
  storageBucket: "remi-b83d9.firebasestorage.app",
  messagingSenderId: "267713780609",
  appId: "1:267713780609:web:cca1289910a62948076680",
  measurementId: "G-4N06VHC7X7"
};

export const _ = initializeApp(firebaseConfig);
const db = getDatabase();
const dbRef = ref(db);

export const getServerTimeStamp = async (userId, token) => {
  return Date.now();
};

export const saveToken = async (userId, token) => {
  const values = (await get(child(dbRef, `userTokens/${userId}`))).val() ?? {};
  const payload = {...values, token};
  set(ref(db, `userTokens/${userId}`), payload);
};

export const saveReminder = async (reminder) => {
  set(ref(db, `reminders/${reminder.id}`), reminder);
};

export const getAllReminders = async () => {
  const reminders = (await get(child(dbRef, `reminders`))).val();
  console.log('36 reminders', reminders);
  if (!reminders) return [];
  // Filter reminders with status === "pending"
  return Object.values(reminders);
};

export const getPendingReminders = async () => {
  const reminders = (await get(child(dbRef, `reminders`))).val();
  if (!reminders) return [];
  // Filter reminders with status === "pending"
  return Object.values(reminders).filter(reminder => reminder.status === "pending");
};

export const getReminder = async (reminderId) => {
  const reminder = (await get(child(dbRef, `reminders/${reminderId}`))).val();
  return reminder ?? {};
};

export const updateReminder = async (reminderId, updatedFields) => {
  const reminderReference = ref(db, `reminders/${reminderId}`); // Create the reference
  let updatedReminder = {};
  await update(reminderReference, updatedFields);
  onValue(reminderReference, (snapshot) => {
    updatedReminder = snapshot.val();
  });
  return updatedReminder
};

// New Delete Functionality
export const deleteReminder = async (reminderId) => {
  try {
    // Construct the reference to the specific reminder you want to delete
    const reminderRef = ref(db, `reminders/${reminderId}`);
    
    // Use the remove() method to delete the data at that reference
    await remove(reminderRef);
    console.log(`Reminder with ID ${reminderId} deleted successfully.`);
    return true; // Indicate success
  } catch (error) {
    console.error(`Error deleting reminder with ID ${reminderId}:`, error);
    throw error; // Re-throw the error for handling by the caller
  }
};

export const getToken = async (userId) => {
  const values = (await get(child(dbRef, `userTokens/${userId}`))).val();
  return values ?? {};
};
