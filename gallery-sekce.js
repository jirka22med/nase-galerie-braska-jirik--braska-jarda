const __gallery_sekce_START = performance.now();

// gallery-sekce.js — LCARS Messenger | Galerie: SEKCE modul
// Samostatný modul — dynamické sekce + přesun fotek mezi nimi.
// Napojuje se výhradně přes MutationObserver na #galleryGrid,
// NIC nemění ve script.js / gallery.js / gallery-slider.js!
//
// Připojit v index.html:
//   <link rel="stylesheet" href="gallery-sekce.css">
//   <script type="module" src="gallery-sekce.js"></script>
// (modul se inicializuje sám, nic dalšího volat netřeba)

import { db } from './firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { aktualizovatSeznamObrazku, otevritSlider } from './gallery-slider.js';

// ════════════════════════════════════════════════════════════════
//  VÝCHOZÍ SEKCE — pevné ID, aby se při re-seedu neduplikovaly
// ════════════════════════════════════════════════════════════════
const VYCHOZI_SEKCE = [
  { id: "jirik",    nazev: "Bráška Jiřík", poradi: 1 },
  { id: "jarda",    nazev: "Bráška Jarda", poradi: 2 },
  { id: "spolecna", nazev: "Společná",     poradi: 3 }
];
const VSE_ID = "__vse__"; // virtuální tab "VŠE" — nikdy se neukládá do DB

// ════════════════════════════════════════════════════════════════
//  STAV MODULU
// ════════════════════════════════════════════════════════════════
let sekceSeznam      = [];        // [{id, nazev, poradi}] z gallery_sekce
let obrazkySekce      = [];       // [{id, sekce}] ve stejném pořadí jako #galleryGrid
let aktivniSekce      = VSE_ID;
let presunObrazekId   = null;

// ════════════════════════════════════════════════════════════════
//  INICIALIZACE — spustí se sama po načtení DOMu
// ════════════════════════════════════════════════════════════════
export function inicializovatGalerieSekce() {
  const sekceGalerie = document.getElementById("sekce-galerie");
  if (!sekceGalerie) return; // GALERIE sekce v HTML neexistuje — modul se neaktivuje

  seedovatVychoziSekce();
  injektovatUI(sekceGalerie);
  sledovatSekce();
  sledovatGaleriiProSekce();
  napojitObserver();
}

document.addEventListener("DOMContentLoaded", inicializovatGalerieSekce);

// ════════════════════════════════════════════════════════════════
//  SEED VÝCHOZÍCH SEKCÍ (idempotentní — pevné ID, merge: true)
// ════════════════════════════════════════════════════════════════
async function seedovatVychoziSekce() {
  for (const s of VYCHOZI_SEKCE) {
    try {
      await setDoc(doc(db, "gallery_sekce", s.id), s, { merge: true });
    } catch (err) {
      console.error("Seed sekce selhal:", s.id, err);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  REALTIME SLEDOVÁNÍ SEZNAMU SEKCÍ
// ════════════════════════════════════════════════════════════════
function sledovatSekce() {
  const q = query(collection(db, "gallery_sekce"), orderBy("poradi", "asc"));
  onSnapshot(q, (snap) => {
    sekceSeznam = [];
    snap.forEach(d => sekceSeznam.push({ id: d.id, ...d.data() }));
    vykreslitTaby();
    aplikovatSekceNaPolozky();
  }, (err) => console.error("Sekce listener chyba:", err));
}

// ════════════════════════════════════════════════════════════════
//  VLASTNÍ NEZÁVISLÝ LISTENER NA GALERII
//  (stejný dotaz jako gallery.js → stejné pořadí jako rendruje script.js)
// ════════════════════════════════════════════════════════════════
function sledovatGaleriiProSekce() {
  const q = query(collection(db, "gallery"), orderBy("timestamp", "desc"));
  onSnapshot(q, (snap) => {
    obrazkySekce = [];
    snap.forEach(d => {
      const data = d.data();
      obrazkySekce.push({ ...data, id: d.id, sekce: data.sekce || "spolecna" });
    });
    aplikovatSekceNaPolozky();
  }, (err) => console.error("Galerie (sekce) listener chyba:", err));
}

// ════════════════════════════════════════════════════════════════
//  MUTATION OBSERVER — napojení na cizí render #galleryGrid
// ════════════════════════════════════════════════════════════════
function napojitObserver() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  const observer = new MutationObserver(() => aplikovatSekceNaPolozky());
  observer.observe(grid, { childList: true });
}

// ════════════════════════════════════════════════════════════════
//  OZNAČIT KAŽDOU .gallery-item SEKCÍ + DOPLNIT BADGE A TLAČÍTKO
// ════════════════════════════════════════════════════════════════
function aplikovatSekceNaPolozky() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  const polozky = grid.querySelectorAll(".gallery-item");

  polozky.forEach((el, index) => {
    const data    = obrazkySekce[index];
    const sekceId = data?.sekce || "spolecna";
    const docId   = data?.id;

    el.dataset.sekce = sekceId;
    if (docId) el.dataset.galId = docId;

    if (docId && !el.querySelector(".gallery-presun-btn")) {
      const btn = document.createElement("button");
      btn.className = "gallery-presun-btn";
      btn.title = "Přesunout do jiné sekce";
      btn.textContent = "🔀";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        otevritPresunModal(el.dataset.galId, el.dataset.sekce);
      });
      el.appendChild(btn);
    }

    let badge = el.querySelector(".gallery-sekce-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "gallery-sekce-badge";
      el.appendChild(badge);
    }
    badge.textContent = nazevSekce(sekceId);
  });

  filtrovatPodleAktivniSekce();
}

function nazevSekce(id) {
  return sekceSeznam.find(s => s.id === id)?.nazev || id;
}

// ════════════════════════════════════════════════════════════════
//  FILTROVÁNÍ PODLE AKTIVNÍ SEKCE
//  + SYNCHRONIZACE SLIDERU — aby šipky ve fotomoldaru listovaly jen
//  fotky z aktuálně zobrazené sekce, ne z celé galerie
// ════════════════════════════════════════════════════════════════
function filtrovatPodleAktivniSekce() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  const polozky   = grid.querySelectorAll(".gallery-item");
  const viditelne = []; // data, co uvidí slider — jen aktivní sekce

  polozky.forEach((el, index) => {
    const data  = obrazkySekce[index];
    const shoda = aktivniSekce === VSE_ID || el.dataset.sekce === aktivniSekce;

    el.classList.toggle("gallery-item-hidden", !shoda);
    if (!shoda || !data) return;

    const filtrovanyIndex = viditelne.length;
    viditelne.push(data);

    // Video položky nechat na pokoji — ty řeší vlastní přehrávač
    // v gallery-video.js, sem nepatří
    if (data.typ !== "video") {
      el.onclick = () => otevritSlider(filtrovanyIndex);
    }
  });

  aktualizovatSeznamObrazku(viditelne);
}

// ════════════════════════════════════════════════════════════════
//  INJEKTÁŽ UI — panel se záložkami + oba modály
// ════════════════════════════════════════════════════════════════
function injektovatUI(sekceGalerie) {
  const grid = document.getElementById("galleryGrid");

  const tabyBar = document.createElement("div");
  tabyBar.className = "gallery-sekce-taby";
  tabyBar.id = "gallerySekceTaby";
  sekceGalerie.insertBefore(tabyBar, grid);

  // ── Modál: přesun fotky do jiné sekce ──
  const presunModal = document.createElement("div");
  presunModal.className = "modal-overlay gallery-sekce-modal-overlay";
  presunModal.id = "presunSekceModal";
  presunModal.innerHTML = `
    <div class="modal-box modal-small">
      <div class="modal-header">
        <span class="modal-title">PŘESUNOUT DO SEKCE</span>
        <button class="modal-close-btn" id="presunSekceClose">✕</button>
      </div>
      <div class="gallery-sekce-modal-seznam" id="presunSekceSeznam"></div>
    </div>`;
  document.body.appendChild(presunModal);
  presunModal.addEventListener("click", (e) => {
    if (e.target === presunModal) zavritPresunModal();
  });
  document.getElementById("presunSekceClose").addEventListener("click", zavritPresunModal);

  // ── Modál: nová sekce ──
  const novaModal = document.createElement("div");
  novaModal.className = "modal-overlay gallery-sekce-modal-overlay";
  novaModal.id = "novaSekceModal";
  novaModal.innerHTML = `
    <div class="modal-box modal-small">
      <div class="modal-header">
        <span class="modal-title">NOVÁ SEKCE GALERIE</span>
        <button class="modal-close-btn" id="novaSekceClose">✕</button>
      </div>
      <input type="text" id="novaSekceInput" class="lcars-input"
             placeholder="Název sekce..." maxlength="30">
      <div class="modal-actions">
        <button class="btn-odeslat" id="novaSekcePotvrdit">VYTVOŘIT SEKCI</button>
      </div>
    </div>`;
  document.body.appendChild(novaModal);
  novaModal.addEventListener("click", (e) => {
    if (e.target === novaModal) zavritNovaSekceModal();
  });
  document.getElementById("novaSekceClose").addEventListener("click", zavritNovaSekceModal);
  document.getElementById("novaSekcePotvrdit").addEventListener("click", vytvoritNovouSekci);
  document.getElementById("novaSekceInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") vytvoritNovouSekci();
  });
}

// ════════════════════════════════════════════════════════════════
//  VYKRESLENÍ ZÁLOŽEK SEKCÍ
// ════════════════════════════════════════════════════════════════
function vykreslitTaby() {
  const bar = document.getElementById("gallerySekceTaby");
  if (!bar) return;

  const vseTab = `<button class="gallery-sekce-tab ${aktivniSekce === VSE_ID ? "active" : ""}"
                           data-tab="${VSE_ID}">VŠE</button>`;

  const taby = sekceSeznam.map(s => `
    <button class="gallery-sekce-tab ${aktivniSekce === s.id ? "active" : ""}"
            data-tab="${escHtml(s.id)}">${escHtml(s.nazev)}</button>
  `).join("");

  bar.innerHTML = `${vseTab}${taby}<button class="gallery-sekce-tab gallery-sekce-tab-add" id="btnPridatSekci" title="Přidat sekci">+</button>`;

  bar.querySelectorAll(".gallery-sekce-tab[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      aktivniSekce = btn.dataset.tab;
      vykreslitTaby();
      filtrovatPodleAktivniSekce();
    });
  });

  document.getElementById("btnPridatSekci")?.addEventListener("click", otevritNovaSekceModal);
}

// ════════════════════════════════════════════════════════════════
//  MODÁL — PŘESUN FOTKY
// ════════════════════════════════════════════════════════════════
function otevritPresunModal(docId, aktualniSekceId) {
  presunObrazekId = docId;
  const seznam = document.getElementById("presunSekceSeznam");
  seznam.innerHTML = sekceSeznam.map(s => `
    <button class="gallery-sekce-presun-btn ${s.id === aktualniSekceId ? "current" : ""}"
            data-sekce="${escHtml(s.id)}"
            ${s.id === aktualniSekceId ? "disabled" : ""}>
      ${escHtml(s.nazev)}${s.id === aktualniSekceId ? " (aktuální)" : ""}
    </button>
  `).join("");

  seznam.querySelectorAll(".gallery-sekce-presun-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await updateDoc(doc(db, "gallery", presunObrazekId), { sekce: btn.dataset.sekce });
        zavritPresunModal();
      } catch (err) {
        alert("Přesun se nezdařil: " + err.message);
      }
    });
  });

  document.getElementById("presunSekceModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

function zavritPresunModal() {
  document.getElementById("presunSekceModal")?.classList.remove("active");
  document.body.style.overflow = "";
  presunObrazekId = null;
}

// ════════════════════════════════════════════════════════════════
//  MODÁL — NOVÁ SEKCE
// ════════════════════════════════════════════════════════════════
function otevritNovaSekceModal() {
  const input = document.getElementById("novaSekceInput");
  input.value = "";
  document.getElementById("novaSekceModal").classList.add("active");
  document.body.style.overflow = "hidden";
  input.focus();
}

function zavritNovaSekceModal() {
  document.getElementById("novaSekceModal")?.classList.remove("active");
  document.body.style.overflow = "";
}

async function vytvoritNovouSekci() {
  const input = document.getElementById("novaSekceInput");
  const nazev = input.value.trim();
  if (!nazev) return;

  const poradi = sekceSeznam.length
    ? Math.max(...sekceSeznam.map(s => s.poradi || 0)) + 1
    : 1;

  try {
    await addDoc(collection(db, "gallery_sekce"), { nazev, poradi });
    zavritNovaSekceModal();
  } catch (err) {
    alert("Nepodařilo se vytvořit sekci: " + err.message);
  }
}

// ════════════════════════════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════════════════════════════
function escHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}


// ⏱️ LOG END
console.log(`%c🚀 [gallery-sekce] Načteno za ${(performance.now() - __gallery_sekce_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
