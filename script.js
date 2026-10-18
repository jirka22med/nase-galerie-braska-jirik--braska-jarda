// script.js — LCARS Galerie | Orchestrátor (bez přihlášení, bez localStorage)
// Data jdou přímo z Firestore (kolekce "gallery") přes gallery.js.
// Moduly gallery-sekce / gallery-video / gallery-collapse se napojují samy
// přes MutationObserver na #galleryGrid.

import {
  pridatDoGalerie,
  sledovatGalerii,
  smazatZGalerie
} from './gallery.js';
import {
  inicializovatSlider,
  aktualizovatSeznamObrazku,
  otevritSlider
} from './gallery-slider.js';

// ════════════════════════════════════════════════════
//  "KDO PŘIDÁVÁ" — jen v paměti stránky, žádné úložiště
// ════════════════════════════════════════════════════
const UZIVATELE = {
  jirik: { uid: "jirik", displayName: "Bráška Jiřík" },
  jarda: { uid: "jarda", displayName: "Bráška Jarda" }
};
let aktualniUser = UZIVATELE.jirik;

// Sdílené s gallery-video.js (místo auth.currentUser)
window.__galerieUzivatel = () => aktualniUser;

// ════════════════════════════════════════════════════
//  INICIALIZACE
// ════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  inicializovatSlider();

  document.getElementById("uzivatelSelect").addEventListener("change", (e) => {
    aktualniUser = UZIVATELE[e.target.value] || UZIVATELE.jirik;
  });

  galerieButtony();
  sledovatGalerii(vykresitGalerii);
});

// ════════════════════════════════════════════════════
//  PŘIDÁNÍ OBRÁZKU
// ════════════════════════════════════════════════════
function galerieButtony() {
  const urlEl   = document.getElementById("galleryUrlInput");
  const popisEl = document.getElementById("galleryPopisInput");
  const btn     = document.getElementById("btnPridatObrazekGalerie");

  const odeslat = async () => {
    btn.disabled = true;
    try {
      await pridatDoGalerie(aktualniUser, urlEl.value, popisEl.value);
      urlEl.value = "";
      popisEl.value = "";
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  };

  btn.addEventListener("click", odeslat);
  urlEl.addEventListener("keydown", (e) => { if (e.key === "Enter") odeslat(); });
}

// ════════════════════════════════════════════════════
//  VYKRESLENÍ GALERIE
//  (struktura .gallery-item zůstává stejná jako dřív,
//   aby fungovaly moduly sekce/video a tvoje CSS)
// ════════════════════════════════════════════════════
function vykresitGalerii(obrazky) {
  const grid = document.getElementById("galleryGrid");

  if (!obrazky.length) {
    aktualizovatSeznamObrazku([]);
    grid.innerHTML = `<div class="gallery-empty">DATABÁZE PRÁZDNÁ — PŘIDEJ PRVNÍ OBRÁZEK</div>`;
    return;
  }

  // Seznam pro slider — musí být před renderem
  aktualizovatSeznamObrazku(obrazky);

  grid.innerHTML = obrazky.map((o, index) => `
    <div class="gallery-item" onclick="window.__otevritSlider(${index})">
      <img src="${escAttr(o.url)}" alt="${escAttr(o.popis)}"
           loading="lazy" decoding="async"
           onerror="this.parentElement.classList.add('gallery-item-broken')">
      <div class="gallery-item-overlay">
        <div class="gallery-popis">${escHtml(o.popis)}</div>
        <div class="gallery-autor">${escHtml(o.pridalJmeno)}</div>
      </div>
      <button class="gallery-del-btn"
              onclick="event.stopPropagation(); window.__smazatGalerie('${escAttr(o.id)}')"
              title="Smazat">✕</button>
    </div>`).join("");
}

// ════════════════════════════════════════════════════
//  GLOBÁLNÍ FUNKCE (onclick v dynamickém HTML)
// ════════════════════════════════════════════════════
window.__otevritSlider = (index) => otevritSlider(index);
window.__smazatGalerie = async (id) => {
  if (!confirm("Smazat položku z galerie?")) return;
  try {
    await smazatZGalerie(id);
  } catch (err) {
    alert("Smazání se nezdařilo: " + err.message);
  }
};

// ════════════════════════════════════════════════════
//  HELPERY
// ════════════════════════════════════════════════════
function escHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escAttr(text) {
  return escHtml(String(text ?? "")).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
