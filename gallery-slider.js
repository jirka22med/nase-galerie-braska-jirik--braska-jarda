const __gallery_slider_START = performance.now();


// gallery-slider.js — LCARS Messenger (Klubovna)
// Navigace šipkami v modálním okně galerie
// Index 0 až (počet obrázků - 1) — bez zavírání okna!

// ════════════════════════════════════════════════════════════════
//  STAV SLIDERU
// ════════════════════════════════════════════════════════════════
let aktualniIndex  = 0;
let seznamObrazku  = [];   // pole { url, popis, pridalJmeno, id }
let jeOtevreno     = false;

// ════════════════════════════════════════════════════════════════
//  INICIALIZACE — zavolat jednou při načtení stránky
// ════════════════════════════════════════════════════════════════
export function inicializovatSlider() {
  const btnPrev    = document.getElementById("modalPrev");
  const btnNext    = document.getElementById("modalNext");
  const overlay    = document.getElementById("modalOverlay");
  const btnClose   = document.getElementById("modalClose");

  // Klik na šipky
  btnPrev?.addEventListener("click", (e) => {
    e.stopPropagation();
    prejitNa(aktualniIndex - 1);
  });

  btnNext?.addEventListener("click", (e) => {
    e.stopPropagation();
    prejitNa(aktualniIndex + 1);
  });

  // Zavřít tlačítkem nebo klikem mimo
  btnClose?.addEventListener("click", zavritSlider);
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) zavritSlider();
  });

  // Klávesové zkratky
  document.addEventListener("keydown", (e) => {
    if (!jeOtevreno) return;
    if (e.key === "ArrowLeft")  prejitNa(aktualniIndex - 1);
    if (e.key === "ArrowRight") prejitNa(aktualniIndex + 1);
    if (e.key === "Escape")     zavritSlider();
  });

  // Swipe na mobilu
  inicializovatSwipe(overlay);
}

// ════════════════════════════════════════════════════════════════
//  AKTUALIZOVAT SEZNAM — volat při každém renderu galerie
// ════════════════════════════════════════════════════════════════
export function aktualizovatSeznamObrazku(obrazky) {
  // obrazky = pole objektů z Firestore { id, url, popis, pridalJmeno }
  seznamObrazku = obrazky ?? [];
}

// ════════════════════════════════════════════════════════════════
//  OTEVŘÍT SLIDER NA KONKRÉTNÍM INDEXU
// ════════════════════════════════════════════════════════════════
export function otevritSlider(index) {
  if (!seznamObrazku.length) return;

  // Zajistit platný index
  aktualniIndex = Math.max(0, Math.min(index, seznamObrazku.length - 1));
  jeOtevreno    = true;

  document.getElementById("modalOverlay").classList.add("active");
  document.body.style.overflow = "hidden";

  vykreslit();
}

// ════════════════════════════════════════════════════════════════
//  OTEVŘÍT SLIDER PODLE URL (fallback pro onclick v HTML)
// ════════════════════════════════════════════════════════════════
export function otevritSliderPodleUrl(url) {
  const index = seznamObrazku.findIndex(o => o.url === url);
  otevritSlider(index >= 0 ? index : 0);
}

// ════════════════════════════════════════════════════════════════
//  ZAVŘÍT SLIDER
// ════════════════════════════════════════════════════════════════
export function zavritSlider() {
  jeOtevreno = false;
  document.getElementById("modalOverlay").classList.remove("active");
  document.getElementById("modalImage").src = "";
  document.body.style.overflow = "";
}

// ════════════════════════════════════════════════════════════════
//  PŘEJÍT NA INDEX (s přetočením na konci)
// ════════════════════════════════════════════════════════════════
function prejitNa(novyIndex) {
  if (!seznamObrazku.length) return;

  // Přetočení — z posledního na první a naopak
  if (novyIndex < 0) {
    aktualniIndex = seznamObrazku.length - 1;
  } else if (novyIndex >= seznamObrazku.length) {
    aktualniIndex = 0;
  } else {
    aktualniIndex = novyIndex;
  }

  vykreslit();
}

// ════════════════════════════════════════════════════════════════
//  VYKRESLIT AKTUÁLNÍ OBRÁZEK DO MODÁLU
// ════════════════════════════════════════════════════════════════
function vykreslit() {
  const obrazek = seznamObrazku[aktualniIndex];
  if (!obrazek) return;

  const imgEl    = document.getElementById("modalImage");
  const popisEl  = document.getElementById("modalPopis");
  const autorEl  = document.getElementById("modalAutor");
  const citacEl  = document.getElementById("modalCitac");
  const prevEl   = document.getElementById("modalPrev");
  const nextEl   = document.getElementById("modalNext");

  // Fade efekt při přepínání
  if (imgEl) {
    imgEl.style.opacity = "0";
    imgEl.src           = obrazek.url;
    imgEl.onload        = () => { imgEl.style.opacity = "1"; };
    imgEl.onerror       = () => {
      imgEl.style.opacity = "1";
      imgEl.alt           = "Obrázek nedostupný";
    };
  }

  if (popisEl) popisEl.textContent = obrazek.popis    || "";
  if (autorEl) autorEl.textContent = obrazek.pridalJmeno ? `— ${obrazek.pridalJmeno}` : "";

  // Čítač: "3 / 12"
  if (citacEl) {
    citacEl.textContent = `${aktualniIndex + 1} / ${seznamObrazku.length}`;
  }

  // Skrýt šipky pokud je jen jeden obrázek
  const jediny = seznamObrazku.length <= 1;
  if (prevEl) prevEl.style.display = jediny ? "none" : "flex";
  if (nextEl) nextEl.style.display = jediny ? "none" : "flex";
}

// ════════════════════════════════════════════════════════════════
//  SWIPE GESTA NA MOBILU
// ════════════════════════════════════════════════════════════════
function inicializovatSwipe(element) {
  if (!element) return;

  let startX    = 0;
  let startY    = 0;
  let tahanoVo  = false;

  element.addEventListener("touchstart", (e) => {
    startX   = e.touches[0].clientX;
    startY   = e.touches[0].clientY;
    tahanoVo = true;
  }, { passive: true });

  element.addEventListener("touchend", (e) => {
    if (!tahanoVo || !jeOtevreno) return;
    tahanoVo = false;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Ignorovat vertikální swipe
    if (Math.abs(dy) > Math.abs(dx)) return;
    // Minimální délka swipe = 50px
    if (Math.abs(dx) < 50) return;

    if (dx < 0) prejitNa(aktualniIndex + 1);  // swipe doleva  → další
    else        prejitNa(aktualniIndex - 1);  // swipe doprava → předchozí
  }, { passive: true });
}


// ⏱️ LOG END 
    console.log(`%c🚀 [gallery-slider] Načteno za ${(performance.now() - __gallery_slider_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
