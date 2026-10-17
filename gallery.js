// gallery.js — LCARS Messenger | Galerie + modální lightbox
// Obrázky jako URL linky uložené ve Firestore — zero cost!

import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let unsubscribeGallery = null;

// Přidat obrázek do galerie
export async function pridatDoGalerie(user, url, popis) {
  const cistyUrl = url.trim();
  if (!cistyUrl) throw new Error("URL nesmí být prázdná!");
  if (!cistyUrl.match(/^https?:\/\/.+/)) {
    throw new Error("Neplatná URL — musí začínat https://");
  }

  await addDoc(collection(db, "gallery"), {
    url:          cistyUrl,
    popis:        popis.trim() || "Bez popisu",
    pridalId:     user.uid,
    pridalJmeno:  user.displayName,
    timestamp:    serverTimestamp()
  });
}

// Sledovat galerii realtime
export function sledovatGalerii(callback) {
  const q = query(
    collection(db, "gallery"),
    orderBy("timestamp", "desc")
  );

  unsubscribeGallery = onSnapshot(q, (snapshot) => {
    const obrazky = [];
    snapshot.forEach((docSnap) => {
      obrazky.push({ id: docSnap.id, ...docSnap.data() });
    });
    callback(obrazky);
  }, (err) => {
    console.error("Galerie listener chyba:", err);
  });

  return unsubscribeGallery;
}

// Smazat obrázek z galerie (jen vlastní)
export async function smazatZGalerie(id) {
  await deleteDoc(doc(db, "gallery", id));
}

// Odpojit listener
export function odpojitGalerii() {
  if (unsubscribeGallery) {
    unsubscribeGallery();
    unsubscribeGallery = null;
  }
}

// === MODÁLNÍ OKNO ===

export function inicializovatModal() {
  const overlay = document.getElementById("modalOverlay");
  const btnClose = document.getElementById("modalClose");

  btnClose.addEventListener("click", zavritModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) zavritModal();
  });

  // Klávesa Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") zavritModal();
  });
}

export function otevritModal(url, popis, autor) {
  document.getElementById("modalImage").src   = url;
  document.getElementById("modalPopis").textContent  = popis  || "";
  document.getElementById("modalAutor").textContent  = autor  ? `— ${autor}` : "";
  document.getElementById("modalOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
}

export function zavritModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  document.getElementById("modalImage").src = "";
  document.body.style.overflow = "";
}
