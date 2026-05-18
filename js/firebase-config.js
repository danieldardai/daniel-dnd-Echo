import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCraUmFNrNTkBvznx0ZM-CGyXFgM-T-xf4",
  authDomain:        "echoes-beneath-db212.firebaseapp.com",
  projectId:         "echoes-beneath-db212",
  storageBucket:     "echoes-beneath-db212.firebasestorage.app",
  messagingSenderId: "904958353523",
  appId:             "1:904958353523:web:22bbb4a8980a84609b4a06",
  measurementId:     "G-G2SQGS7GKE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

console.log("Echoes Beneath initialized.");
