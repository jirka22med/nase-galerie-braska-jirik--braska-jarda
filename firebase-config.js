const __firebase_config_START = performance.now();

// firebase-config.js — LCARS Galerie | Admirál Jiřík
// Inicializace Firebase — základ všeho
//
// RYCHLOST:
//  • firebase-auth se už nenačítá (galerie nepoužívá přihlášení) —
//    ušetří stažení velkého souboru + dotaz na identitytoolkit
//  • Firestore má perzistentní cache (IndexedDB, spravuje ji sám Firebase,
//    NE localStorage): při dalším otevření se obsah ukáže hned z cache
//    a na pozadí se srovná s databází. Vypnout: POUZIT_CACHE = false

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const POUZIT_CACHE = true;

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

function vytvoritDb() {
  if (!POUZIT_CACHE) return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (err) {
    console.warn("Perzistentní cache nedostupná, jedu bez ní:", err);
    return getFirestore(app);
  }
}

export const db = vytvoritDb();
export default app;



// ⏱️ LOG END 
    console.log(`%c🚀 [firebase-config] Načteno za ${(performance.now() - __firebase_config_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
