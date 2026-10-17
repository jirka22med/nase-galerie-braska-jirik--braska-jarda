const __edit_START = performance.now();

// edit.js — LCARS Galerie | Editační zámek (mazání + přesun mezi sekcemi)
// Samostatný modul. Dokud se nezadá heslo, jsou skrytá tlačítka ✕ (smazat)
// a 🔀 (přesun do sekce). Stav odemčení je JEN v paměti stránky —
// žádný localStorage, po reloadu se vše zamkne zpět.
//
// Heslo se ověřuje přes SHA-256 (stejný princip jako auth2.js v klubovně).
// V kódu je jen otisk (hash), ne heslo samotné.
//
// POZOR: je to pojistka proti omylu, ne skutečné zabezpečení databáze.
// Pravidla Firestore pro "gallery" jsou otevřená, takže kdo umí volat
// Firestore z konzole, obejde i tohle.
//
// Připojit v index.html (AŽ ZA ostatní galerijní moduly):
//   <script type="module" src="edit.js"></script>

// ╔══════════════════════════════════════════════════════════════╗
// ║  HASH HESLA — SHA-256 otisk (aktuálně stejný jako v klubovně)║
// ║  Chceš jiné heslo? Vygeneruj hash (návod v odpovědi) a vlož  ║
// ╚══════════════════════════════════════════════════════════════╝
const HASH_HESLA = "98e33a569ea41213abbafb7c86f04af63f3e243ecf440dc0e2a027bf2581cb63";

const MAX_POKUSU   = 5;
const BLOKACE_MS   = 5 * 60 * 1000;   // 5 minut
const AUTO_ZAMEK_MS = 15 * 60 * 1000; // po 15 minutách se zámek vrátí sám

// ════════════════════════════════════════════════════════════════
//  STAV (jen v paměti)
// ════════════════════════════════════════════════════════════════
let odemceno     = false;
let pocetPokusu  = 0;
let zablokovanDo = null;
let autoZamekId  = null;

// Dostupné pro ostatní moduly, kdyby je někdy potřebovaly
window.__editOdemceno = () => odemceno;

// ════════════════════════════════════════════════════════════════
//  INICIALIZACE
// ════════════════════════════════════════════════════════════════
function inicializovatEdit() {
  injektovatStyl();
  injektovatUI();
  ochranitGlobalniMazani();
  nastavitStav(false);
}

document.addEventListener("DOMContentLoaded", inicializovatEdit);

// ════════════════════════════════════════════════════════════════
//  STYL — skrývá ✕ a 🔀, dokud je zamčeno (bez zásahu do tvého CSS)
// ════════════════════════════════════════════════════════════════
function injektovatStyl() {
  const style = document.createElement("style");
  style.id = "editStyl";
  style.textContent = `
    body:not(.edit-odemceno) .gallery-del-btn,
    body:not(.edit-odemceno) .gallery-presun-btn {
      display: none !important;
    }

    .edit-zamek-btn {
      background: transparent;
      border: 2px solid var(--lcars-primary);
      color: var(--lcars-primary);
      border-radius: 8px;
      font-size: 16px;
      padding: 6px 10px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .edit-zamek-btn:hover { background: var(--lcars-primary); color: #000; }
    body.edit-odemceno .edit-zamek-btn {
      border-color: var(--lcars-green, #66cc66);
      color: var(--lcars-green, #66cc66);
    }

    .edit-chyba {
      color: var(--lcars-red, #cc6666);
      font-family: 'Orbitron', sans-serif;
      font-size: 11px;
      padding: 6px 14px 0;
      min-height: 18px;
    }

    @media (max-width: 650px) {
      .edit-zamek-btn { font-size: 13px; padding: 5px 8px; }
    }
  `;
  document.head.appendChild(style);
}

