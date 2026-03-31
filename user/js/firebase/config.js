import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYsD5avcJWzW_SOvuNWD4ZRRrNFiXtH-o",
  authDomain: "lost-and-found-ba220.firebaseapp.com",
  databaseURL:
    "https://lost-and-found-ba220-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lost-and-found-ba220",
  storageBucket: "lost-and-found-ba220.firebasestorage.app",
  messagingSenderId: "135912601274",
  appId: "1:135912601274:web:7f84995c81f748c448f483",
  measurementId: "G-NEGQTKZZJS",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };
