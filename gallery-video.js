const __gallery_video_START = performance.now();

// gallery-video.js — LCARS Messenger | Galerie: VIDEO modul
// Samostatný modul — vkládání YouTube videí do galerie + přehrávač na celou obrazovku.
// Napojuje se výhradně přes MutationObserver na #galleryGrid,
// NIC nemění ve script.js / gallery.js / gallery-slider.js / gallery-sekce.js!
//
// Video se ukládá do STEJNÉ kolekce "gallery" jako fotky (typ: "video"),
// takže funguje mazání (gallery-del-btn) i sekce (gallery-sekce.js) automaticky.
//
// Připojit v index.html:
//   <link rel="stylesheet" href="gallery-video.css">
//   <script type="module" src="gallery-video.js"></script>
// (modul se inicializuje sám, nic dalšího volat netřeba)

import { db, auth } from './firebase-config.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ════════════════════════════════════════════════════════════════
//  STAV MODULU
// ════════════════════════════════════════════════════════════════
let galerieData = []; // [{id, typ, videoId, popis, pridalJmeno}] — stejné pořadí jako #galleryGrid

// ════════════════════════════════════════════════════════════════
//  INICIALIZACE — spustí se sama po načtení DOMu
// ════════════════════════════════════════════════════════════════
export function inicializovatGalerieVideo() {
  const sekceGalerie = document.getElementById("sekce-galerie");
  if (!sekceGalerie) return; // GALERIE sekce v HTML neexistuje — modul se neaktivuje

  injektovatUI(sekceGalerie);
  sledovatGaleriiProVidea();
  napojitObserver();
}

document.addEventListener("DOMContentLoaded", inicializovatGalerieVideo);

// ════════════════════════════════════════════════════════════════
//  VLASTNÍ NEZÁVISLÝ LISTENER NA GALERII
//  (stejný dotaz jako gallery.js → stejné pořadí jako rendruje script.js)
// ════════════════════════════════════════════════════════════════
function sledovatGaleriiProVidea() {
  const q = query(collection(db, "gallery"), orderBy("timestamp", "desc"));
  onSnapshot(q, (snap) => {
    galerieData = [];
    snap.forEach(d => galerieData.push({ id: d.id, ...d.data() }));
    aplikovatVideaNaPolozky();
  }, (err) => console.error("Galerie (video) listener chyba:", err));
}

// ════════════════════════════════════════════════════════════════
//  MUTATION OBSERVER — napojení na cizí render #galleryGrid
// ════════════════════════════════════════════════════════════════
function napojitObserver() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  const observer = new MutationObserver(() => aplikovatVideaNaPolozky());
  observer.observe(grid, { childList: true });
}

// ════════════════════════════════════════════════════════════════
//  OZNAČIT VIDEO POLOŽKY — play ikona + přepis onclick na video modál
// ════════════════════════════════════════════════════════════════
function aplikovatVideaNaPolozky() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  const polozky = grid.querySelectorAll(".gallery-item");

  polozky.forEach((el, index) => {
    const data = galerieData[index];
    if (!data || data.typ !== "video") return; // fotka — nedotýkat se

    el.classList.add("gallery-item-video");

    if (!el.querySelector(".gallery-video-play")) {
      const play = document.createElement("div");
      play.className = "gallery-video-play";
      play.textContent = "▶";
      el.appendChild(play);
    }

    // Přepsat onclick (script.js ho nastavil jako .onclick property —
    // přepsáním property ho čistě nahradíme, žádný zásah do souboru)
    el.onclick = (e) => {
      e.stopPropagation();
      otevritVideoModal(data.videoId, data.popis, data.pridalJmeno);
    };
  });
}

// ════════════════════════════════════════════════════════════════
//  INJEKTÁŽ UI — přidávací lišta pro video + přehrávací modál
// ════════════════════════════════════════════════════════════════
function injektovatUI(sekceGalerie) {
  const grid = document.getElementById("galleryGrid");

  // ── Lišta pro vložení videa ──
  const addBar = document.createElement("div");
  addBar.className = "gallery-video-add-bar";
  addBar.id = "galleryVideoAddBar";
  addBar.innerHTML = `
    <input type="text" id="videoUrlInput" class="lcars-input"
           placeholder="YouTube odkaz...">
    <input type="text" id="videoPopisInput" class="lcars-input gallery-popis-input"
           placeholder="Popis (nepovinné)">
    <button class="btn-odeslat" id="btnPridatVideo">🎬 PŘIDAT VIDEO</button>
  `;
  sekceGalerie.insertBefore(addBar, grid);

  document.getElementById("btnPridatVideo").addEventListener("click", odeslatVideo);
  document.getElementById("videoUrlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") odeslatVideo();
  });

  // ── Modál — přehrávač videa ──
  const modal = document.createElement("div");
  modal.className = "modal-overlay gallery-video-modal-overlay";
  modal.id = "videoPrehravacModal";
  modal.innerHTML = `
    <div class="modal-box gallery-video-modal-box" id="videoModalBox">
      <div class="modal-header">
        <span class="modal-title" id="videoModalPopis"></span>
        <button class="gallery-video-fullscreen-btn" id="videoFullscreenBtn" title="Celá obrazovka">⛶</button>
        <button class="modal-close-btn" id="videoModalClose">✕</button>
      </div>
      <div class="gallery-video-wrapper" id="videoWrapper"></div>
      <div class="gallery-video-autor" id="videoModalAutor"></div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) zavritVideoModal();
  });
  document.getElementById("videoModalClose").addEventListener("click", zavritVideoModal);
  document.getElementById("videoFullscreenBtn").addEventListener("click", prepnoutCelouObrazovku);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) zavritVideoModal();
  });
}

// ════════════════════════════════════════════════════════════════
//  ODESLÁNÍ NOVÉHO VIDEA
// ════════════════════════════════════════════════════════════════
async function odeslatVideo() {
  const user = auth.currentUser;
  if (!user) return;

  const urlInput   = document.getElementById("videoUrlInput");
  const popisInput = document.getElementById("videoPopisInput");
  const btn        = document.getElementById("btnPridatVideo");

  const videoId = extrahovatYoutubeId(urlInput.value.trim());
  if (!videoId) {
    alert("Neplatný YouTube odkaz! Podporované formáty:\nyoutube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...");
    return;
  }

  btn.disabled = true;
  try {
    await addDoc(collection(db, "gallery"), {
      typ:          "video",
      videoId:      videoId,
      // URL na thumbnail — aby fotka fungovala i BEZ tohoto modulu (fallback)
      url:          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      popis:        popisInput.value.trim() || "Bez popisu",
      pridalId:     user.uid,
      pridalJmeno:  user.displayName,
      timestamp:    serverTimestamp()
    });
    urlInput.value   = "";
    popisInput.value = "";
  } catch (err) {
    alert("Video se nepodařilo přidat: " + err.message);
  } finally {
    btn.disabled = false;
  }
}

// ════════════════════════════════════════════════════════════════
//  EXTRAKCE YOUTUBE ID Z RŮZNÝCH FORMÁTŮ ODKAZU
// ════════════════════════════════════════════════════════════════
function extrahovatYoutubeId(url) {
  if (!url) return null;
  const shoda = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return shoda ? shoda[1] : null;
}

// ════════════════════════════════════════════════════════════════
//  MODÁL — PŘEHRÁVÁNÍ VIDEA
// ════════════════════════════════════════════════════════════════
function otevritVideoModal(videoId, popis, autor) {
  const wrapper = document.getElementById("videoWrapper");
  wrapper.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${videoId}?autoplay=1"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen>
    </iframe>`;

  document.getElementById("videoModalPopis").textContent = popis || "";
  document.getElementById("videoModalAutor").textContent = autor ? `— ${autor}` : "";

  document.getElementById("videoPrehravacModal").classList.add("active");
  document.body.style.overflow = "hidden";
}

function zavritVideoModal() {
  // Odstranit iframe = zastavit přehrávání
  document.getElementById("videoWrapper").innerHTML = "";
  document.getElementById("videoPrehravacModal")?.classList.remove("active");
  document.body.style.overflow = "";

  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  }
}

// ════════════════════════════════════════════════════════════════
//  CELÁ OBRAZOVKA
// ════════════════════════════════════════════════════════════════
function prepnoutCelouObrazovku() {
  const box = document.getElementById("videoModalBox");

  if (!document.fullscreenElement) {
    (box.requestFullscreen || box.webkitRequestFullscreen)?.call(box);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  }
}


// ⏱️ LOG END
console.log(`%c🚀 [gallery-video] Načteno za ${(performance.now() - __gallery_video_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
