const __gallery_collapse_START = performance.now();

// gallery-collapse.js — LCARS Messenger | Galerie: SBALOVACÍ PANELY
// Samostatný modul — přidá rozbalovací/sbalovací tlačítko na:
//   1) lištu pro přidání obrázku   (.gallery-add-bar, statická v HTML)
//   2) lištu pro přidání videa     (#galleryVideoAddBar, z gallery-video.js)
//   3) lištu se záložkami sekcí    (#gallerySekceTaby, z gallery-sekce.js)
// U sekcí se panel navíc sám zavře po výběru záložky — šetří místo na mobilu.
// Nic nemění v žádném HTML souboru, jen obaluje existující elementy
// vlastním wrapperem.
//
// Připojit v index.html (doporučeně AŽ ZA gallery-video.js a gallery-sekce.js):
//   <link rel="stylesheet" href="gallery-collapse.css">
//   <script type="module" src="gallery-collapse.js"></script>
// (modul se inicializuje sám, nic dalšího volat netřeba)

function inicializovatSbalovaciPanely() {
  const sekceGalerie = document.getElementById("sekce-galerie");
  if (!sekceGalerie) return; // GALERIE sekce v HTML neexistuje — modul se neaktivuje

  // Každá část zvlášť v try/catch — chyba na jedné liště nezastaví ostatní
  bezpecne(() => {
    const obrazkovaBar = document.querySelector(".gallery-add-bar");
    if (obrazkovaBar) obalitSbalovacimPanelem(obrazkovaBar, "🖼️ PŘIDAT OBRÁZEK");
  });

  bezpecne(() => napojitAzExistuje("galleryVideoAddBar", "🎬 PŘIDAT VIDEO", sekceGalerie));
  bezpecne(() => napojitAzExistuje("gallerySekceTaby", "🗂️ SEKCE", sekceGalerie, /* autoZavrit */ true));
}

document.addEventListener("DOMContentLoaded", inicializovatSbalovaciPanely);

function bezpecne(fn) {
  try { fn(); } catch (err) { console.error("gallery-collapse chyba:", err); }
}

// ════════════════════════════════════════════════════════════════
//  POČKAT NA ELEMENT INJEKTOVANÝ JINÝM MODULEM (pokud tam ještě není)
//  Dvojitá pojistka: MutationObserver (rychlé) + záložní polling
//  (pro jistotu, kdyby element přišel mimo sledovaný uzel/pořadí)
// ════════════════════════════════════════════════════════════════
function napojitAzExistuje(id, popisek, sekceGalerie, autoZavrit = false) {
  const hned = document.getElementById(id);
  if (hned) {
    obalitSbalovacimPanelem(hned, popisek, autoZavrit);
    return;
  }

  const pozorovatel = new MutationObserver(() => {
    const el = document.getElementById(id);
    if (el) {
      obalitSbalovacimPanelem(el, popisek, autoZavrit);
      pozorovatel.disconnect();
      clearInterval(zaloha);
    }
  });
  pozorovatel.observe(sekceGalerie, { childList: true, subtree: true });

  let pokusy = 0;
  const zaloha = setInterval(() => {
    pokusy++;
    const el = document.getElementById(id);
    if (el) {
      obalitSbalovacimPanelem(el, popisek, autoZavrit);
      pozorovatel.disconnect();
      clearInterval(zaloha);
    } else if (pokusy > 40) { // ~10 s při 250 ms — pak už to vzdát
      clearInterval(zaloha);
      console.warn(`gallery-collapse: #${id} se nikdy neobjevil`);
    }
  }, 250);
}

// ════════════════════════════════════════════════════════════════
//  OBALIT LIŠTU SBALOVACÍM PANELEM S HLAVIČKOU
// ════════════════════════════════════════════════════════════════
function obalitSbalovacimPanelem(bar, popisek, autoZavritPoVyberu = false) {
  if (bar.closest(".gallery-collapse-wrap")) return; // už obalené — nedělat dvakrát

  const wrap = document.createElement("div");
  wrap.className = "gallery-collapse-wrap";

  const hlavicka = document.createElement("button");
  hlavicka.type = "button";
  hlavicka.className = "gallery-collapse-header";
  hlavicka.innerHTML = `<span>${popisek}</span><span class="gallery-collapse-sipka">▾</span>`;

  bar.parentNode.insertBefore(wrap, bar);
  wrap.appendChild(hlavicka);
  wrap.appendChild(bar);
  bar.classList.add("gallery-collapse-body");

  hlavicka.addEventListener("click", () => {
    wrap.classList.toggle("gallery-collapse-open");
  });

  if (autoZavritPoVyberu) {
    bar.addEventListener("click", (e) => {
      const zalozka = e.target.closest(".gallery-sekce-tab[data-tab]");
      if (zalozka) wrap.classList.remove("gallery-collapse-open");
    });
  }
}


// ⏱️ LOG END
console.log(`%c🚀 [gallery-collapse] Načteno za ${(performance.now() - __gallery_collapse_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
