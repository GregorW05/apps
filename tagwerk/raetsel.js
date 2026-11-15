/* Rätsel des Tages für die App Wieser Ventures (seit 15.11.2026, Gregors Wunsch: jeden Morgen ein anderes kleines Denkspiel).
   Vier Spiele im Wechsel nach Datum: Schach (Tagesrätsel von lichess.org), Zahlenziel, Sudoku 6x6, Kopfrechnen wie im Case Interview.
   Alles läuft im Gerät, nur Schach lädt das Rätsel und chess.js aus dem Netz. Gelöste Tage stehen in localStorage "wv-raetsel". */
(function () {
  "use strict";
  const SPIELE = ["schach", "zahlen", "sudoku", "kopf"];
  const NAMEN = { schach: "Schach", zahlen: "Zahlenziel", sudoku: "Sudoku 6×6", kopf: "Kopfrechnen" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const lies = k => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const schreib = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const isoTag = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x.toISOString().slice(0, 10); };
  const heute = () => isoTag(new Date());
  const tagNr = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
  const fmt = n => Number(n).toLocaleString("de-AT", { maximumFractionDigits: 2 });
  function zufall(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const mische = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Gelöst und Serie ----------
  const KEY = "wv-raetsel";
  const gelöstHeute = () => ((lies(KEY) || {}).geloest || {})[heute()] || null;
  function merkGelöst(typ, extra) {
    const s = lies(KEY) || {}; s.geloest = s.geloest || {};
    s.geloest[heute()] = Object.assign({ typ, um: Date.now() }, extra || {});
    const k = Object.keys(s.geloest).sort(); while (k.length > 120) delete s.geloest[k.shift()];
    schreib(KEY, s);
  }
  function serie() {
    const g = (lies(KEY) || {}).geloest || {}; const d = new Date(); let n = 0;
    if (!g[isoTag(d)]) d.setDate(d.getDate() - 1);
    while (g[isoTag(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function erfolg(box, text) {
    const s = serie();
    const p = document.createElement("p"); p.className = "sp-ok"; p.setAttribute("role", "status");
    p.textContent = text + (s > 1 ? " · Serie " + s + " Tage" : "");
    box.appendChild(p);
  }
  const zeit = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  // ---------- Schach: Tagesrätsel von lichess.org ----------
  const FIG = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟", K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" };
  const FNAME = { k: "König", q: "Dame", r: "Turm", b: "Läufer", n: "Springer", p: "Bauer" };
  const THEMEN = { mateIn1: "Matt in 1", mateIn2: "Matt in 2", mateIn3: "Matt in 3", mateIn4: "Matt in 4", mateIn5: "Matt in 5", fork: "Gabel", pin: "Fesselung", skewer: "Spieß", sacrifice: "Opfer", endgame: "Endspiel", middlegame: "Mittelspiel", opening: "Eröffnung", discoveredAttack: "Abzug", deflection: "Ablenkung", promotion: "Umwandlung", hangingPiece: "Ungedeckte Figur", backRankMate: "Grundreihenmatt", crushing: "Entscheidender Vorteil", advantage: "Vorteil", short: "kurz", long: "lang" };
  function ladeSkript(src) { return new Promise((ok, f) => { if (window.Chess) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = f; document.head.appendChild(s); }); }

  async function schach(box, rnd, fertig) {
    box.innerHTML = '<p class="sp-meta">Lädt das Tagesrätsel von lichess.org …</p>';
    let p;
    try {
      const c = lies("wv-schach");
      if (c && c.tag === heute() && c.p) p = c.p;
      else {
        const r = await fetch("https://lichess.org/api/puzzle/daily", { headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error(r.status);
        p = await r.json(); schreib("wv-schach", { tag: heute(), p });
      }
      await ladeSkript("https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js");
    } catch (e) {
      box.innerHTML = '<p class="sp-meta">Schach braucht Internet, heute gibt es deshalb Zahlenziel.</p>';
      const b = document.createElement("div"); b.className = "sp"; box.appendChild(b); zahlen(b, rnd, fertig); return;
    }
    const c = new window.Chess();
    if (!c.load_pgn(p.game.pgn)) { c.reset(); p.game.pgn.split(/\s+/).forEach(m => { if (m && !/^\d+\./.test(m)) c.move(m, { sloppy: true }); }); }
    const start = c.fen(), lsg = p.puzzle.solution, ich = c.turn();
    const themen = (p.puzzle.themes || []).map(t => THEMEN[t]).filter(Boolean).slice(0, 2).join(", ");
    let schritt = 0, sel = null, zuletzt = null, fehler = 0, vorbei = false, gezeigt = false;
    const uci = m => m.from + m.to + (m.promotion || "");
    function zeichne(msg) {
      const felder = [];
      c.fen().split(" ")[0].split("/").forEach((r, ri) => { let fi = 0; for (const ch of r) { if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) felder.push({ sq: "abcdefgh"[fi++] + (8 - ri), f: null }); else felder.push({ sq: "abcdefgh"[fi++] + (8 - ri), f: ch }); } });
      const ord = ich === "w" ? felder : felder.slice().reverse();
      const ziele = sel ? c.moves({ square: sel, verbose: true }).map(m => m.to) : [];
      let h = '<p class="sp-text"><b>' + (ich === "w" ? "Weiß" : "Schwarz") + " am Zug.</b> Finde den besten Zug" + (themen ? " (" + esc(themen) + ")" : "") + '.</p><div class="brett" aria-label="Schachbrett">';
      ord.forEach(x => {
        const dunkel = ("abcdefgh".indexOf(x.sq[0]) + +x.sq[1]) % 2 === 1;
        const kl = [dunkel ? "d" : "h", sel === x.sq ? "sel" : "", ziele.includes(x.sq) ? "ziel" : "", zuletzt && zuletzt.includes(x.sq) ? "zuletzt" : ""].filter(Boolean).join(" ");
        const name = x.f ? (x.f === x.f.toUpperCase() ? "weißer " : "schwarzer ") + FNAME[x.f.toLowerCase()] : "leer";
        h += '<button type="button" data-sq="' + x.sq + '" class="' + kl + '" aria-label="' + x.sq + ", " + name + '">' + (x.f ? FIG[x.f] + "︎" : "") + "</button>";
      });
      h += '</div><p class="sp-meta" role="status">' + esc(msg || (vorbei ? "" : "Tippe eine Figur, dann das Zielfeld.")) + "</p>";
      h += '<div class="reihe"><button class="knopf leise" type="button" data-a="neu">Von vorn</button>' + (vorbei ? "" : '<button class="knopf leise" type="button" data-a="lsg">Lösung zeigen</button>') + "</div>";
      h += '<p class="sp-meta">Rätsel ' + esc(p.puzzle.id) + " von lichess.org, Wertung " + esc(p.puzzle.rating) + ".</p>";
      box.innerHTML = h;
      box.querySelectorAll(".brett button").forEach(b => b.onclick = () => klick(b.dataset.sq));
      box.querySelector('[data-a="neu"]').onclick = () => { c.load(start); schritt = 0; sel = null; zuletzt = null; vorbei = false; gezeigt = false; zeichne(); };
      const l = box.querySelector('[data-a="lsg"]'); if (l) l.onclick = zeigeLösung;
      if (vorbei && !gezeigt) erfolg(box, "Gelöst" + (fehler ? " mit " + fehler + (fehler === 1 ? " Fehlversuch" : " Fehlversuchen") : " ohne Fehler") + ".");
    }
    function gegner() {
      setTimeout(() => { const g = lsg[schritt]; const z = c.move({ from: g.slice(0, 2), to: g.slice(2, 4), promotion: g[4] }); if (z) zuletzt = [z.from, z.to]; schritt++; zeichne("Richtig. Dein nächster Zug."); }, 550);
    }
    function klick(sq) {
      if (vorbei) return;
      if (sel && sel !== sq) {
        const kand = c.moves({ square: sel, verbose: true }).filter(m => m.to === sq);
        if (kand.length) {
          const soll = lsg[schritt];
          const m = kand.find(x => uci(x) === soll) || kand.find(x => !x.promotion || x.promotion === "q");
          const z = c.move({ from: m.from, to: m.to, promotion: m.promotion });
          if (!(uci(z) === soll || c.in_checkmate())) { c.undo(); fehler++; sel = null; zeichne("Nicht ganz. Versuch es noch einmal."); return; }
          zuletzt = [z.from, z.to]; sel = null; schritt++;
          if (schritt >= lsg.length || c.in_checkmate()) { vorbei = true; if (!gezeigt) merkGelöst("schach", { fehler }); zeichne("Stark, das war's."); return; }
          zeichne("Richtig. Gegner antwortet …"); gegner(); return;
        }
      }
      const f = c.get(sq);
      sel = f && f.color === ich && sel !== sq ? sq : null; zeichne();
    }
    function zeigeLösung() {
      gezeigt = true; sel = null;
      const weiter = () => { if (schritt >= lsg.length) { vorbei = true; zeichne("Das war die Lösung. Morgen gibt es ein neues Rätsel."); return; } const g = lsg[schritt]; const z = c.move({ from: g.slice(0, 2), to: g.slice(2, 4), promotion: g[4] }); if (z) zuletzt = [z.from, z.to]; schritt++; zeichne("Lösung …"); setTimeout(weiter, 800); };
      weiter();
    }
    zeichne(fertig ? "Heute schon gelöst. Du kannst es noch einmal spielen." : "");
  }

  // ---------- Zahlenziel: aus sechs Zahlen mit + − × ÷ genau das Ziel treffen ----------
  function zahlenAufgabe(rnd) {
    for (let v = 0; v < 400; v++) {
      const g = [25, 50, 75, 100], k = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], pool = [];
      const nG = 1 + Math.floor(rnd() * 2);
      for (let i = 0; i < nG; i++) pool.push(g.splice(Math.floor(rnd() * g.length), 1)[0]);
      while (pool.length < 6) pool.push(k.splice(Math.floor(rnd() * k.length), 1)[0]);
      let w = mische(pool.map(x => ({ v: x, t: String(x) })), rnd).slice(0, 4 + Math.floor(rnd() * 2));
      while (w.length > 1) {
        const a = w.splice(Math.floor(rnd() * w.length), 1)[0], b = w.splice(Math.floor(rnd() * w.length), 1)[0], ops = [];
        ops.push({ v: a.v + b.v, t: "(" + a.t + " + " + b.t + ")" });
        if (a.v > 1 && b.v > 1 && a.v * b.v <= 3000) ops.push({ v: a.v * b.v, t: "(" + a.t + " × " + b.t + ")" }, { v: a.v * b.v, t: "(" + a.t + " × " + b.t + ")" });
        if (a.v !== b.v) { const [x, y] = a.v > b.v ? [a, b] : [b, a]; ops.push({ v: x.v - y.v, t: "(" + x.t + " − " + y.t + ")" }); }
        if (b.v > 1 && a.v % b.v === 0) ops.push({ v: a.v / b.v, t: "(" + a.t + " ÷ " + b.t + ")" });
        if (a.v > 1 && b.v % a.v === 0) ops.push({ v: b.v / a.v, t: "(" + b.t + " ÷ " + a.t + ")" });
        w.push(ops[Math.floor(rnd() * ops.length)]);
      }
      const z = w[0];
      if (z.v >= 101 && z.v <= 999 && z.v % 100 !== 0) return { zahlen: mische(pool, rnd), ziel: z.v, weg: z.t.replace(/^\((.*)\)$/, "$1") };
    }
    return { zahlen: [100, 25, 8, 6, 3, 2], ziel: 853, weg: "100 × 8 + 25 × 2 + 3" };
  }
  function zahlen(box, rnd, fertig) {
    const A = zahlenAufgabe(rnd);
    let kacheln, verlauf, sel, op, vorbei = false, gezeigt = false, start = 0;
    const neu = () => { kacheln = A.zahlen.map((v, i) => ({ v, id: "z" + i })); verlauf = []; sel = null; op = null; };
    neu();
    function zeichne(msg) {
      let h = '<p class="sp-text">Triff mit den Zahlen genau das Ziel. Jede Zahl höchstens einmal, nur + − × ÷ mit ganzen Zahlen.</p>';
      h += '<p class="sp-ziel">Ziel <b>' + A.ziel + "</b></p><div class=\"kacheln\">";
      kacheln.forEach(k => { h += '<button type="button" class="kachel' + (sel === k.id ? " sel" : "") + (k.v === A.ziel ? " treffer" : "") + '" data-k="' + k.id + '">' + fmt(k.v) + "</button>"; });
      h += '</div><div class="ops">' + ["+", "−", "×", "÷"].map(o => '<button type="button" data-o="' + o + '" class="' + (op === o ? "an" : "") + '" aria-pressed="' + (op === o) + '">' + o + "</button>").join("") + "</div>";
      h += '<p class="sp-meta" role="status">' + esc(msg || (vorbei ? "" : "Zahl, Rechenzeichen, Zahl.")) + "</p>";
      h += '<div class="reihe"><button class="knopf leise" type="button" data-a="zurueck">Zurück</button><button class="knopf leise" type="button" data-a="neu">Neu starten</button>' + (vorbei ? "" : '<button class="knopf leise" type="button" data-a="lsg">Lösung zeigen</button>') + "</div>";
      if (gezeigt) h += '<p class="sp-text">Ein Weg: <b>' + esc(A.weg) + " = " + A.ziel + "</b></p>";
      box.innerHTML = h;
      box.querySelectorAll(".kachel").forEach(b => b.onclick = () => wähle(b.dataset.k));
      box.querySelectorAll(".ops button").forEach(b => b.onclick = () => { if (sel && !vorbei) { op = op === b.dataset.o ? null : b.dataset.o; zeichne(); } });
      box.querySelector('[data-a="zurueck"]').onclick = () => { const v = verlauf.pop(); if (v) { kacheln = v; sel = null; op = null; vorbei = false; zeichne(); } };
      box.querySelector('[data-a="neu"]').onclick = () => { neu(); vorbei = false; zeichne(); };
      const l = box.querySelector('[data-a="lsg"]'); if (l) l.onclick = () => { gezeigt = true; vorbei = true; zeichne(); };
      if (vorbei && !gezeigt) erfolg(box, "Genau " + A.ziel + ". Gelöst" + (start ? " in " + zeit(Date.now() - start) : "") + ".");
    }
    function wähle(id) {
      if (vorbei) return;
      if (!start) start = Date.now();
      if (!sel || !op || sel === id) { sel = sel === id ? null : id; op = sel ? op : null; zeichne(); return; }
      const a = kacheln.find(k => k.id === sel), b = kacheln.find(k => k.id === id);
      let v = null;
      if (op === "+") v = a.v + b.v; if (op === "×") v = a.v * b.v;
      if (op === "−") v = a.v - b.v; if (op === "÷") v = b.v && a.v % b.v === 0 ? a.v / b.v : null;
      if (v === null || v <= 0) { const m = v === null ? "Das geht nicht ohne Rest." : "Nur positive Ergebnisse."; sel = null; op = null; zeichne(m); return; }
      verlauf.push(kacheln.map(k => Object.assign({}, k)));
      const neuK = { v, id: "r" + Date.now() };
      kacheln = kacheln.filter(k => k.id !== a.id && k.id !== b.id); kacheln.push(neuK);
      sel = neuK.id; op = null;
      if (v === A.ziel) { vorbei = true; sel = null; merkGelöst("zahlen", { sek: Math.round((Date.now() - start) / 1000) }); zeichne(); return; }
      zeichne(fmt(a.v) + " und " + fmt(b.v) + " ergibt " + fmt(v) + ".");
    }
    zeichne(fertig ? "Heute schon gelöst. Du kannst es noch einmal spielen." : "");
  }

  // ---------- Sudoku 6x6 (Kästen 2 x 3) ----------
  function sudokuAufgabe(rnd) {
    const ziffern = mische([1, 2, 3, 4, 5, 6], rnd);
    const reihen = mische([0, 1, 2], rnd).flatMap(b => mische([0, 1], rnd).map(r => b * 2 + r));
    const spalten = mische([0, 1], rnd).flatMap(s => mische([0, 1, 2], rnd).map(c => s * 3 + c));
    const lsg = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) lsg.push(ziffern[(3 * (reihen[r] % 2) + Math.floor(reihen[r] / 2) + spalten[c]) % 6]);
    const ok = (g, i, d) => { const r = Math.floor(i / 6), c = i % 6, br = r - r % 2, bc = c - c % 3; for (let k = 0; k < 6; k++) { if (g[r * 6 + k] === d || g[k * 6 + c] === d) return false; } for (let y = br; y < br + 2; y++) for (let x = bc; x < bc + 3; x++) if (g[y * 6 + x] === d) return false; return true; };
    const zähle = (g, max) => { const i = g.indexOf(0); if (i < 0) return 1; let n = 0; for (let d = 1; d <= 6 && n < max; d++) if (ok(g, i, d)) { g[i] = d; n += zähle(g, max - n); g[i] = 0; } return n; };
    const raetsel = lsg.slice();
    for (const i of mische([...Array(36).keys()], rnd)) { const alt = raetsel[i]; raetsel[i] = 0; if (raetsel.filter(Boolean).length < 12 || zähle(raetsel.slice(), 2) !== 1) raetsel[i] = alt; }
    return { lsg, raetsel };
  }
  function sudoku(box, rnd, fertig) {
    const A = sudokuAufgabe(rnd);
    const SKEY = "wv-sudoku"; const alt = lies(SKEY);
    let feld = alt && alt.tag === heute() && Array.isArray(alt.feld) ? alt.feld : A.raetsel.slice();
    let sel = null, vorbei = !!fertig, fehler = [], start = Date.now();
    function zeichne(msg) {
      let h = '<p class="sp-text">Jede Zeile, Spalte und jeder Kasten (2 × 3) enthält die Zahlen 1 bis 6 genau einmal.</p><div class="sudoku">';
      feld.forEach((v, i) => {
        const fix = A.raetsel[i] !== 0, r = Math.floor(i / 6), c = i % 6;
        const kl = [fix ? "fix" : "", sel === i ? "sel" : "", fehler.includes(i) ? "fehler" : "", c === 2 ? "rk" : "", r === 1 || r === 3 ? "uk" : ""].filter(Boolean).join(" ");
        h += '<button type="button" data-i="' + i + '" class="' + kl + '" aria-label="Zeile ' + (r + 1) + ", Spalte " + (c + 1) + (v ? ", " + v : ", leer") + '"' + (fix ? " disabled" : "") + ">" + (v || "") + "</button>";
      });
      h += '</div><div class="ziffern">' + [1, 2, 3, 4, 5, 6].map(d => '<button type="button" data-d="' + d + '">' + d + "</button>").join("") + '<button type="button" data-d="0" aria-label="Feld leeren">⌫</button></div>';
      h += '<p class="sp-meta" role="status">' + esc(msg || (vorbei ? "" : "Feld antippen, dann die Zahl.")) + "</p>";
      h += '<div class="reihe"><button class="knopf leise" type="button" data-a="neu">Leeren</button><button class="knopf leise" type="button" data-a="lsg">Lösung zeigen</button></div>';
      box.innerHTML = h;
      box.querySelectorAll(".sudoku button").forEach(b => b.onclick = () => { sel = +b.dataset.i; zeichne(); });
      box.querySelectorAll(".ziffern button").forEach(b => b.onclick = () => setze(+b.dataset.d));
      box.querySelector('[data-a="neu"]').onclick = () => { feld = A.raetsel.slice(); fehler = []; sel = null; schreib(SKEY, { tag: heute(), feld }); zeichne(); };
      box.querySelector('[data-a="lsg"]').onclick = () => { feld = A.lsg.slice(); fehler = []; sel = null; zeichne("Das ist die Lösung."); };
      if (vorbei && !msg && feld.join() === A.lsg.join()) erfolg(box, "Gelöst.");
    }
    function setze(d) {
      if (sel === null || A.raetsel[sel] !== 0) return;
      feld[sel] = d; fehler = []; schreib(SKEY, { tag: heute(), feld });
      if (!feld.includes(0)) {
        fehler = feld.map((v, i) => v !== A.lsg[i] ? i : -1).filter(i => i >= 0);
        if (!fehler.length) { if (!gelöstHeute()) merkGelöst("sudoku", { sek: Math.round((Date.now() - start) / 1000) }); vorbei = true; sel = null; zeichne(); return; }
        zeichne(fehler.length + (fehler.length === 1 ? " Feld stimmt" : " Felder stimmen") + " noch nicht."); return;
      }
      zeichne();
    }
    zeichne(fertig ? "Heute schon gelöst." : "");
  }

  // ---------- Kopfrechnen wie im Case Interview ----------
  function kopfAufgaben(rnd) {
    const pick = a => a[Math.floor(rnd() * a.length)];
    const T = [
      () => { const p = pick([5, 12, 15, 18, 25, 35, 40]), b = pick([240, 360, 480, 1200, 1600, 2400, 3600]); return { f: p + " % von " + fmt(b), a: p * b / 100 }; },
      () => { const a = pick([40, 60, 80, 120, 150, 200, 250]), g = pick([5, 10, 15, 20, 25, 30, 40]); return { f: "Umsatz steigt von " + fmt(a) + " auf " + fmt(a * (1 + g / 100)) + " Mio. €. Wachstum?", a: g, e: " %" }; },
      () => { const db = pick([20, 25, 40, 50, 60, 80]), st = pick([1500, 2000, 2500, 4000, 6000]); return { f: "Fixkosten " + fmt(db * st) + " €, Deckungsbeitrag " + db + " € je Stück. Break-even?", a: st, e: " Stück" }; },
      () => { const x = pick([6, 8, 9, 12, 18, 24]); return { f: "Faustregel 72: Welches jährliche Wachstum verdoppelt den Umsatz in " + x + " Jahren?", a: 72 / x, e: " %" }; },
      () => { const a = pick([12, 15, 18, 24, 25, 35, 45]), b = pick([12, 15, 16, 24, 40]); return { f: a + " × " + b, a: a * b }; },
      () => { const u = pick([1.2, 2.4, 3.6, 4.8, 6]), m = pick([5, 10, 15, 20, 25]); return { f: "Umsatz " + fmt(u) + " Mio. €, Marge " + m + " %. Gewinn?", a: Math.round(u * m * 10), e: " Tsd. €" }; },
      () => { const s = pick([10, 20, 25, 30]), p = pick([2, 3, 4, 5]); return { f: "Rund 9 Mio. Menschen in Österreich, " + s + " % kaufen einmal pro Woche einen Kaffee um " + p + " €. Umsatz pro Jahr?", a: Math.round(9 * s / 100 * 52 * p), e: " Mio. €" }; },
      () => { const z = pick([3, 4, 6, 8]), n = pick([120, 240, 360, 480, 720]); return { f: fmt(n) + " Mio. € auf " + z + " Jahre gleich verteilt. Pro Quartal?", a: n / z / 4, e: " Mio. €" }; }
    ];
    return mische(T, rnd).slice(0, 5).map(t => {
      const x = t();
      const falsch = new Set();
      [0.5, 2, 1.1, 0.9, 1.25, 0.8, 10, 0.1].forEach(k => { const v = Math.round(x.a * k * 100) / 100; if (v !== x.a && v > 0) falsch.add(v); });
      const opts = mische([x.a].concat(mische([...falsch], rnd).slice(0, 3)), rnd);
      return { f: x.f, a: x.a, e: x.e || "", opts };
    });
  }
  function kopf(box, rnd, fertig) {
    const Q = kopfAufgaben(rnd);
    let i = 0, richtig = 0, start = 0, gewählt = null, vorbei = false;
    function zeichne() {
      if (!start) {
        box.innerHTML = '<p class="sp-text">Fünf schnelle Aufgaben wie im Case Interview, Zeit läuft ab Start.</p>' + (fertig ? '<p class="sp-meta">Heute schon gespielt: ' + (fertig.richtig != null ? fertig.richtig + " von 5 richtig" : "erledigt") + (fertig.sek ? " in " + zeit(fertig.sek * 1000) : "") + ".</p>" : "") + '<button class="knopf" type="button" data-a="los">Start</button>';
        box.querySelector('[data-a="los"]').onclick = () => { start = Date.now(); zeichne(); }; return;
      }
      if (vorbei) {
        box.innerHTML = '<p class="sp-text"><b>' + richtig + " von 5 richtig</b> in " + zeit(Date.now() - start) + ".</p>" + '<button class="knopf leise" type="button" data-a="nochmal">Noch einmal</button>';
        box.querySelector('[data-a="nochmal"]').onclick = () => { i = 0; richtig = 0; start = 0; gewählt = null; vorbei = false; zeichne(); };
        erfolg(box, richtig === 5 ? "Alles richtig." : "Geschafft."); return;
      }
      const q = Q[i];
      let h = '<p class="sp-meta">Aufgabe ' + (i + 1) + " von 5</p><p class=\"sp-text\"><b>" + esc(q.f) + '</b></p><div class="wahl4">';
      q.opts.forEach((o, k) => { const kl = gewählt === null ? "" : o === q.a ? "richtig" : k === gewählt ? "falsch" : ""; h += '<button type="button" data-k="' + k + '" class="' + kl + '"' + (gewählt !== null ? " disabled" : "") + ">" + fmt(o) + esc(q.e) + "</button>"; });
      box.innerHTML = h + "</div>";
      box.querySelectorAll(".wahl4 button").forEach(b => b.onclick = () => {
        gewählt = +b.dataset.k; if (q.opts[gewählt] === q.a) richtig++; zeichne();
        setTimeout(() => { gewählt = null; i++; if (i >= Q.length) { vorbei = true; if (!gelöstHeute()) merkGelöst("kopf", { richtig, sek: Math.round((Date.now() - start) / 1000) }); } zeichne(); }, 900);
      });
    }
    zeichne();
  }

  // ---------- Start ----------
  let tag = null;
  function start(box, artEl) {
    tag = tagNr();
    const typ = SPIELE[tag % SPIELE.length];
    if (artEl) artEl.textContent = NAMEN[typ];
    box.innerHTML = "";
    const rnd = zufall(tag * 7919 + 17);
    ({ schach, zahlen, sudoku, kopf })[typ](box, rnd, gelöstHeute());
  }
  window.WVRaetsel = { start, neuerTag: () => tag !== tagNr() };
})();
