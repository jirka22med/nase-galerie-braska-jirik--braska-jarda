const __firebase_config_START = performance.now();

// firebase-config.js — LCARS Messenger | Admirál Jiřík
// Inicializace Firebase — základ všeho

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLjV9havKCkXSQVLZx7Dx5IXfaBsQSmYE",
  authDomain: "mesenger-aplikace-vc-adm-jirik.firebaseapp.com",
  projectId: "mesenger-aplikace-vc-adm-jirik",
  storageBucket: "mesenger-aplikace-vc-adm-jirik.firebasestorage.app",
  messagingSenderId: "543388043871",
  appId: "1:543388043871:web:a3bddecf15a35f583ae9ea",
  measurementId: "G-1B6CE5FR6R"
};

const app = initializeApp(firebaseConfig);

export const db  = getFirestore(app);
export const auth = getAuth(app);
export default app;



// ⏱️ LOG END 
    console.log(`%c🚀 [firebase-config] Načteno za ${(performance.now() - __firebase_config_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