// ════════════════════════════════════════════════════════════════
//  UI — tlačítko 🔒 v hlavičce + modál s heslem
// ════════════════════════════════════════════════════════════════
function injektovatUI() {
  // Tlačítko — vlevo od výběru uživatele v hlavičce
  const headerUser = document.querySelector(".header-user");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "editZamekBtn";
  btn.className = "edit-zamek-btn";
  btn.addEventListener("click", () => {
    if (odemceno) nastavStavZamek(false);
    else otevritModal();
  });

  if (headerUser) headerUser.insertBefore(btn, headerUser.firstChild);
  else document.body.appendChild(btn);

  // Modál
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "editModal";
  modal.innerHTML = `
    <div class="modal-box modal-small">
      <div class="modal-header">
        <span class="modal-title">ODEMKNOUT EDITACI</span>
        <button class="modal-close-btn" id="editModalClose">✕</button>
      </div>
      <p class="modal-hint">Zadej heslo pro mazání a přesun položek.</p>
      <input type="password" id="editHesloInput" class="lcars-input"
             placeholder="Heslo..." autocomplete="off" spellcheck="false">
      <div class="edit-chyba" id="editChyba"></div>
      <div class="modal-actions">
        <button class="btn-odeslat" id="editPotvrdit">ODEMKNOUT</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => { if (e.target === modal) zavritModal(); });
  document.getElementById("editModalClose").addEventListener("click", zavritModal);
  document.getElementById("editPotvrdit").addEventListener("click", potvrditHeslo);
  document.getElementById("editHesloInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") potvrditHeslo();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) zavritModal();
  });
}

function otevritModal() {
  const input = document.getElementById("editHesloInput");
  input.value = "";
  document.getElementById("editChyba").textContent = "";
  document.getElementById("editModal").classList.add("active");
  input.focus();
}

function zavritModal() {
  document.getElementById("editModal")?.classList.remove("active");
  document.getElementById("editHesloInput").value = "";
}

// ════════════════════════════════════════════════════════════════
//  OVĚŘENÍ HESLA
// ════════════════════════════════════════════════════════════════
async function potvrditHeslo() {
  const input   = document.getElementById("editHesloInput");
  const chybaEl = document.getElementById("editChyba");
  chybaEl.textContent = "";

  try {
    await overitHeslo(input.value);
    zavritModal();
    nastavStavZamek(true);
  } catch (err) {
    chybaEl.textContent = err.message;
    input.value = "";
  }
}

async function overitHeslo(heslo) {
  if (zablokovanDo && Date.now() < zablokovanDo) {
    const zbyva = Math.ceil((zablokovanDo - Date.now()) / 1000);
    throw new Error(`PŘÍSTUP BLOKOVÁN — zkus to za ${zbyva}s`);
  }

  if (!heslo || heslo.trim() === "") {
    throw new Error("Heslo nesmí být prázdné!");
  }

  const hash = await sha256hex(heslo.trim());

  if (hash === HASH_HESLA) {
    pocetPokusu = 0;
    zablokovanDo = null;
    return true;
  }

  pocetPokusu++;
  if (pocetPokusu >= MAX_POKUSU) {
    zablokovanDo = Date.now() + BLOKACE_MS;
    pocetPokusu = 0;
    throw new Error("Příliš mnoho pokusů — přístup blokován na 5 minut!");
  }

  const zbyva = MAX_POKUSU - pocetPokusu;
  throw new Error(`Nesprávné heslo — zbývá ${zbyva} pokus${zbyva === 1 ? "" : "ů"}`);
}

async function sha256hex(text) {
  const data    = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ════════════════════════════════════════════════════════════════
//  PŘEPÍNÁNÍ ZÁMKU
// ════════════════════════════════════════════════════════════════
function nastavStavZamek(novyStav) {
  nastavitStav(novyStav);

  clearTimeout(autoZamekId);
  if (novyStav) {
    autoZamekId = setTimeout(() => nastavitStav(false), AUTO_ZAMEK_MS);
  }
}

function nastavitStav(stav) {
  odemceno = stav;
  document.body.classList.toggle("edit-odemceno", stav);

  const btn = document.getElementById("editZamekBtn");
  if (btn) {
    btn.textContent = stav ? "🔓" : "🔒";
    btn.title = stav ? "Editace odemčena — klikni pro zamčení" : "Odemknout editaci (mazání, přesun)";
  }
}

// ════════════════════════════════════════════════════════════════
//  DRUHÁ POJISTKA — i kdyby se tlačítko ✕ nějak objevilo,
//  zamčené mazání se neprovede
// ════════════════════════════════════════════════════════════════
function ochranitGlobalniMazani() {
  const puvodni = window.__smazatGalerie;
  if (typeof puvodni !== "function") return;

  window.__smazatGalerie = (id) => {
    if (!odemceno) {
      alert("Editace je zamčená. Odemkni ji tlačítkem 🔒 v hlavičce.");
      return;
    }
    return puvodni(id);
  };
}


// ⏱️ LOG END
console.log(`%c🚀 [edit] Načteno za ${(performance.now() - __edit_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
