// Crea le tre guide di studio, una per file (server.js, record.js, index.html):
//   node "documentazione/sorgenti/genera_studio.js"
// Il codice mostrato nei PDF viene letto dai file VERI, con i numeri di riga di VS Code
// (le righe di solo commento sono tolte per leggere meglio). Se il codice cambia e i numeri
// di riga non tornano più, lo script si ferma e avvisa: vanno aggiornati gli intervalli qui sotto.
// (strumento di supporto per lo studio: NON fa parte dell'applicazione da consegnare)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const QUI = __dirname;
const DOC = path.join(QUI, '..');
const APP = path.join(QUI, '..', '..', 'acchiappa-il-quadrato');

const sorgente = {
  server: fs.readFileSync(path.join(APP, 'server.js'), 'utf8').split('\n'),
  record: fs.readFileSync(path.join(APP, 'record.js'), 'utf8').split('\n'),
  index: fs.readFileSync(path.join(APP, 'public', 'index.html'), 'utf8').split('\n'),
};

// controllo: le righe di riferimento devono essere ancora al loro posto
const ancore = {
  server: { 26: "const express = require('express');", 173: 'const ws_server = new Server({ server });', 438: 'function parametriInfinita(livello) {', 591: 'function indirizziRete() {' },
  record: { 28: 'function carica() {', 43: 'function aggiungi(classifica, risultato) {', 78: 'module.exports = { carica, aggiungi, elenco };' },
  index: { 133: '#quadrato {', 575: 'const webSocket = new WebSocket(', 718: 'webSocket.onmessage = (event) => {', 1153: 'function avviaBarraTempo(durata, colore) {' },
};
for (const f in ancore) {
  for (const riga in ancore[f]) {
    if (!(sorgente[f][riga - 1] || '').includes(ancore[f][riga])) {
      console.error(`ATTENZIONE: ${f}, riga ${riga} non contiene più "${ancore[f][riga]}". Il codice è cambiato: aggiorna i numeri di riga in genera_studio.js`);
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------- strumenti per il codice
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function evidenziaJS(riga) {
  const re = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\/\/.*$)|\b(const|let|var|function|return|if|else|for|in|of|new|try|catch|true|false|null|void)\b|\b(\d+(?:\.\d+)?)\b/g;
  let out = '', ultimo = 0, m;
  while ((m = re.exec(riga))) {
    out += esc(riga.slice(ultimo, m.index));
    if (m[1]) out += `<span class="t-s">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="t-c">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="t-k">${m[3]}</span>`;
    else out += `<span class="t-n">${m[4]}</span>`;
    ultimo = re.lastIndex;
  }
  return out + esc(riga.slice(ultimo));
}
function evidenziaHTML(riga) {
  const re = /(<!--.*?-->)|(<\/?)([a-zA-Z][a-zA-Z0-9-]*)|([a-zA-Z-]+)=("[^"]*")/g;
  let out = '', ultimo = 0, m;
  while ((m = re.exec(riga))) {
    out += esc(riga.slice(ultimo, m.index));
    if (m[1]) out += `<span class="t-c">${esc(m[1])}</span>`;
    else if (m[3]) out += `${esc(m[2])}<span class="t-k">${m[3]}</span>`;
    else out += `<span class="t-a">${m[4]}</span>=<span class="t-s">${esc(m[5])}</span>`;
    ultimo = re.lastIndex;
  }
  return out + esc(riga.slice(ultimo));
}
function evidenziaCSS(riga) {
  const m = riga.match(/^(\s*)([a-z-]+)(\s*:\s*)(.*)$/);
  if (m && !riga.trim().endsWith('{')) return `${m[1]}<span class="t-a">${m[2]}</span>${esc(m[3])}<span class="t-s">${esc(m[4])}</span>`;
  return `<span class="t-k">${esc(riga)}</span>`;
}
const evidenzia = { js: evidenziaJS, html: evidenziaHTML, css: evidenziaCSS };

// codice(file, [[da, a], [da, a]...], linguaggio): righe vere del file con i loro numeri
function codice(file, intervalli, lingua = 'js') {
  const pezzi = intervalli.map(([da, a]) => {
    const righe = [];
    for (let n = da; n <= a; n++) {
      const testo = sorgente[file][n - 1];
      if (/^\s*\/\//.test(testo) || /^\s*<!--.*-->\s*$/.test(testo)) continue; // solo commento
      if (!testo.trim() && (!righe.length || !righe[righe.length - 1].testo.trim())) continue; // righe vuote doppie
      righe.push({ n, testo });
    }
    while (righe.length && !righe[righe.length - 1].testo.trim()) righe.pop();
    return righe;
  });
  const tutte = pezzi.flat().filter((r) => r.testo.trim());
  const rientro = Math.min(...tutte.map((r) => r.testo.match(/^ */)[0].length));
  const html = pezzi.map((righe) => righe.map((r) =>
    `<div class="r"><span class="ln">${r.n}</span><span class="tx">${evidenzia[lingua](r.testo.slice(rientro)) || ' '}</span></div>`).join(''))
    .join('<div class="r salto"><span class="ln">⋮</span><span class="tx"></span></div>');
  return { html: `<div class="codice">${html}</div>`, righe: pezzi.flat().length };
}

const intervallo = (intervalli) => {
  const da = intervalli[0][0], a = intervalli[intervalli.length - 1][1];
  return da === a ? `riga ${da}` : `righe ${da}–${a}`;
};

// un blocco della guida: titolo, codice, spiegazione
function blocco({ titolo, file, righe, lingua, testo, ricorda }) {
  const c = righe ? codice(file, righe, lingua) : null;
  // titolo e codice restano sulla stessa pagina quando il codice è corto (niente titoli soli in fondo pagina)
  return `<section class="blocco">
    <div class="${c && c.righe <= 32 ? 'unito' : ''}">
    <h3>${titolo}${righe ? `<span class="righe">${intervallo(righe)}</span>` : ''}</h3>
    ${c ? c.html : ''}</div>
    <div class="spiega">${testo}</div>
    ${ricorda ? `<div class="ricorda"><b>Da ricordare</b>${ricorda}</div>` : ''}
  </section>`;
}

const tabella = (intestazioni, righe) => `<table><tr>${intestazioni.map((t) => `<th>${t}</th>`).join('')}</tr>
  ${righe.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;

const domande = (lista) => lista.map((d, i) => `<div class="domanda"><b class="q">${i + 1}. ${d[0]}</b>${d[1]}</div>`).join('');

// ---------------------------------------------------------------- stile e pagina
const STILE = `
  @page { size: A4; margin: 15mm 14mm 16mm; @bottom-right { content: counter(page) " / " counter(pages); font: 8pt -apple-system, sans-serif; color: #8a90a2; } }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Helvetica Neue", "Segoe UI", Roboto, sans-serif; color: #23262f; font-size: 10.2pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 26pt; margin: 0; letter-spacing: -0.5px; font-family: "SF Mono", Menlo, monospace; }
  h2 { font-size: 15pt; margin: 8mm 0 4mm; padding-bottom: 2mm; border-bottom: 2.5px solid #f9ca24; break-after: avoid; }
  h2.nuova { break-before: page; margin-top: 0; }
  h2 .num { display: inline-block; background: #1e2233; color: #f9ca24; border-radius: 1.5mm; padding: 0 2.2mm; margin-right: 2mm; font-size: 12pt; }
  h3 { font-size: 11.5pt; margin: 0 0 2.5mm; break-after: avoid; display: flex; align-items: baseline; gap: 3mm; }
  h3 .righe { margin-left: auto; font-size: 8.5pt; font-weight: 600; color: #5d6475; background: #f2f3f7; border: 1px solid #e3e5ec; border-radius: 1.2mm; padding: 0 1.8mm; white-space: nowrap; }
  p { margin: 0 0 2.2mm; }
  ul, ol { margin: 0 0 2.2mm; padding-left: 5.5mm; } li { margin-bottom: 1.2mm; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 8.7pt; background: #f2f3f7; border: 1px solid #e3e5ec; border-radius: 1mm; padding: 0 1mm; }
  .codice { background: #1e2233; color: #e8eaf6; border-radius: 2.5mm; padding: 2.8mm 3.5mm 2.8mm 1.5mm; margin: 0 0 3mm; font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 7.8pt; line-height: 1.55; }
  .codice .r { display: flex; break-inside: avoid; }
  .codice .ln { flex: none; width: 9mm; text-align: right; padding-right: 3mm; color: #6b7194; user-select: none; }
  .codice .tx { flex: 1; white-space: pre-wrap; word-break: break-all; }
  .codice .salto .ln { color: #f9ca24; }
  .t-k { color: #f9ca24; } .t-s { color: #9be29b; } .t-n { color: #ffab70; } .t-c { color: #7f86a8; font-style: italic; } .t-a { color: #8ecbff; }
  .copertina { background: #1e2233; color: #fff; border-radius: 4mm; padding: 11mm 11mm 9mm; margin-bottom: 6mm; }
  .copertina h1 span { color: #f9ca24; }
  .copertina .sotto { color: #f9ca24; font-size: 12.5pt; font-weight: 600; margin-top: 2mm; }
  .copertina .descr { color: #c8cbe0; margin-top: 3mm; font-size: 10.5pt; max-width: 150mm; }
  .copertina .chi { margin-top: 6mm; font-size: 9pt; color: #9aa0bd; }
  .box { background: #f6f7fb; border: 1px solid #e3e5ec; border-radius: 3mm; padding: 4mm 5mm; margin-bottom: 5mm; break-inside: avoid; }
  .box.giallo { background: #fff8db; border-color: #f3dd85; }
  .box > b:first-child { display: block; margin-bottom: 1.5mm; }
  .blocco { margin-bottom: 7mm; }
  .unito { break-inside: avoid; }
  .spiega { padding: 0 1mm; }
  .ricorda { break-inside: avoid; margin: 2mm 1mm 0; padding: 2.5mm 4mm; border-left: 4px solid #f9ca24; background: #fffbea; border-radius: 0 2mm 2mm 0; font-size: 9.6pt; }
  .ricorda b { display: block; font-size: 8.4pt; text-transform: uppercase; letter-spacing: 0.5px; color: #9a7500; margin-bottom: 0.8mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 1mm 0 4mm; }
  th, td { text-align: left; padding: 1.6mm 2.4mm; border-bottom: 1px solid #e3e5ec; vertical-align: top; }
  th { background: #f6f7fb; font-size: 8.2pt; text-transform: uppercase; color: #5d6475; letter-spacing: 0.3px; }
  tr { break-inside: avoid; }
  .domanda { break-inside: avoid; margin-bottom: 3.2mm; padding: 3mm 4mm; border: 1px solid #e3e5ec; border-left: 4px solid #f9ca24; border-radius: 2mm; }
  .domanda b.q { display: block; margin-bottom: 1mm; }
  .glossario { columns: 2; column-gap: 8mm; font-size: 9.4pt; }
  .glossario p { break-inside: avoid; margin-bottom: 2mm; }
  .chip { display: inline-block; min-width: 9mm; text-align: center; font-family: "SF Mono", Menlo, monospace; font-size: 8.6pt; padding: 0.6mm 1.8mm; margin: 0 0.8mm 0.8mm 0; border-radius: 1.2mm; background: #e9ebf3; border: 1px solid #d5d8e5; }
  .chip.nuovo { background: #f9ca24; border-color: #d9a900; font-weight: 700; }
  .chip.fuori { background: #fde2e0; border-color: #f0b4ae; text-decoration: line-through; color: #a33; }
  svg text { font-family: -apple-system, "Helvetica Neue", sans-serif; }
  .due { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
`;

const pagina = (titolo, corpo) => `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><title>${titolo}</title><style>${STILE}</style></head><body>${corpo}</body></html>`;

const copertina = (nome, sotto, descr) => `<div class="copertina">
  <h1>${nome}</h1>
  <div class="sotto">${sotto}</div>
  <div class="descr">${descr}</div>
  <div class="chi">Acchiappa il quadrato · Gentile · Guttadauro · Pavoni — 5A Informatica — TPSIT 2026/27 · Guida di studio</div>
</div>`;

const comeLeggere = `<div class="box giallo"><b>Come usare questa guida</b>
  Il codice è quello vero del progetto. I <b>numeri a sinistra</b> sono i numeri di riga che vedete in VS Code; le righe che contengono
  solo commenti sono state tolte, per questo ogni tanto un numero "salta". Il simbolo <b style="color:#b38600">⋮</b> indica che una parte del file è stata saltata.
  Per ogni pezzo c'è la spiegazione e, nei riquadri gialli, la frase da sapere dire all'interrogazione.</div>`;

// =====================================================================================
// 1) server.js
// =====================================================================================
function guidaServer() {
  const S = (righe, titolo, testo, ricorda) => blocco({ file: 'server', righe, titolo, testo, ricorda });

  // tabella della modalità infinita calcolata con la STESSA formula del server
  const livelli = [];
  for (let l = 1; l <= 13; l++) {
    const tempo = Math.max(380, Math.round(1500 * Math.pow(0.88, l - 1)));
    const dim = Math.max(34, 76 - (l - 1) * 4);
    livelli.push([`<b>${l}</b>`, `${tempo} ms`, `${dim} px`, `${40 * l}`, `${(l - 1) * 10 + 1}° – ${l * 10}°`]);
  }

  const corpo = `
${copertina('server<span>.js</span>', 'Il "cervello" del gioco: gira su Node.js',
  'Avvia il server HTTP con Express, ci aggancia il server WebSocket e contiene tutte le regole delle tre modalità. È l\'unico arbitro: decide dove compare il quadrato, chi prende il punto, quante vite restano e quando finisce la partita.')}
${comeLeggere}

<h2><span class="num">0</span>Il file in breve</h2>
<div class="box"><b>Cosa fa server.js, in cinque punti</b>
<ol>
  <li><b>Server HTTP (Express)</b> sulla porta 3000: invia la pagina <code>index.html</code>, la musica in streaming e due "API" in JSON.</li>
  <li><b>Server WebSocket (ws)</b> agganciato allo stesso server HTTP: tiene una connessione sempre aperta con ogni browser e scambia messaggi JSON in tempo reale.</li>
  <li><b>Sfida multiplayer</b>: un solo quadrato uguale per tutti, spostato da un <code>setInterval</code> ogni 1,2 s. Il primo click valido prende il punto; vince chi arriva a 10.</li>
  <li><b>Partite singole</b> (Difficoltà e Infinita): ogni client ha la sua partita salvata in <code>ws.partita</code>, con il suo timer <code>setTimeout</code>; se il tempo scade si perde una vita.</li>
  <li><b>Record</b>: a fine partita usa il nostro modulo <code>record.js</code> per salvare i 5 migliori punteggi e li manda a tutti.</li>
</ol></div>

<h3>Mappa del file</h3>
${tabella(['§', 'Sezione', 'Righe', 'Cosa contiene'], [
  ['1', 'Importazione dei moduli', '21–36', '<code>require</code> di express, ws, fs, path, os e del nostro record.js'],
  ['2', 'Costanti di configurazione', '39–82', 'porta, regole della sfida, tabella delle difficoltà, parametri della modalità infinita'],
  ['3', 'Stato della sfida', '85–97', 'variabili che cambiano: contatore degli id, quadrato della sfida, pausa'],
  ['4', 'Express (HTTP)', '100–165', 'middleware, rotte <code>/musica</code>, <code>/api/...</code>, 404 e <code>app.listen</code>'],
  ['5', 'WebSocket ed eventi', '168–280', 'eventi <code>connection</code>, <code>message</code>, <code>close</code>, <code>error</code>'],
  ['6', 'Ciclo della sfida', '283–296', 'il <code>setInterval</code> che sposta il quadrato'],
  ['7', 'Funzioni di invio e sfida', '299–396', 'invio a uno / a tutti / alla sfida, classifica, click, vittoria'],
  ['8', 'Partite singole', '399–583', 'creazione partita, formula di Tetris, timer, vite, game over'],
  ['9', 'Altre funzioni', '586–604', 'indirizzi IP del computer'],
])}
<p>Le sezioni sono segnate nel file con i commenti <code>// * 1.</code>, <code>// * 2.</code>… (in VS Code con l'estensione Better Comments appaiono colorate).</p>

<h2 class="nuova"><span class="num">1</span>Importazione dei moduli</h2>
${S([[26, 36]], 'require(): caricare i moduli', `
  <p><code>require()</code> carica un <b>modulo</b> (un pezzo di codice già pronto) e restituisce quello che il modulo esporta. Ci sono tre tipi di moduli:</p>
  ${tabella(['Tipo', 'Moduli', 'Da dove arrivano'], [
    ['<b>Esterni</b>', '<code>express</code>, <code>ws</code>', 'installati con <code>npm install</code> nella cartella <code>node_modules</code>; sono scritti nelle <code>dependencies</code> del <code>package.json</code>'],
    ['<b>Interni</b> (core)', '<code>fs</code>, <code>path</code>, <code>os</code>', 'fanno già parte di Node.js, non serve installarli'],
    ['<b>Nostri</b>', '<code>./record</code>', 'il file <code>record.js</code> del progetto; il <code>./</code> dice a Node "cercalo nella cartella di questo file", non in node_modules'],
  ])}
  <p><code>const { Server } = require('ws')</code> è una <b>destrutturazione</b>: il modulo <code>ws</code> esporta un oggetto con tante proprietà e noi ne prendiamo solo una, la classe <code>Server</code>.
  È come scrivere <code>const Server = require('ws').Server</code>.</p>
  <p>Usiamo <code>const</code> perché queste variabili non verranno mai riassegnate.</p>`,
  'Moduli esterni (npm, node_modules), interni (già in Node) e nostri (con ./). La destrutturazione { } prende solo una parte di ciò che il modulo esporta.')}

<h2><span class="num">2</span>Costanti di configurazione</h2>
${S([[45, 45]], 'La porta e le variabili d\'ambiente', `
  <p><code>process.env</code> è un oggetto con le <b>variabili d'ambiente</b> del sistema operativo. Se qualcuno avvia il server con <code>PORT=8080 npm start</code>, la porta sarà 8080.
  Se <code>PORT</code> non esiste vale <code>undefined</code>, e l'operatore <code>||</code> sceglie il valore di destra: <b>3000</b>.</p>
  <p>I nomi in MAIUSCOLO sono una convenzione: indicano costanti di configurazione, cioè le "regole" del gioco scritte in un punto solo.</p>`)}
${S([[49, 57]], 'Regole della sfida', `
  ${tabella(['Costante', 'Valore', 'Significato'], [
    ['<code>PUNTI_PER_VINCERE</code>', '10', 'punti per vincere la sfida'],
    ['<code>INTERVALLO_MS</code>', '1200', 'ogni 1,2 s il quadrato della sfida si sposta'],
    ['<code>DIMENSIONE_SFIDA</code>', '64', 'lato del quadrato della sfida in pixel'],
    ['<code>PAUSA_VITTORIA_MS</code>', '5000', 'pausa di 5 s dopo una vittoria'],
    ['<code>COLORI</code>', 'array di 8 colori', 'ogni giocatore riceve un colore in base al suo id'],
  ])}`)}
${S([[61, 68]], 'La tabella delle difficoltà (oggetto di oggetti)', `
  <p><code>DIFFICOLTA</code> è un <b>oggetto</b> che contiene altri tre oggetti. Si legge così: <code>DIFFICOLTA.facile.vite</code> vale 3, oppure con le parentesi quadre
  <code>DIFFICOLTA['facile'].vite</code> (forma utile quando il nome arriva da una variabile, come <code>DIFFICOLTA[difficolta]</code>).</p>
  ${tabella(['Difficoltà', 'Vite', 'Tempo per cliccare', 'Lato del quadrato'], [
    ['Facile', '3', '1400 ms (1,4 s)', '80 px'], ['Difficile', '2', '900 ms (0,9 s)', '56 px'], ['Impossibile', '1', '550 ms (0,55 s)', '38 px'],
  ])}
  <p>Lo stesso oggetto viene mandato al browser nel messaggio <code>benvenuto</code>: così i pulsanti del menu mostrano sempre i valori veri. Se cambiamo un numero qui, cambia anche la pagina.</p>`,
  'Una sola "fonte" dei dati: le regole stanno nel server e il client le riceve, non le ripete.')}
${S([[72, 82]], 'Modalità infinita e pausa tra i quadrati', `
  <p><code>VITE_INFINITA = 3</code>, si sale di livello ogni <code>QUADRATI_PER_LIVELLO = 10</code> quadrati (come le 10 righe di Tetris), <code>PUNTI_BASE = 40</code>
  (in Tetris una riga singola vale 40 × livello). <code>COLORI_LIVELLO</code> ha 10 colori, uno per livello. <code>PAUSA_QUADRATO_MS = 350</code> è la pausa tra un quadrato preso e il successivo.</p>`)}

<h2><span class="num">3</span>Stato della sfida</h2>
${S([[90, 97]], 'Le variabili che cambiano (let)', `
  <ul>
    <li><code>contatoreId</code>: cresce di 1 a ogni nuova connessione, così ogni client ha un id diverso (1, 2, 3…).</li>
    <li><code>quadrato</code>: il quadrato della sfida, condiviso da tutti. <code>numero</code> è progressivo, <code>x</code> e <code>y</code> sono percentuali (0–100), <code>preso</code> dice se qualcuno l'ha già cliccato.
    Parte con <code>preso: true</code> così nessun click vale prima che esca il primo quadrato.</li>
    <li><code>inPausa</code>: diventa <code>true</code> dopo una vittoria, per 5 secondi.</li>
  </ul>
  <p><code>record.carica()</code> chiama una funzione del nostro modulo, che legge dal file <code>record.json</code> i record delle partite precedenti. Si fa <b>una volta sola</b>, all'avvio.</p>
  <p>Queste variabili stanno nel server e non nel browser: è il motivo per cui il server è l'<b>arbitro</b>. Il codice del browser si può modificare (dagli strumenti per sviluppatori), quello del server no.</p>`,
  'let = variabile che cambia, const = valore fisso. Lo stato del gioco sta nel server, così nessuno può barare.')}

<h2 class="nuova"><span class="num">4</span>Express: il server HTTP</h2>
<p>Ogni richiesta HTTP che arriva attraversa i middleware <b>nell'ordine in cui sono scritti</b>, finché uno non risponde:</p>
<svg viewBox="0 0 700 110" width="100%" style="margin-bottom:4mm">
  <defs><marker id="fr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5d6475"/></marker></defs>
  ${[['Richiesta', 'GET /...', '#f6f7fb', '#23262f'], ['Logger', 'stampa e next()', '#1e2233', '#f9ca24'], ['express.static', 'file di public/', '#1e2233', '#f9ca24'], ['GET /musica', 'streaming audio', '#1e2233', '#f9ca24'], ['GET /api/...', 'risposta JSON', '#1e2233', '#f9ca24'], ['404', 'non trovata', '#fde2e0', '#a33']]
    .map((b, i) => `<g transform="translate(${i * 117},20)"><rect width="100" height="56" rx="9" fill="${b[2]}" stroke="#c9ccd8"/>
    <text x="50" y="25" text-anchor="middle" font-size="12" font-weight="700" fill="${b[3]}">${b[0]}</text>
    <text x="50" y="43" text-anchor="middle" font-size="10" fill="${i === 0 ? '#5d6475' : i === 5 ? '#a33' : '#c8cbe0'}">${b[1]}</text></g>
    ${i < 5 ? `<line x1="${i * 117 + 101}" y1="48" x2="${i * 117 + 116}" y2="48" stroke="#5d6475" stroke-width="1.6" marker-end="url(#fr)"/>` : ''}`).join('')}
  <text x="350" y="100" text-anchor="middle" font-size="11" fill="#5d6475">se un passaggio risponde, la richiesta si ferma lì; se nessuno risponde si arriva al 404</text>
</svg>
${S([[105, 113]], 'L\'applicazione e il middleware "logger"', `
  <p><code>express()</code> crea l'applicazione. <code>app.use(funzione)</code> registra un <b>middleware</b>: una funzione con tre parametri</p>
  <ul>
    <li><code>req</code> (request): la richiesta, con <code>req.method</code> (GET, POST…) e <code>req.url</code> (l'indirizzo chiesto);</li>
    <li><code>res</code> (response): la risposta da mandare;</li>
    <li><code>next</code>: funzione che passa la richiesta al middleware successivo.</li>
  </ul>
  <p>Questo middleware non risponde: stampa una riga nel terminale (es. <code>[HTTP] GET /musica</code>) e chiama <code>next()</code>. <b>Senza <code>next()</code> la richiesta resterebbe bloccata</b> e il browser aspetterebbe per sempre.</p>
  <p>Nel <code>console.log</code> c'è un <b>template literal</b>: testo tra backtick con <code>\${...}</code> per inserire il valore di una variabile.</p>`,
  'Middleware = funzione (req, res, next) eseguita per ogni richiesta, in ordine. next() passa al successivo.')}
${S([[117, 117]], 'File statici', `
  <p><code>express.static</code> è un middleware già pronto: se la richiesta corrisponde a un file della cartella <code>public</code>, lo invia. Quando il browser chiede <code>/</code>
  riceve <code>public/index.html</code>.</p>
  <p><code>__dirname</code> è la cartella in cui si trova <code>server.js</code>; <code>path.join</code> unisce i pezzi del percorso con il separatore giusto (<code>/</code> su Mac e Linux, <code>\\</code> su Windows).
  Così il server funziona anche se viene avviato da un'altra cartella.</p>`)}
${S([[120, 136]], 'Rotta GET /musica: streaming', `
  <p><code>app.get('/musica', ...)</code> crea una <b>rotta</b>: risponde solo alle richieste GET all'indirizzo <code>/musica</code>. La chiede il tag <code>&lt;audio src="/musica"&gt;</code> della pagina.</p>
  <ol>
    <li><code>fs.existsSync</code> controlla che il file esista;</li>
    <li><code>fs.statSync</code> legge le informazioni del file, tra cui <code>size</code> (dimensione in byte);</li>
    <li><code>res.writeHead(200, {...})</code> scrive il codice di stato <b>200 = OK</b> e le intestazioni: il tipo (<code>audio/wav</code>) e la lunghezza;</li>
    <li><code>fs.createReadStream(file).pipe(res)</code> apre uno <b>stream</b>: il file viene letto a pezzi (chunk) e ogni pezzo viene inviato subito, senza caricare tutto il file in memoria.</li>
  </ol>
  <p>Se il file non c'è: <code>res.status(404).send(...)</code>, codice <b>404 = non trovato</b>.</p>`,
  'Lo stream legge e invia il file a pezzi: pipe() collega lo stream di lettura alla risposta.')}
${S([[139, 148]], 'Rotte delle API in JSON', `
  <p>Due rotte che rispondono con dati in <b>JSON</b>: <code>res.json(oggetto)</code> trasforma l'oggetto in testo JSON e imposta da sola l'intestazione <code>Content-Type: application/json</code>.</p>
  <ul>
    <li><code>/api/classifica</code>: numero di connessi (<code>ws_server.clients.size</code>), punti per vincere e classifica della sfida;</li>
    <li><code>/api/record</code>: tutti i record salvati, presi da <code>record.elenco()</code>.</li>
  </ul>
  <p>Il gioco non le usa (usa il WebSocket): servono per controllare lo stato del server aprendo l'indirizzo nel browser, ad esempio <code>http://localhost:3000/api/record</code>.</p>
  <p>Nota: qui si usa <code>ws_server</code>, che è dichiarato più sotto (riga 173). Funziona perché la funzione della rotta viene eseguita <b>dopo</b>, quando arriva una richiesta, e a quel punto <code>ws_server</code> esiste già.</p>`)}
${S([[151, 165]], 'Il 404 finale e l\'avvio con listen()', `
  <p>L'ultimo <code>app.use</code> non ha un percorso, quindi riceve tutte le richieste arrivate fin qui: se siamo arrivati in fondo nessuno ha risposto, quindi la pagina non esiste → <b>404</b>.
  Per questo deve stare <b>per ultimo</b>.</p>
  <p><code>app.listen(PORTA, callback)</code> avvia il server HTTP. La <b>callback</b> viene eseguita quando il server è pronto e stampa gli indirizzi da aprire.
  <code>listen()</code> restituisce l'oggetto <b>server HTTP</b>, che salviamo in <code>server</code>: ci serve per agganciare il WebSocket.</p>
  <p><code>indirizziRete()</code> è definita in fondo al file (§ 9). Si può chiamare prima perché le dichiarazioni <code>function</code> vengono "sollevate" all'inizio (<b>hoisting</b>).</p>`,
  'Il middleware 404 va per ultimo. listen() avvia il server e restituisce il server HTTP a cui si aggancia il WebSocket.')}

<h2 class="nuova"><span class="num">5</span>Server WebSocket ed eventi</h2>
${S([[173, 173]], 'Agganciare il WebSocket al server HTTP', `
  <p><code>new Server({ server })</code> crea il server WebSocket usando il server HTTP di Express (<code>{ server }</code> è la forma breve di <code>{ server: server }</code>).
  Risultato: HTTP e WebSocket usano la <b>stessa porta 3000</b>.</p>
  <p>Come funziona: il browser manda una normale richiesta HTTP con l'intestazione <code>Upgrade: websocket</code> (<b>handshake</b>). Il server risponde
  <code>101 Switching Protocols</code> e da quel momento la connessione TCP resta aperta e diventa <b>bidirezionale</b> (full-duplex): anche il server può mandare dati quando vuole.</p>`,
  'HTTP: il client chiede e il server risponde, poi finisce. WebSocket: connessione sempre aperta, entrambi possono inviare in qualsiasi momento.')}
${S([[176, 196]], 'Evento connection: arriva un nuovo giocatore', `
  <p><code>ws_server.on('connection', (ws) => {...})</code> registra una funzione che scatta a ogni nuova connessione. Il parametro <code>ws</code> è l'oggetto che rappresenta <b>quel</b> client:
  ogni browser ha il suo <code>ws</code>.</p>
  <p>In JavaScript si possono aggiungere proprietà a un oggetto in qualsiasi momento: le usiamo per ricordare i dati del giocatore direttamente dentro <code>ws</code>.</p>
  ${tabella(['Proprietà', 'Valore iniziale', 'A cosa serve'], [
    ['<code>ws.id</code>', 'contatoreId', 'identifica il giocatore'],
    ['<code>ws.colore</code>', '<code>COLORI[(id − 1) % 8]</code>', 'colore del giocatore; l\'operatore <code>%</code> (resto) fa ricominciare l\'array: il 9° giocatore riprende il 1° colore'],
    ['<code>ws.nome</code>', '<code>null</code>', 'nome scelto (null = non ancora scelto)'],
    ['<code>ws.modalita</code>', '<code>null</code>', '<code>null</code> = nel menu, poi <code>\'sfida\'</code>, <code>\'difficolta\'</code> o <code>\'infinita\'</code>'],
    ['<code>ws.punti</code>', '0', 'punti nella sfida'],
    ['<code>ws.partita</code>', '<code>null</code>', 'la partita singola in corso (§ 8)'],
  ])}
  <p>Poi mandiamo <b>solo a lui</b> il <code>benvenuto</code> (id, colore, punti per vincere, tabella delle difficoltà) e i <code>record</code>; a <b>tutti</b> la classifica, così vedono che i connessi sono aumentati.</p>`)}
${S([[199, 218]], 'Evento message: lettura sicura del messaggio e CASO 1 (nome)', `
  <p><code>ws.on('message', (dati) => {...})</code> scatta quando <b>questo</b> client invia qualcosa. I dati arrivano come testo; <code>JSON.parse</code> li trasforma in oggetto.</p>
  <p><b>try/catch</b>: se il testo non è JSON valido, <code>JSON.parse</code> lancerebbe un errore che, non gestito, <b>farebbe crollare tutto il server</b> (per tutti i giocatori).
  Con <code>catch</code> stampiamo un avviso e con <code>return</code> ignoriamo il messaggio.</p>
  <p>Ogni messaggio ha un campo <code>tipo</code> che dice cosa fare. <b>Caso "nome"</b>: puliamo il nome ricevuto</p>
  <ul>
    <li><code>String()</code> lo converte in testo (nel caso arrivi un numero o altro);</li>
    <li><code>trim()</code> toglie gli spazi all'inizio e alla fine;</li>
    <li><code>substring(0, 15)</code> tiene al massimo 15 caratteri (anche se qualcuno aggira il <code>maxlength</code> della pagina).</li>
  </ul>
  <p>Se il nome è vuoto (<code>''</code> è "falso"), <code>||</code> sceglie <code>Giocatore 3</code> (con l'id).</p>`,
  'Mai fidarsi dei dati che arrivano dal client: si controllano e si puliscono sul server.')}
${S([[221, 245]], 'CASO 2: scelta della modalità', `
  <ol>
    <li><code>if (!ws.nome) return;</code> senza nome non si gioca.</li>
    <li><code>fermaPartita(ws)</code>: se stava già giocando da solo, fermiamo la vecchia partita e il suo timer.</li>
    <li>In base a <code>msg.modalita</code>:
      <ul>
        <li><b>sfida</b>: <code>ws.modalita = 'sfida'</code> e punti a zero. Da ora riceve il quadrato condiviso.</li>
        <li><b>difficolta</b>: solo se <code>msg.difficolta</code> è una delle chiavi previste. <code>Object.keys(DIFFICOLTA)</code> restituisce l'array
        <code>['facile', 'difficile', 'impossibile']</code> e <code>includes</code> controlla che il valore ricevuto ci sia. Così un valore inventato (es. <code>'toString'</code>) viene scartato.</li>
        <li><b>infinita</b>: parte la partita singola senza difficoltà (<code>null</code>).</li>
      </ul></li>
    <li><code>inviaClassifica()</code>: la classifica della sfida cambia (qualcuno è entrato o uscito), la mandiamo a tutti.</li>
  </ol>
  <p>Nel <code>console.log</code> c'è un <b>operatore ternario</b> <code>condizione ? A : B</code>: se c'è una difficoltà la aggiunge tra parentesi, altrimenti aggiunge una stringa vuota.</p>`)}
${S([[248, 263]], 'CASO 3 (click) e CASO 4 (esci)', `
  <p><b>click</b>: il messaggio contiene solo il <code>numero</code> del quadrato cliccato. Il server lo smista alla funzione giusta: <code>clickSfida</code> se il giocatore è nella sfida, altrimenti <code>clickSingolo</code>.
  Sono quelle funzioni a decidere se il click vale.</p>
  <p><b>esci</b>: il giocatore ha premuto Menu. Fermiamo la partita singola, rimettiamo <code>ws.modalita = null</code> e aggiorniamo la classifica (se era nella sfida, sparisce dalla lista).</p>`)}
${S([[266, 279]], 'Eventi close ed error', `
  <p><b>close</b> scatta quando il client si disconnette (pagina chiusa, ricaricata, rete persa). Due cose importanti:</p>
  <ul>
    <li><code>fermaPartita(ws)</code>: annulla il timer della sua partita singola. Senza questa riga il <code>setTimeout</code> continuerebbe a scattare per un client che non c'è più.</li>
    <li><code>inviaClassifica()</code>: chi resta vede i connessi diminuire. Il modulo <code>ws</code> ha già tolto il client da <code>ws_server.clients</code>, quindi non compare più.</li>
  </ul>
  <p><b>error</b>: se non gestissimo l'evento di errore, Node lo considererebbe un errore non gestito e potrebbe fermare il server. Gestendolo, stampiamo solo il messaggio.</p>`,
  'Quattro eventi: connection (sul server), message, close, error (su ogni client).')}

<h2 class="nuova"><span class="num">6</span>Il ciclo della sfida</h2>
${S([[288, 296]], 'setInterval: il server "spinge" il quadrato', `
  <p><code>setInterval(funzione, 1200)</code> esegue la funzione ogni 1200 ms, per sempre (finché il server è acceso). Ogni volta:</p>
  <ul>
    <li>se siamo in pausa dopo una vittoria → <code>return</code>, non fa niente;</li>
    <li>se nessuno sta giocando la sfida (<code>giocatoriSfida().length === 0</code>) → <code>return</code>, è inutile spostare il quadrato;</li>
    <li>altrimenti chiama <code>nuovaPosizione()</code>, che sceglie un posto casuale e lo invia ai giocatori della sfida.</li>
  </ul>
  <p>Questo è il vantaggio del WebSocket: è il <b>server</b> che decide quando mandare i dati (push), senza che il browser debba chiedere.</p>`,
  'setInterval = ripete ogni N ms. setTimeout = esegue una volta sola dopo N ms.')}

<h2><span class="num">7</span>Funzioni di invio e della sfida</h2>
${S([[304, 318]], 'Inviare a uno e inviare a tutti (broadcast)', `
  <p><code>inviaA(ws, messaggio)</code>: invia a <b>un solo</b> client. Prima controlla <code>ws.readyState === ws.OPEN</code>: si invia solo se la connessione è aperta
  (potrebbe essere in chiusura). <code>JSON.stringify</code> trasforma l'oggetto in testo, perché sul WebSocket viaggia testo.</p>
  <p><code>inviaATutti(messaggio)</code>: <b>broadcast</b>. <code>ws_server.clients</code> contiene tutti i client connessi; con <code>forEach</code> li scorriamo e inviamo a ognuno.
  Il testo JSON viene creato <b>una sola volta</b> prima del ciclo: è più efficiente che rifarlo per ogni client.</p>`)}
${S([[321, 330]], 'Inviare solo a chi gioca la sfida', `
  <p><code>ws_server.clients</code> è un <b>Set</b> (un insieme senza doppioni), che non ha il metodo <code>filter</code>. <code>Array.from</code> lo trasforma in array, poi
  <code>filter</code> tiene solo i client con <code>modalita === 'sfida'</code>.</p>
  <p><code>inviaASfida</code> usa questo array: così chi è nel menu o sta giocando da solo <b>non riceve</b> il quadrato della sfida.</p>`,
  'Tre modi di inviare: a uno (inviaA), a tutti (inviaATutti), a un gruppo (inviaASfida, con filter).')}
${S([[333, 345]], 'La classifica della sfida', `
  <p><code>map</code> trasforma ogni client in un oggetto semplice con solo i dati utili (id, nome, colore, punti): non possiamo mandare l'intero oggetto <code>ws</code>, che contiene la connessione.</p>
  <p><code>sort((a, b) => b.punti - a.punti)</code> ordina con una <b>funzione di confronto</b>: se il risultato è positivo <code>b</code> va prima di <code>a</code>. Quindi chi ha più punti va in cima (ordine <b>decrescente</b>).</p>
  <p><code>inviaClassifica</code> manda a tutti la lista e il numero di connessi (<code>size</code> = quanti elementi ha il Set).</p>`)}
${S([[348, 359]], 'Nuova posizione del quadrato', `
  <p><code>Math.random()</code> dà un numero decimale tra 0 (compreso) e 1 (escluso). Moltiplicato per 101 va da 0 a 100,99…; <code>Math.floor</code> arrotonda per difetto → un intero da <b>0 a 100</b>.</p>
  <p>Il server manda una <b>percentuale</b> e non dei pixel perché ogni giocatore ha uno schermo diverso: sarà il browser a trasformarla in pixel in base alla grandezza del suo campo.</p>
  <p><code>quadrato.numero++</code> dà un numero nuovo a ogni quadrato: se arriva un click in ritardo riferito al quadrato vecchio, il numero non corrisponde e il click viene scartato.</p>
  <p><code>colore: null</code> significa "usa il giallo standard".</p>`)}
${S([[362, 383]], 'Il click nella sfida: chi arriva primo', `
  <p>La prima riga è una <b>guardia</b>: il click non vale se siamo in pausa, se il quadrato è già stato preso o se il numero è di un quadrato vecchio. In quei casi <code>return</code>.</p>
  <p>Se il click vale: <code>quadrato.preso = true</code> e +1 punto. <b>Perché vince davvero il più veloce?</b> Node.js esegue il codice su un solo thread con l'<b>event loop</b>:
  i messaggi vengono gestiti uno alla volta, in ordine di arrivo. Il primo click mette <code>preso = true</code>; quando il server gestisce il secondo click, trova già <code>preso</code> e lo scarta.</p>
  <p>Poi avvisa tutti i giocatori della sfida (<code>preso</code>, con nome e colore di chi l'ha preso) e manda la classifica. Se il giocatore arriva a 10 punti:</p>
  <ul>
    <li><code>inPausa = true</code> (il <code>setInterval</code> smette di muovere il quadrato);</li>
    <li>messaggio <code>vittoria</code> con i secondi di pausa (5000 / 1000 = 5);</li>
    <li><code>setTimeout(nuovaSfida, 5000)</code>: dopo 5 secondi riparte. Attenzione: si passa <code>nuovaSfida</code> <b>senza parentesi</b>, cioè la funzione stessa, che verrà chiamata più tardi. Con <code>nuovaSfida()</code> verrebbe eseguita subito.</li>
  </ul>`,
  'Il primo click mette quadrato.preso = true: grazie all\'event loop i click successivi lo trovano già preso e vengono ignorati.')}
${S([[386, 396]], 'Nuova sfida', `
  <p>Azzera i punti di tutti i giocatori della sfida, toglie la pausa, manda <code>nuova_partita</code> (il browser chiude la schermata di vittoria) e la classifica azzerata.
  Dal prossimo giro del <code>setInterval</code> il quadrato ricomincia a muoversi.</p>`)}

<h2 class="nuova"><span class="num">8</span>Partite singole: Difficoltà e Infinita</h2>
<p>Qui ogni giocatore ha <b>la sua partita</b>, indipendente dagli altri. Il ciclo di gioco non usa <code>setInterval</code> ma una catena di <code>setTimeout</code>:</p>
<svg viewBox="0 0 700 215" width="100%" style="margin-bottom:4mm">
  <defs><marker id="fp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5d6475"/></marker></defs>
  <rect x="10" y="80" width="140" height="52" rx="9" fill="#f6f7fb" stroke="#c9ccd8"/><text x="80" y="102" text-anchor="middle" font-size="12" font-weight="700">iniziaPartitaSingola</text><text x="80" y="119" text-anchor="middle" font-size="10" fill="#5d6475">crea ws.partita</text>
  <line x1="151" y1="106" x2="248" y2="106" stroke="#5d6475" stroke-width="1.6" marker-end="url(#fp)"/><text x="200" y="98" text-anchor="middle" font-size="10" fill="#5d6475">800 ms</text>
  <rect x="250" y="80" width="150" height="52" rx="9" fill="#1e2233"/><text x="325" y="102" text-anchor="middle" font-size="12" font-weight="700" fill="#f9ca24">prossimoQuadrato</text><text x="325" y="119" text-anchor="middle" font-size="10" fill="#c8cbe0">invia + setTimeout(durata)</text>
  <rect x="500" y="10" width="190" height="52" rx="9" fill="#e6f7ec" stroke="#9fd8b3"/><text x="595" y="32" text-anchor="middle" font-size="12" font-weight="700" fill="#1e7a44">clickSingolo</text><text x="595" y="49" text-anchor="middle" font-size="10" fill="#1e7a44">clearTimeout, + punti</text>
  <rect x="500" y="150" width="190" height="52" rx="9" fill="#fde2e0" stroke="#f0b4ae"/><text x="595" y="172" text-anchor="middle" font-size="12" font-weight="700" fill="#a33">quadratoScaduto</text><text x="595" y="189" text-anchor="middle" font-size="10" fill="#a33">− 1 vita</text>
  <line x1="401" y1="96" x2="498" y2="42" stroke="#1e7a44" stroke-width="1.6" marker-end="url(#fp)"/><text x="455" y="84" font-size="10" fill="#1e7a44">click in tempo</text>
  <line x1="401" y1="118" x2="498" y2="170" stroke="#a33" stroke-width="1.6" marker-end="url(#fp)"/><text x="455" y="136" font-size="10" fill="#a33">timer scaduto</text>
  <path d="M500 26 C 440 0, 360 20, 335 78" fill="none" stroke="#5d6475" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#fp)"/><text x="300" y="30" font-size="10" fill="#5d6475">350 ms</text>
  <path d="M500 188 C 440 212, 360 196, 335 134" fill="none" stroke="#5d6475" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#fp)"/><text x="340" y="210" font-size="10" fill="#5d6475">700 ms (se restano vite)</text>
  <text x="595" y="212" text-anchor="middle" font-size="10" font-weight="700" fill="#a33">0 vite → finePartita</text>
</svg>
${S([[404, 435]], 'Creare la partita: ws.partita', `
  <p>L'<b>operatore ternario</b> <code>condizione ? A : B</code> sceglie un valore: <code>conf</code> è la configurazione della difficoltà (solo in modalità difficoltà, altrimenti <code>null</code>);
  <code>vite</code> sono quelle della difficoltà oppure le 3 della modalità infinita.</p>
  <p>Lo stato della partita viene salvato <b>dentro l'oggetto ws del client</b>: per questo ogni giocatore ha la sua partita separata.</p>
  ${tabella(['Campo', 'Significato'], [
    ['<code>modalita</code>, <code>difficolta</code>', 'tipo di partita (<code>difficolta</code> è <code>null</code> nell\'infinita)'],
    ['<code>vite</code>, <code>viteMax</code>', 'vite rimaste e vite iniziali (per disegnare anche i cuori vuoti)'],
    ['<code>punti</code>, <code>presi</code>, <code>livello</code>', 'punteggio, quadrati presi, livello attuale'],
    ['<code>numero</code>', 'numero del quadrato attuale (per scartare i click vecchi)'],
    ['<code>preso</code>', '<code>true</code> quando il quadrato è "chiuso" (preso o scaduto)'],
    ['<code>timer</code>', 'il <code>setTimeout</code> attivo, salvato per poterlo annullare con <code>clearTimeout</code>'],
    ['<code>finita</code>', 'diventa <code>true</code> al game over'],
  ])}
  <p>Poi invia lo stato iniziale e fa partire il primo quadrato dopo 800 ms. <code>() => prossimoQuadrato(ws)</code> è una funzione freccia: serve perché dobbiamo passare anche il parametro <code>ws</code>.</p>`,
  'Ogni client ha la sua partita in ws.partita, con il suo timer: le partite singole non si disturbano tra loro.')}
${S([[438, 447]], 'La formula della modalità infinita', `
  <ul>
    <li><b>Tempo</b>: <code>1500 × 0,88<sup>livello − 1</sup></code> ms. <code>Math.pow(0.88, n)</code> = 0,88 elevato alla n: a ogni livello il tempo si riduce del 12%. <code>Math.round</code> arrotonda, <code>Math.max(380, ...)</code> impedisce di scendere sotto 380 ms.</li>
    <li><b>Dimensione</b>: <code>76 − 4 × (livello − 1)</code> px, mai sotto 34 px.</li>
    <li><b>Colore</b>: <code>COLORI_LIVELLO[(livello − 1) % 10]</code>; dal livello 11 i colori ricominciano.</li>
  </ul>
  <p><code>return { tempo, dimensione, colore }</code> è la forma breve di <code>{ tempo: tempo, dimensione: dimensione, colore: colore }</code>. Valori calcolati con la stessa formula:</p>
  ${tabella(['Livello', 'Tempo per cliccare', 'Lato', 'Punti a quadrato', 'Quadrati del livello'], livelli)}`)}
${S([[450, 478]], 'prossimoQuadrato: mandare il quadrato e far partire il tempo', `
  <ol>
    <li>Se la partita non c'è più (<code>!p</code>) o è finita → <code>return</code>. È un controllo di sicurezza: il timer potrebbe scattare dopo che il giocatore è uscito.</li>
    <li><code>param</code>: i parametri vengono dalla tabella <code>DIFFICOLTA</code> oppure da <code>parametriInfinita(livello)</code>. Entrambi hanno <code>tempo</code> e <code>dimensione</code>.</li>
    <li>Nuovo numero, quadrato "aperto" (<code>preso = false</code>).</li>
    <li>Invia <b>solo a questo client</b> il quadrato con posizione casuale, dimensione, colore e <code>durata</code> (il browser la usa per la barra del tempo).
    Nelle difficoltà <code>param.colore</code> non esiste (<code>undefined</code>), quindi <code>|| null</code> manda <code>null</code> = giallo.</li>
    <li><code>p.timer = setTimeout(() => quadratoScaduto(ws), param.tempo)</code>: se nessuno annulla questo timer prima, il quadrato scade.</li>
  </ol>`,
  'Il server manda il quadrato e avvia un setTimeout lungo quanto il tempo concesso. Se arriva il click prima, il timer viene annullato.')}
${S([[481, 497]], 'quadratoScaduto: si perde una vita', `
  <p>Guardia: se il quadrato è già stato preso o la partita è finita non fa niente. Altrimenti chiude il quadrato (<code>preso = true</code>, così un click arrivato in ritardo non vale più),
  toglie una vita con <code>p.vite--</code> e invia <code>mancato</code> e lo stato aggiornato.</p>
  <p>Se le vite arrivano a 0 → <code>finePartita</code>. Altrimenti il prossimo quadrato arriva dopo <code>350 × 2 = 700 ms</code>, una pausa un po' più lunga per riprendersi.</p>`)}
${S([[500, 529]], 'clickSingolo: il click in tempo e la formula di Tetris', `
  <p>Guardia con quattro condizioni unite da <code>||</code> (basta che una sia vera per uscire): niente partita, partita finita, quadrato già chiuso, numero sbagliato.</p>
  <p>Se il click vale: chiude il quadrato e <b><code>clearTimeout(p.timer)</code></b> annulla il timer, così <code>quadratoScaduto</code> non scatterà e non si perde la vita.</p>
  <p><b>Punti</b>: in modalità difficoltà ogni quadrato vale 1. In modalità infinita:</p>
  <ul>
    <li><code>guadagno = 40 × livello</code>, calcolato con il livello <b>prima</b> di aggiornarlo;</li>
    <li><code>livello = Math.floor(presi / 10) + 1</code>: con 0–9 quadrati presi livello 1, con 10–19 livello 2, e così via.</li>
  </ul>
  <p>Esempio: 25 quadrati presi = 10 × 40 + 10 × 80 + 5 × 120 = <b>1800 punti</b>, livello 3.</p>
  <p>Confrontando <code>livelloPrima</code> con il nuovo livello capisce se si è saliti: in quel caso manda il messaggio <code>livello</code> con il colore nuovo. Infine stato aggiornato e prossimo quadrato dopo 350 ms.</p>`,
  'clearTimeout annulla il timer che avrebbe tolto la vita. Livello = floor(presi / 10) + 1, punti = 40 × livello.')}
${S([[532, 552]], 'finePartita: game over e record', `
  <p>Segna la partita come finita e annulla il timer. Poi sceglie in quale classifica dei record va il risultato: <code>'infinita'</code> oppure il nome della difficoltà (<code>'facile'</code>…).</p>
  <p><code>record.aggiungi(classifica, risultato)</code> è una funzione del nostro modulo: restituisce la <b>posizione</b> raggiunta (0 = primo posto) oppure <b>−1</b> se non è un record.
  <code>new Date().toLocaleDateString('it-IT')</code> scrive la data di oggi nel formato italiano (es. 25/11/2026).</p>
  <p>Al giocatore arriva <code>game_over</code> con il riepilogo e la posizione. Se è un nuovo record (<code>posizione >= 0</code>), la lista aggiornata va a <b>tutti</b> con <code>inviaATutti</code>: anche gli altri vedono il record comparire in tempo reale.</p>`)}
${S([[555, 583]], 'fermaPartita e inviaStato', `
  <p><b>fermaPartita</b>: se c'è una partita, annulla il timer e la cancella (<code>ws.partita = null</code>). Viene chiamata quando si cambia modalità, si torna al menu o ci si disconnette.</p>
  <p><b>inviaStato</b>: manda al client tutti i dati da mostrare nel pannello laterale. Il campo <code>mancanti</code> usa il resto della divisione:
  <code>10 − (presi % 10)</code>. Esempio: 23 presi → 23 % 10 = 3 → mancano 7 quadrati al livello successivo.</p>`)}

<h2><span class="num">9</span>Altre funzioni</h2>
${S([[591, 604]], 'indirizziRete: l\'IP per giocare da altri PC', `
  <p><code>os.networkInterfaces()</code> restituisce un oggetto con tutte le schede di rete del computer (Wi-Fi, Ethernet…), ognuna con un array di indirizzi.</p>
  <ul>
    <li><code>for...in</code> scorre le <b>chiavi</b> di un oggetto (i nomi delle schede, es. <code>en0</code>);</li>
    <li><code>for...of</code> scorre gli <b>elementi</b> di un array (gli indirizzi di quella scheda).</li>
  </ul>
  <p>Teniamo solo gli indirizzi IPv4 non interni (<code>!info.internal</code> esclude <code>127.0.0.1</code>, che funziona solo sul computer stesso). Gli altri PC della stessa rete aprono <code>http://IP:3000</code>.</p>`,
  'for...in → chiavi di un oggetto. for...of → valori di un array.')}

<h2 class="nuova"><span class="num">★</span>Riassunto: la vita di un giocatore sul server</h2>
${tabella(['Momento', 'Cosa succede nel server', 'Messaggi inviati'], [
  ['Apre la pagina', 'Express invia <code>index.html</code>; lo script apre il WebSocket → evento <code>connection</code>, il client riceve id e colore', '<code>benvenuto</code>, <code>record</code> (a lui) · <code>classifica</code> (a tutti)'],
  ['Scrive il nome', 'caso <code>nome</code>: nome pulito e salvato in <code>ws.nome</code>', '—'],
  ['Sceglie la Sfida', '<code>ws.modalita = \'sfida\'</code>; riceve i quadrati del <code>setInterval</code>', '<code>classifica</code> (a tutti), poi <code>quadrato</code> ogni 1,2 s'],
  ['Sceglie Difficoltà o Infinita', '<code>iniziaPartitaSingola</code> crea <code>ws.partita</code> e il primo timer', '<code>stato_partita</code>, <code>quadrato</code>'],
  ['Clicca in tempo', '<code>clickSingolo</code>: <code>clearTimeout</code>, punti, forse nuovo livello', '<code>preso</code>, (<code>livello</code>), <code>stato_partita</code>'],
  ['Non clicca in tempo', '<code>quadratoScaduto</code>: − 1 vita', '<code>mancato</code>, <code>stato_partita</code>'],
  ['Vite finite', '<code>finePartita</code>: <code>record.aggiungi</code>', '<code>game_over</code> · se record: <code>record</code> a tutti'],
  ['Chiude la pagina', 'evento <code>close</code>: <code>fermaPartita</code>', '<code>classifica</code> (a chi resta)'],
])}

<h2><span class="num">?</span>Domande probabili su server.js</h2>
${domande([
  ['Che differenza c\'è tra HTTP e WebSocket?', 'In HTTP il client chiede, il server risponde e la comunicazione finisce. Il WebSocket è una connessione <b>persistente e bidirezionale</b>: dopo l\'handshake resta aperta e anche il server può mandare dati quando vuole (es. il quadrato della sfida ogni 1,2 s o il messaggio "mancato").'],
  ['Come fanno Express e ws a usare la stessa porta?', '<code>app.listen</code> restituisce il server HTTP e <code>new Server({ server })</code> ci aggancia il WebSocket. Il browser apre il WebSocket con una richiesta HTTP <code>Upgrade: websocket</code>; il server risponde <code>101 Switching Protocols</code>.'],
  ['Cos\'è un middleware? Perché il 404 è per ultimo?', 'Una funzione <code>(req, res, next)</code> eseguita per ogni richiesta, nell\'ordine in cui è registrata: o risponde o chiama <code>next()</code>. Il 404 è per ultimo perché deve rispondere solo se nessuno prima ha risposto.'],
  ['Cosa fa fs.createReadStream(...).pipe(res)?', 'Legge il file audio a pezzi e invia ogni pezzo subito nella risposta, senza caricare tutto il file in memoria.'],
  ['Perché il JSON.parse è dentro un try/catch?', 'Se arriva un testo non valido <code>JSON.parse</code> lancia un errore; senza <code>catch</code> il server si fermerebbe per tutti. Così il messaggio viene solo ignorato.'],
  ['Dove salvate i dati di ogni giocatore?', 'Dentro l\'oggetto <code>ws</code> della sua connessione: <code>ws.id</code>, <code>ws.nome</code>, <code>ws.colore</code>, <code>ws.modalita</code>, <code>ws.punti</code>, <code>ws.partita</code>.'],
  ['Come mandate un messaggio solo a chi gioca la sfida?', '<code>giocatoriSfida()</code> trasforma il Set <code>ws_server.clients</code> in array con <code>Array.from</code> e lo filtra con <code>filter</code> su <code>modalita === \'sfida\'</code>; <code>inviaASfida</code> invia a ognuno.'],
  ['Se due giocatori cliccano quasi insieme, chi prende il punto?', 'Quello il cui messaggio arriva prima. Node gestisce gli eventi uno alla volta (event loop): il primo mette <code>quadrato.preso = true</code>, il secondo lo trova già preso.'],
  ['Perché il quadrato ha un numero?', 'Per scartare i click in ritardo: se il numero del click non è quello del quadrato attuale, il click è riferito a un quadrato vecchio e non vale.'],
  ['Differenza tra setInterval e setTimeout nel vostro codice?', '<code>setInterval</code> (sfida) ripete ogni 1,2 s per sempre. <code>setTimeout</code> (partite singole) scatta una volta: lo usiamo come "conto alla rovescia" del quadrato e lo annulliamo con <code>clearTimeout</code> se il click arriva in tempo.'],
  ['Come si perde una vita?', 'In <code>prossimoQuadrato</code> parte un <code>setTimeout</code> di <code>durata</code> ms. Se scade prima del click, <code>quadratoScaduto</code> toglie una vita e invia <code>mancato</code>.'],
  ['Perché in close chiamate fermaPartita?', 'Per annullare il timer della partita singola: altrimenti continuerebbe a scattare per un client che non esiste più.'],
  ['Come funziona la modalità infinita?', 'Ogni 10 quadrati presi si sale di livello (<code>floor(presi / 10) + 1</code>); ogni quadrato vale 40 × livello; il tempo si moltiplica per 0,88 a ogni livello (minimo 380 ms), il lato cala di 4 px (minimo 34) e cambia il colore.'],
  ['Perché controllate la difficoltà con Object.keys(...).includes?', 'Il valore arriva dal client e potrebbe essere qualsiasi cosa: accettiamo solo <code>facile</code>, <code>difficile</code> o <code>impossibile</code>.'],
  ['Perché decide tutto il server?', 'Il codice del browser si può modificare; se decidesse il client si potrebbe barare. Il server è l\'unico arbitro e il client mostra solo ciò che riceve.'],
])}

<h2><span class="num">A–Z</span>Glossario</h2>
<div class="glossario">
  <p><b>Broadcast</b>: invio dello stesso messaggio a tutti i client connessi.</p>
  <p><b>Callback</b>: funzione passata a un'altra funzione, che la chiamerà più tardi (es. in <code>app.listen</code>, <code>setTimeout</code>).</p>
  <p><b>Destrutturazione</b>: <code>const { Server } = ...</code> prende una proprietà da un oggetto.</p>
  <p><b>Event loop</b>: il meccanismo con cui Node esegue un evento alla volta su un solo thread.</p>
  <p><b>Handshake</b>: la richiesta HTTP iniziale con cui si apre il WebSocket (risposta 101).</p>
  <p><b>Hoisting</b>: le dichiarazioni <code>function</code> si possono usare prima della riga in cui sono scritte.</p>
  <p><b>JSON</b>: formato di testo per rappresentare oggetti. <code>stringify</code>: oggetto → testo; <code>parse</code>: testo → oggetto.</p>
  <p><b>Middleware</b>: funzione <code>(req, res, next)</code> eseguita da Express per ogni richiesta.</p>
  <p><b>Modulo</b>: file di codice riutilizzabile, caricato con <code>require</code>.</p>
  <p><b>Rotta</b>: risposta a un metodo + indirizzo precisi, es. <code>app.get('/musica', ...)</code>.</p>
  <p><b>Set</b>: insieme di valori senza doppioni; <code>size</code> = quanti sono.</p>
  <p><b>Stream</b>: flusso di dati letto e inviato a pezzi.</p>
  <p><b>Ternario</b>: <code>condizione ? A : B</code>, sceglie tra due valori.</p>
  <p><b>Variabile d'ambiente</b>: valore impostato dal sistema operativo, letto con <code>process.env</code>.</p>
</div>`;
  return pagina('Studio - server.js', corpo);
}

// =====================================================================================
// 2) record.js
// =====================================================================================
function guidaRecord() {
  const R = (righe, titolo, testo, ricorda) => blocco({ file: 'record', righe, titolo, testo, ricorda });
  const chips = (valori, classi = {}) => valori.map((v, i) => `<span class="chip ${classi[i] || ''}">${v}</span>`).join('');

  const corpo = `
${copertina('record<span>.js</span>', 'Il nostro modulo: salva i migliori punteggi',
  'Un modulo scritto da noi. Tiene in memoria le classifiche dei record (i 5 migliori punteggi di ogni modalità), le legge dal file record.json quando il server parte e le riscrive ogni volta che arriva un nuovo record, così non si perdono spegnendo il server.')}
${comeLeggere}

<h2><span class="num">0</span>Il file in breve</h2>
<div class="box"><b>Cosa fa record.js, in quattro punti</b>
<ol>
  <li>Ha una variabile <code>record</code> con <b>quattro classifiche</b>: <code>facile</code>, <code>difficile</code>, <code>impossibile</code>, <code>infinita</code>.</li>
  <li><code>carica()</code> legge il file <code>record.json</code> all'avvio (lettura <b>sincrona</b>).</li>
  <li><code>aggiungi()</code> inserisce un risultato, riordina, tiene i primi 5 e dice in che posizione è arrivato; se è un record chiama <code>salva()</code>, che scrive il file (scrittura <b>asincrona</b>).</li>
  <li>Con <code>module.exports</code> rende disponibili a <code>server.js</code> solo tre funzioni: <code>carica</code>, <code>aggiungi</code>, <code>elenco</code>.</li>
</ol></div>

<h3>Mappa del file</h3>
${tabella(['Righe', 'Elemento', 'Esportato?', 'Cosa fa'], [
  ['10–17', 'require e costanti', '—', 'moduli fs e path, percorso del file, numero massimo di record'],
  ['20', '<code>let record</code>', 'no', 'le classifiche in memoria'],
  ['23–25', '<code>strutturaVuota()</code>', 'no (privata)', 'crea le quattro liste vuote'],
  ['28–40', '<code>carica()</code>', '<b>sì</b>', 'legge record.json'],
  ['43–59', '<code>aggiungi(classifica, risultato)</code>', '<b>sì</b>', 'inserisce un risultato e restituisce la posizione o −1'],
  ['62–69', '<code>salva()</code>', 'no (privata)', 'scrive record.json'],
  ['72–74', '<code>elenco()</code>', '<b>sì</b>', 'restituisce tutte le classifiche'],
  ['78', '<code>module.exports</code>', '—', 'decide cosa esportare'],
])}

<h3>Come lo usa server.js</h3>
${tabella(['Riga di server.js', 'Chiamata', 'Quando'], [
  ['36', '<code>const record = require(\'./record\')</code>', 'importa il modulo; <code>record</code> diventa l\'oggetto <code>{ carica, aggiungi, elenco }</code>'],
  ['97', '<code>record.carica()</code>', 'una volta, all\'avvio del server'],
  ['147, 194, 551', '<code>record.elenco()</code>', 'API <code>/api/record</code>, benvenuto di un nuovo client, invio a tutti dopo un nuovo record'],
  ['539', '<code>record.aggiungi(classifica, {...})</code>', 'a ogni game over di una partita singola'],
])}

<h2 class="nuova"><span class="num">1</span>Moduli e costanti</h2>
${R([[10, 17]], 'require, percorso del file e limite', `
  <p>Il modulo usa due moduli <b>interni</b> di Node: <code>fs</code> (file system, per leggere e scrivere file) e <code>path</code> (per costruire i percorsi).</p>
  <p><code>path.join(__dirname, 'record.json')</code>: <code>__dirname</code> è la cartella di <code>record.js</code>, quindi il file dei record sta sempre accanto al modulo,
  da qualunque cartella si avvii il server.</p>
  <p><code>MAX_RECORD = 5</code>: in ogni classifica teniamo solo i 5 migliori. Scritto come costante, basta cambiarlo qui per tenerne di più.</p>`)}

<h2><span class="num">2</span>I dati in memoria</h2>
${R([[20, 25]], 'La variabile record e strutturaVuota()', `
  <p><code>record</code> è dichiarata con <code>let</code> perché verrà <b>riassegnata</b> (da <code>carica()</code> e da <code>aggiungi()</code>). È dichiarata fuori dalle funzioni, quindi tutte le funzioni del modulo la vedono;
  ma non è esportata, quindi <code>server.js</code> non può toccarla direttamente: deve passare dalle funzioni.</p>
  <p><code>strutturaVuota()</code> restituisce un oggetto nuovo con quattro array vuoti. È una funzione (e non una costante) così ogni volta crea un oggetto <b>nuovo</b>.</p>
  <p>Struttura dei dati (esempio inventato):</p>
  <div class="codice"><div class="r"><span class="ln"></span><span class="tx">{
  <span class="t-s">"facile"</span>: [ { <span class="t-s">"nome"</span>: <span class="t-s">"Luca"</span>, <span class="t-s">"punti"</span>: <span class="t-n">31</span>, <span class="t-s">"livello"</span>: <span class="t-n">1</span>, <span class="t-s">"presi"</span>: <span class="t-n">31</span>, <span class="t-s">"data"</span>: <span class="t-s">"20/11/2026"</span> } ],
  <span class="t-s">"difficile"</span>: [],
  <span class="t-s">"impossibile"</span>: [],
  <span class="t-s">"infinita"</span>: [ { <span class="t-s">"nome"</span>: <span class="t-s">"Sara"</span>, <span class="t-s">"punti"</span>: <span class="t-n">1800</span>, <span class="t-s">"livello"</span>: <span class="t-n">3</span>, <span class="t-s">"presi"</span>: <span class="t-n">25</span>, <span class="t-s">"data"</span>: <span class="t-s">"21/11/2026"</span> } ]
}</span></div></div>
  <p>È un <b>oggetto</b> che contiene <b>array</b> di oggetti: per leggere il primo record dell'infinita si scrive <code>record.infinita[0].punti</code> oppure <code>record['infinita'][0].punti</code>.</p>`,
  'Le variabili e funzioni non esportate restano "private" dentro il modulo.')}

<h2><span class="num">3</span>carica(): lettura all'avvio</h2>
${R([[28, 40]], 'Leggere record.json', `
  <ol>
    <li><code>fs.readFileSync(FILE_RECORD, 'utf8')</code> legge tutto il file come testo. È <b>sincrona</b>: il programma aspetta finché la lettura non è finita.
    Qui va bene, perché succede una volta sola all'avvio, prima che arrivino giocatori.</li>
    <li><code>JSON.parse(testo)</code> trasforma il testo in oggetto.</li>
    <li><code>Object.assign(strutturaVuota(), datiLetti)</code> parte dalla struttura vuota e ci <b>copia sopra</b> le proprietà lette dal file. Se nel file mancasse una lista
    (es. un file vecchio senza <code>infinita</code>), quella lista esisterebbe comunque, vuota.</li>
  </ol>
  <p><b>try/catch</b>: la prima volta il file non esiste e <code>readFileSync</code> lancia un errore; se il file è rovinato lo lancia <code>JSON.parse</code>. In entrambi i casi
  il <code>catch</code> riparte con le classifiche vuote, invece di far crollare il server.</p>`,
  'readFileSync è sincrona (blocca), ma si usa solo all\'avvio. try/catch gestisce il file mancante o rovinato.')}

<h2 class="nuova"><span class="num">4</span>aggiungi(): inserire un risultato</h2>
${R([[43, 59]], 'L\'algoritmo passo per passo', `
  <ol>
    <li><code>if (risultato.punti <= 0) return -1;</code> una partita con 0 punti non è mai un record.</li>
    <li><code>record[classifica]</code>: le parentesi quadre permettono di scegliere la lista con il nome contenuto in una variabile (<code>'facile'</code>, <code>'infinita'</code>…).</li>
    <li><code>push</code> aggiunge il risultato in fondo alla lista.</li>
    <li><code>sort((a, b) => b.punti - a.punti)</code> ordina dal punteggio più alto al più basso. L'ordinamento di JavaScript è <b>stabile</b>: a parità di punti l'ordine di prima resta, quindi chi c'era già resta davanti al nuovo.</li>
    <li><code>indexOf(risultato)</code> trova la posizione del nuovo risultato (cerca proprio quell'oggetto).</li>
    <li><code>slice(0, MAX_RECORD)</code> crea un nuovo array con gli elementi da 0 a 4: i primi 5. Il nuovo array sostituisce quello vecchio.</li>
    <li>Se la posizione è 5 o più, il risultato è stato tagliato fuori → <code>-1</code>, e non si salva niente. Altrimenti <code>salva()</code> e restituisce la posizione.</li>
  </ol>
  <p>La posizione parte da <b>0</b> (primo posto): per questo la pagina scrive <code>posizione + 1</code> ("Nuovo record: 1° posto!").</p>`,
  'push → sort decrescente → indexOf → slice(0, 5). Restituisce la posizione (0 = primo) oppure −1.')}
<div class="box"><b>Esempio 1: il nuovo risultato entra in classifica</b>
  <p>Classifica facile prima: ${chips([30, 25, 20, 12, 8])} — arriva una partita da <b>22 punti</b>.</p>
  <p>dopo <code>push</code>: ${chips([30, 25, 20, 12, 8, 22], { 5: 'nuovo' })}</p>
  <p>dopo <code>sort</code>: ${chips([30, 25, 22, 20, 12, 8], { 2: 'nuovo' })} → <code>indexOf</code> = <b>2</b></p>
  <p>dopo <code>slice(0, 5)</code>: ${chips([30, 25, 22, 20, 12, '8'], { 2: 'nuovo', 5: 'fuori' })} → restituisce <b>2</b>, si salva, la pagina mostra "Nuovo record: 3° posto!"</p>
</div>
<div class="box"><b>Esempio 2: il nuovo risultato non basta</b>
  <p>Stessa classifica, arriva una partita da <b>5 punti</b>: dopo <code>sort</code> ${chips([30, 25, 20, 12, 8, 5], { 5: 'nuovo fuori' })} → <code>indexOf</code> = 5, che è ≥ 5:
  con <code>slice</code> viene tagliato fuori, la funzione restituisce <b>−1</b> e il file non viene riscritto.</p>
</div>
<p><b>Perché è importante il controllo nel server.</b> Se <code>classifica</code> fosse un nome che non esiste, <code>record[classifica]</code> sarebbe <code>undefined</code> e <code>push</code> darebbe errore.
Non succede perché <code>server.js</code> passa solo <code>'infinita'</code> o una difficoltà già controllata con <code>Object.keys(DIFFICOLTA).includes(...)</code>.</p>

<h2 class="nuova"><span class="num">5</span>salva(): scrittura asincrona</h2>
${R([[62, 69]], 'Scrivere record.json', `
  <p><code>JSON.stringify(record, null, 2)</code> trasforma l'oggetto in testo JSON. Il terzo parametro <code>2</code> indenta il testo con 2 spazi, così il file si legge bene anche aprendolo a mano
  (il secondo parametro, <code>null</code>, serve per filtri che non usiamo).</p>
  <p><code>fs.writeFile(file, testo, callback)</code> è <b>asincrona</b>: avvia la scrittura e il programma va subito avanti. Quando la scrittura finisce, Node chiama la <b>callback</b>
  con un eventuale <code>errore</code> (se è tutto ok vale <code>null</code>).</p>`,
  'writeFile è asincrona: il server continua a gestire i giocatori mentre il file viene scritto; la callback segnala la fine o un errore.')}
<div class="due">
  <div class="box"><b>Sincrono: readFileSync</b>
    <p><code>const testo = fs.readFileSync(...)</code><br>il programma <b>si ferma</b> finché il file non è letto, poi continua con il risultato.</p>
    <p>Usato in <code>carica()</code>: una volta, all'avvio, quando non c'è ancora nessuno da far aspettare.</p></div>
  <div class="box"><b>Asincrono: writeFile</b>
    <p><code>fs.writeFile(..., (errore) => {...})</code><br>il programma <b>non aspetta</b>: continua subito, e la callback viene eseguita a scrittura finita.</p>
    <p>Usato in <code>salva()</code>: durante il gioco, così nessuno sente rallentamenti.</p></div>
</div>

<h2><span class="num">6</span>elenco() e module.exports</h2>
${R([[72, 78]], 'Esportare le funzioni', `
  <p><code>elenco()</code> restituisce l'oggetto con tutte le classifiche: <code>server.js</code> lo manda ai client nel messaggio <code>record</code> e nella rotta <code>/api/record</code>.</p>
  <p><code>module.exports</code> è l'oggetto che il modulo "consegna" a chi fa <code>require('./record')</code>. Scriviamo <code>{ carica, aggiungi, elenco }</code>
  (forma breve di <code>{ carica: carica, aggiungi: aggiungi, elenco: elenco }</code>).</p>
  <p>Quello che <b>non</b> è nell'oggetto resta privato: <code>salva</code>, <code>strutturaVuota</code>, la variabile <code>record</code> e le costanti. È un modo per proteggere i dati:
  da fuori si possono usare solo le tre funzioni pensate per farlo.</p>
  <p>Una curiosità: <code>elenco()</code> restituisce un <b>riferimento</b> allo stesso oggetto, non una copia. Nel nostro progetto va bene perché <code>server.js</code> lo usa solo per inviarlo.</p>`,
  'module.exports decide cosa vede chi fa require: il resto del modulo rimane privato.')}

<h2 class="nuova"><span class="num">?</span>Domande probabili su record.js</h2>
${domande([
  ['Cos\'è record.js?', 'Un <b>modulo personalizzato</b> scritto da noi: esporta <code>carica</code>, <code>aggiungi</code> ed <code>elenco</code> con <code>module.exports</code>, e <code>server.js</code> lo importa con <code>require(\'./record\')</code>.'],
  ['Perché nel require c\'è ./ ?', 'Indica un file del progetto, nella stessa cartella di <code>server.js</code>. Senza <code>./</code> Node cercherebbe un modulo chiamato <code>record</code> in <code>node_modules</code>.'],
  ['Quali funzioni sono private e perché?', '<code>salva</code> e <code>strutturaVuota</code> (e la variabile <code>record</code>): non sono in <code>module.exports</code>, quindi <code>server.js</code> non le vede. Servono solo al funzionamento interno.'],
  ['Perché readFileSync in carica e writeFile in salva?', '<code>readFileSync</code> blocca il programma, ma si usa una volta sola all\'avvio. <code>writeFile</code> è asincrona: durante il gioco il server non si blocca mentre scrive.'],
  ['Cosa succede la prima volta, quando record.json non esiste?', '<code>readFileSync</code> lancia un errore, il <code>catch</code> lo gestisce e si parte con le classifiche vuote. Il file viene creato al primo record, da <code>salva()</code>.'],
  ['A cosa serve Object.assign in carica?', 'Unisce la struttura vuota con i dati letti: se nel file manca una lista, esiste comunque vuota.'],
  ['Spiega l\'algoritmo di aggiungi.', '<code>push</code> del risultato, <code>sort</code> decrescente per punti, <code>indexOf</code> per la posizione, <code>slice(0, 5)</code> per tenere i primi 5. Se la posizione è ≥ 5 restituisce −1, altrimenti salva e restituisce la posizione.'],
  ['Cosa restituisce aggiungi e chi usa il valore?', 'La posizione (0 = primo posto) o −1. <code>finePartita</code> la manda al client nel <code>game_over</code> (che mostra "Nuovo record: N° posto!") e, se è ≥ 0, invia i record aggiornati a tutti.'],
  ['A parità di punti chi sta davanti?', 'Chi c\'era già: <code>sort</code> in JavaScript è stabile e il nuovo risultato era stato aggiunto in fondo con <code>push</code>.'],
  ['Cosa fanno null e 2 in JSON.stringify(record, null, 2)?', '<code>null</code>: nessun filtro sulle proprietà; <code>2</code>: indentazione di 2 spazi per rendere il file leggibile.'],
  ['Perché un record con 0 punti viene scartato?', 'Una partita persa senza prendere nessun quadrato non è un risultato da ricordare: la prima riga di <code>aggiungi</code> restituisce subito −1.'],
])}

<h2><span class="num">A–Z</span>Glossario</h2>
<div class="glossario">
  <p><b>Asincrono</b>: l'operazione parte e il programma continua; il risultato arriva dopo, in una callback.</p>
  <p><b>Callback</b>: funzione chiamata quando un'operazione è finita (qui, la scrittura del file).</p>
  <p><b>fs</b>: modulo interno di Node per lavorare con i file.</p>
  <p><b>indexOf</b>: posizione di un elemento in un array (−1 se non c'è).</p>
  <p><b>module.exports</b>: ciò che un modulo rende disponibile a chi lo importa.</p>
  <p><b>Object.assign(a, b)</b>: copia le proprietà di <code>b</code> dentro <code>a</code>.</p>
  <p><b>slice(0, n)</b>: nuovo array con i primi n elementi (l'originale non cambia).</p>
  <p><b>sort con funzione di confronto</b>: <code>b - a</code> = decrescente, <code>a - b</code> = crescente.</p>
  <p><b>Sincrono</b>: il programma aspetta la fine dell'operazione prima di andare avanti.</p>
  <p><b>try/catch</b>: prova a eseguire un codice e, se c'è un errore, esegue il blocco catch invece di fermarsi.</p>
</div>`;
  return pagina('Studio - record.js', corpo);
}

// =====================================================================================
// 3) index.html
// =====================================================================================
function guidaIndex() {
  const H = (righe, titolo, testo, ricorda) => blocco({ file: 'index', righe, lingua: 'html', titolo, testo, ricorda });
  const C = (righe, titolo, testo, ricorda) => blocco({ file: 'index', righe, lingua: 'css', titolo, testo, ricorda });
  const J = (righe, titolo, testo, ricorda) => blocco({ file: 'index', righe, lingua: 'js', titolo, testo, ricorda });

  const corpo = `
${copertina('index<span>.html</span>', 'Il client: la pagina che gira nel browser',
  'Un solo file con tre linguaggi: HTML (la struttura), CSS (la grafica) e JavaScript (il comportamento). Express lo invia al browser; poi lo script apre un WebSocket verso il server, disegna quello che riceve e manda al server i click del giocatore.')}
${comeLeggere}

<h2><span class="num">0</span>Il file in breve</h2>
<div class="box"><b>Cosa fa index.html</b>
<ol>
  <li>Disegna l'interfaccia: intestazione, campo di gioco con il quadrato, pannello laterale e le <b>schermate sovrapposte</b> (nome, menu, vittoria, game over, classifiche).</li>
  <li>Apre il <b>WebSocket</b> verso il server che gli ha dato la pagina.</li>
  <li>Quando arriva un messaggio (<code>onmessage</code>) guarda il campo <code>tipo</code> e aggiorna la pagina: sposta il quadrato, mostra punti, vite, classifiche…</li>
  <li>Quando il giocatore preme sul quadrato manda al server solo <code>{ tipo: 'click', numero }</code>. <b>Non decide niente</b>: punti e vite li decide il server.</li>
</ol></div>

<h3>Mappa del file</h3>
${tabella(['Righe', 'Parte', 'Contenuto'], [
  ['10–23', 'HEAD', 'doctype, lingua, codifica, viewport, titolo, icona della scheda'],
  ['25–287', 'CSS (<code>&lt;style&gt;</code>)', 'grafica: colori, layout con flex e grid, animazioni, schermate sovrapposte'],
  ['296–328', 'Icone SVG', '15 icone disegnate una volta e riusate con <code>&lt;use&gt;</code>'],
  ['331–412', 'Intestazione e campo', '<code>header</code>, <code>main</code> con <code>#campo</code> e il pannello <code>aside</code>'],
  ['415–566', 'Schermate e audio', 'nome, menu, vittoria, game over, classifiche, <code>&lt;audio&gt;</code>'],
  ['572–575', 'JS § 1', 'connessione WebSocket'],
  ['577–666', 'JS § 2', 'riferimenti agli elementi (<code>getElementById</code>)'],
  ['668–687', 'JS § 3', 'variabili del client'],
  ['689–852', 'JS § 4', 'eventi del WebSocket: <code>onopen</code>, <code>onclose</code>, <code>onmessage</code>'],
  ['854–915', 'JS § 5', 'eventi dell\'utente (<code>addEventListener</code>)'],
  ['917–1204', 'JS § 6', 'funzioni'],
])}

<h2 class="nuova"><span class="num">1</span>HEAD: le informazioni della pagina</h2>
${H([[10, 23]], 'Doctype, meta e favicon', `
  <ul>
    <li><code>&lt;!DOCTYPE html&gt;</code>: dice al browser che è HTML5.</li>
    <li><code>lang="it"</code>: lingua italiana (utile ai lettori di schermo e alla traduzione automatica).</li>
    <li><code>charset="UTF-8"</code>: codifica dei caratteri, così le lettere accentate (à, è, ù) si vedono bene.</li>
    <li><code>viewport</code>: adatta la larghezza della pagina allo schermo, per giocare anche dal telefono.</li>
    <li><code>&lt;title&gt;</code>: testo della scheda del browser.</li>
    <li><code>&lt;link rel="icon"&gt;</code>: l'icona della scheda. Invece di un file è un <b>data URI</b>: il disegno SVG è scritto direttamente nell'indirizzo (i caratteri speciali come <code>&lt;</code> sono codificati, es. <code>%3C</code>).</li>
  </ul>`)}

<h2><span class="num">2</span>CSS: i pezzi da saper spiegare</h2>
<p>Il CSS è lungo, ma i concetti importanti sono pochi. Qui ci sono i blocchi che è bene saper spiegare; il resto sono colori, spazi e grandezze.</p>
${C([[26, 36]], 'box-sizing e lo stile delle icone', `
  <p><code>* { box-sizing: border-box; }</code>: per <b>tutti</b> gli elementi (<code>*</code>) la larghezza comprende anche padding e bordo. Così <code>width: 100%</code> non "sfora".</p>
  <p><code>.icona</code>: le icone sono disegnate con linee (<code>stroke</code>) e senza riempimento (<code>fill: none</code>). <code>stroke: currentColor</code> significa "usa il colore del testo":
  basta cambiare <code>color</code> e l'icona cambia colore. <code>1.15em</code> = grande quanto il testo intorno.</p>`)}
${C([[114, 132]], '#campo: griglia di sfondo e animazione di errore', `
  <ul>
    <li><code>position: relative</code>: il campo diventa il riferimento per gli elementi <code>absolute</code> al suo interno (il quadrato, il fumetto, la barra).</li>
    <li><code>flex: 1 1 520px</code>: nel layout flex il campo cresce e si restringe, partendo da 520 px.</li>
    <li>Lo <code>background</code> ha tre strati: due <code>linear-gradient</code> che disegnano una riga di 1 px ogni 40 px (uno orizzontale, uno ruotato di 90° per le verticali) e il colore di fondo. Risultato: la griglia a quadretti.</li>
    <li><code>overflow: hidden</code>: niente può uscire dai bordi del campo.</li>
    <li><code>#campo.errore</code>: quando JavaScript aggiunge la classe <code>errore</code>, parte l'animazione <code>scossa</code> (definita con <code>@keyframes</code>: sinistra di 6 px, destra di 6 px, torna al centro) e il bordo diventa rosso.
    Serve <code>!important</code> perché nella modalità infinita JavaScript colora il bordo con uno <b>stile inline</b>, che altrimenti vincerebbe.</li>
  </ul>`,
  'Un elemento position: absolute si posiziona rispetto al primo antenato con position: relative (qui #campo).')}
${C([[133, 153]], '#quadrato e la barra del tempo', `
  <ul>
    <li><code>position: absolute</code>: si posiziona con <code>left</code> e <code>top</code>, che JavaScript calcola dai dati del server.</li>
    <li><code>display: none</code>: all'inizio è nascosto.</li>
    <li><code>box-shadow: 0 0 22px var(--bagliore, ...)</code>: il bagliore usa una <b>variabile CSS</b> <code>--bagliore</code>, impostata da JavaScript con il colore del livello; il secondo valore è quello di riserva se la variabile non c'è.</li>
    <li><code>transition</code>: i cambi di grandezza, colore e trasparenza avvengono in modo graduale. <code>:hover</code> lo ingrandisce del 6% al passaggio del mouse.</li>
    <li><code>.preso</code>: quando viene preso si rimpicciolisce (<code>scale(0.6)</code>) e diventa semitrasparente.</li>
    <li><code>#barra-tempo</code>: barra in fondo al campo, larga 0 all'inizio; JavaScript la allarga e la fa svuotare.</li>
  </ul>`)}
${C([[154, 171]], '#messaggio: il fumetto al centro', `
  <p>Centrare un elemento <code>absolute</code>: <code>left: 50%</code> sposta il bordo sinistro a metà del campo, <code>transform: translateX(-50%)</code> lo riporta indietro di metà della sua larghezza.</p>
  <p><code>opacity: 0</code> lo nasconde, la classe <code>.visibile</code> lo mostra con una transizione. <code>pointer-events: none</code> fa "passare attraverso" i click: il fumetto non impedisce mai di cliccare il quadrato sotto.</p>`)}
${C([[211, 213]], 'I cuori delle vite', `
  <p>Tutti i cuori sono grigi; quelli con la classe <code>piena</code> diventano rossi (anche il riempimento, <code>fill</code>). JavaScript mette <code>piena</code> solo sulle vite rimaste.</p>`)}
${C([[227, 236], [260, 266]], 'Schermate sovrapposte, .nascosto e la griglia del menu', `
  <ul>
    <li><code>.overlay</code>: <code>position: fixed</code> + <code>inset: 0</code> (cioè top, right, bottom, left a 0) copre tutta la finestra con uno sfondo scuro semitrasparente. Il riquadro <code>.box</code> con <code>margin: auto</code> dentro un contenitore flex viene centrato.</li>
    <li><code>.nascosto { display: none !important; }</code>: la classe usata in tutta la pagina per nascondere. <code>!important</code> la fa vincere su qualsiasi altra regola <code>display</code> (es. <code>display: flex</code> di <code>.overlay</code>). Mostrare/nascondere = togliere/aggiungere questa classe.</li>
    <li><code>.modalita</code>: <b>CSS Grid</b> con <code>repeat(auto-fit, minmax(240px, 1fr))</code>: tante colonne quante ne stanno, ognuna larga almeno 240 px. Su un PC le tre carte stanno affiancate, sul telefono vanno una sotto l'altra, senza scrivere altro codice.</li>
  </ul>`,
  'Per mostrare o nascondere una schermata, JavaScript aggiunge o toglie la classe "nascosto".')}

<h2 class="nuova"><span class="num">3</span>HTML: la struttura della pagina</h2>
${H([[296, 300], [327, 328]], 'Le icone SVG: disegnate una volta, usate ovunque', `
  <p>All'inizio del <code>body</code> c'è un <code>&lt;svg&gt;</code> invisibile (larghezza e altezza 0) che contiene 15 <code>&lt;symbol&gt;</code>. Ogni simbolo è un'icona con un <code>id</code>.
  Dove serve un'icona si scrive <code>&lt;svg class="icona"&gt;&lt;use href="#i-trofeo"/&gt;&lt;/svg&gt;</code>: <code>&lt;use&gt;</code> "copia" il disegno del simbolo.</p>
  <p>Vantaggi: ogni icona è scritta una sola volta, è vettoriale (nitida a qualsiasi grandezza) e prende il colore dal CSS. Per cambiare icona da JavaScript basta cambiare l'attributo <code>href</code> di <code>&lt;use&gt;</code>.
  Lo stile è quello del set open source Lucide (licenza ISC).</p>
  ${tabella(['id', 'Dove si usa'], [
    ['<code>i-bersaglio</code>', 'logo del gioco'], ['<code>i-utenti</code>', 'connessi, modalità Sfida'], ['<code>i-volume-on</code> / <code>i-volume-off</code>', 'pulsante della musica'],
    ['<code>i-trofeo</code>', 'classifiche, vittoria, record'], ['<code>i-stella</code>, <code>i-fulmine</code>', 'fumetto: punto preso da me / da un altro'],
    ['<code>i-play</code>, <code>i-avviso</code>, <code>i-livello</code>', 'fumetto: nuova partita, errori, nuovo livello'],
    ['<code>i-cuore</code>', 'vite, game over, "mancato"'], ['<code>i-tachimetro</code>, <code>i-infinito</code>', 'modalità Difficoltà e Infinita'],
    ['<code>i-menu</code>, <code>i-ricarica</code>', 'pulsanti Menu e Rigioca'],
  ])}`)}
${H([[331, 351]], 'header: titolo e informazioni', `
  <p>Contiene il titolo con il logo e il contenitore <code>#info</code> con: il mio nome con un pallino del mio colore, il numero di <b>connessi</b>, lo <b>stato della connessione</b>
  (pallino giallo → verde → rosso) e i pulsanti <b>Classifiche</b>, <b>Menu</b> (nascosto finché non si gioca, classe <code>nascosto</code>) e <b>Musica</b>.</p>
  <p>Gli elementi con un <code>id</code> sono quelli che JavaScript andrà a modificare (es. <code>id="connessi"</code>). <code>class="secondario"</code> dà ai pulsanti lo stile grigio.</p>`)}
${H([[354, 364]], 'main e #campo', `
  <p><code>&lt;main&gt;</code> è il contenuto principale e affianca (con flex) il campo e il pannello laterale.</p>
  <p>Dentro <code>#campo</code> ci sono tre elementi, tutti vuoti all'inizio: il <code>#quadrato</code>, il fumetto <code>#messaggio</code> (con un'icona e un testo che cambiano) e la <code>#barra-tempo</code>.
  Posizione, grandezza e colore del quadrato li decide il server.</p>`)}
${H([[367, 412]], 'aside: il pannello laterale', `
  <p>Contiene due pannelli, mostrati <b>uno alla volta</b>:</p>
  <ul>
    <li><code>#pannello-sfida</code>: la classifica della sfida (<code>&lt;ol id="classifica"&gt;</code>, lista ordinata riempita da JavaScript).</li>
    <li><code>#pannello-solo</code> (nascosto all'inizio): per Difficoltà e Infinita, con i cuori (<code>#vite</code>), le tre statistiche (punti, quadrati, livello), l'avanzamento verso il livello successivo e i 5 record della modalità.</li>
  </ul>
  <p><code>&lt;div id="avanzamento"&gt;&lt;div&gt;&lt;/div&gt;&lt;/div&gt;</code>: barra fatta di due div; quello interno si allarga da 0% a 100%.</p>`)}
${H([[415, 431]], 'Schermata del nome', `
  <p>È la prima cosa che si vede: un <code>.overlay</code> visibile (non ha la classe <code>nascosto</code>). L'<code>input</code> ha <code>maxlength="15"</code> (massimo 15 caratteri)
  e <code>autocomplete="off"</code>. Il pulsante <b>Continua</b> nasce <code>disabled</code>: diventa cliccabile solo quando il WebSocket è connesso (in <code>onopen</code>).</p>`)}
${H([[442, 448], [458, 466]], 'Il menu delle modalità e gli attributi data-', `
  <p>Il menu ha tre <b>carte</b> (Sfida, Difficoltà, Infinita). I pulsanti hanno <b>attributi personalizzati</b> che iniziano con <code>data-</code>:
  <code>data-modalita="difficolta"</code>, <code>data-difficolta="facile"</code>.</p>
  <p>JavaScript li trova tutti con <code>querySelectorAll('[data-modalita]')</code> e ne legge i valori con <code>dataset</code>: un solo pezzo di codice gestisce tutti e cinque i pulsanti.</p>
  <p>I <code>&lt;small id="dettagli-facile"&gt;</code> sono vuoti: il testo "3 vite · 1,4 s" lo scrive JavaScript con i dati ricevuti dal server.</p>`,
  'Gli attributi data-... memorizzano informazioni nell\'HTML; JavaScript le legge con elemento.dataset.')}
${H([[504, 534]], 'Schermata di game over', `
  <p>Mostra il riepilogo (punti, quadrati, livello), il testo del record (<code>#testo-record</code>, vuoto se non è un record) e due pulsanti: <b>Rigioca</b> (stessa modalità) e <b>Menu</b>.
  La schermata di <b>vittoria</b> della sfida (righe 489–501) è simile: titolo con il vincitore e il conto alla rovescia <code>#conto</code>.</p>`)}
${H([[537, 549], [566, 566]], 'Schermata delle classifiche e audio', `
  <p>Quattro carte, una per classifica, ognuna con una <code>&lt;ol&gt;</code> (<code>classifica-facile</code>, <code>-difficile</code>, <code>-impossibile</code>, <code>-infinita</code>). È scritta <b>dopo</b> le altre schermate:
  a parità di posizione, l'elemento che viene dopo nell'HTML viene disegnato sopra, così si può aprire anche sopra il menu.</p>
  <p><code>&lt;audio src="/musica" loop preload="none"&gt;</code>: il file arriva in streaming dalla rotta <code>/musica</code> del server; <code>loop</code> lo fa ricominciare,
  <code>preload="none"</code> lo scarica solo quando si preme Musica.</p>`)}

<h2 class="nuova"><span class="num">4</span>JavaScript § 1–3: connessione, elementi, variabili</h2>
${J([[575, 575]], '§ 1 · Aprire il WebSocket', `
  <p><code>location.origin</code> è l'indirizzo del server che ha dato la pagina, es. <code>http://192.168.1.20:3000</code>. <code>replace(/^http/, 'ws')</code> sostituisce "http" all'inizio
  (<code>^</code> = inizio del testo) con "ws": <code>ws://192.168.1.20:3000</code>. Così il client si collega <b>sempre al server giusto</b>, senza scrivere l'indirizzo a mano.
  (Con <code>https</code> diventerebbe <code>wss</code>, il WebSocket sicuro.)</p>
  <p>Nel browser l'oggetto <code>WebSocket</code> esiste già: il modulo <code>ws</code> serve solo al server.</p>`)}
${J([[580, 590], [636, 636]], '§ 2 · Riferimenti agli elementi', `
  <p><code>document.getElementById('campo')</code> cerca nel <b>DOM</b> (la pagina vista come albero di oggetti) l'elemento con quell'id. Salviamo i riferimenti <b>una volta sola</b> in costanti,
  invece di cercarli ogni volta: il codice è più corto e più veloce. Le righe 580–666 fanno questo per tutti gli elementi usati.</p>
  <p><code>querySelector('#avanzamento div')</code> accetta un <b>selettore CSS</b>: "il div dentro <code>#avanzamento</code>".</p>`)}
${J([[671, 687]], '§ 3 · Variabili del client', `
  ${tabella(['Variabile', 'Cosa ricorda'], [
    ['<code>mioId</code>', 'il mio id, ricevuto nel <code>benvenuto</code> (serve a capire se un punto o una vittoria sono miei)'],
    ['<code>numeroQuadrato</code>', 'il numero del quadrato in campo: lo rimandiamo nel click'],
    ['<code>puntiPerVincere</code>', 'per calcolare la lunghezza delle barre in classifica'],
    ['<code>configDifficolta</code>', 'la tabella delle difficoltà ricevuta dal server'],
    ['<code>modalitaAttuale</code>, <code>difficoltaAttuale</code>', 'cosa si sta giocando (servono anche per Rigioca)'],
    ['<code>record</code>', 'gli ultimi record ricevuti'],
    ['<code>timerMessaggio</code>, <code>timerConto</code>', 'i timer del fumetto e del conto alla rovescia, per poterli annullare'],
  ])}
  <p>Sono <code>let</code> perché cambiano durante il gioco. Sono dati per <b>mostrare</b> le cose: le decisioni le prende il server.</p>`)}

<h2><span class="num">5</span>JavaScript § 4: eventi del WebSocket</h2>
${J([[692, 715]], 'onopen e onclose', `
  <p><b>onopen</b> scatta quando la connessione è pronta: stato "Connesso", pallino verde (<code>className</code> sostituisce tutte le classi), pulsante Continua abilitato e cursore nella casella del nome.</p>
  <p><b>onclose</b> scatta se la connessione si chiude (es. server spento): stato "Disconnesso", pallino rosso, quadrato nascosto, barra ferma e un avviso.</p>`)}
${J([[718, 742]], 'onmessage e il messaggio "benvenuto"', `
  <p><b>onmessage</b> scatta per ogni messaggio del server. <code>event.data</code> è il testo; <code>JSON.parse</code> lo trasforma in oggetto. Poi una catena di <code>if / else if</code> sul campo <code>tipo</code>
  sceglie cosa fare.</p>
  <p><b>benvenuto</b>: salva il mio id, colora il mio pallino, mostra un nome provvisorio, salva punti per vincere e difficoltà. Con <code>for...in</code> scorre le chiavi
  (<code>facile</code>, <code>difficile</code>, <code>impossibile</code>) e scrive nei pulsanti "3 vite · 1,4 s":</p>
  <ul>
    <li><code>d.vite === 1 ? ' vita' : ' vite'</code>: singolare o plurale con il ternario;</li>
    <li><code>(d.tempo / 1000).toLocaleString('it-IT')</code>: 1400 → 1,4 con la virgola all'italiana.</li>
  </ul>`)}
${J([[744, 774]], 'Il messaggio "quadrato": da percentuale a pixel', `
  <p>Il server manda <code>x</code> e <code>y</code> in <b>percentuale</b> (0–100). Il client li trasforma in pixel in base alla grandezza del <b>suo</b> campo:</p>
  <svg viewBox="0 0 700 175" width="100%" style="margin:1mm 0 3mm">
    <rect x="20" y="10" width="420" height="150" rx="8" fill="#1a1d2e" stroke="#2d3250" stroke-width="2"/>
    <rect x="20" y="10" width="360" height="90" fill="none" stroke="#f9ca24" stroke-dasharray="5 4"/>
    <rect x="290" y="64" width="60" height="60" rx="6" fill="#f9ca24"/>
    <text x="320" y="99" text-anchor="middle" font-size="11" font-weight="700" fill="#1e2233">quadrato</text>
    <line x1="20" y1="140" x2="380" y2="140" stroke="#8ecbff" stroke-width="1.5"/><text x="200" y="154" text-anchor="middle" font-size="11" fill="#8ecbff">spazioX = larghezza campo − dimensione</text>
    <line x1="380" y1="140" x2="440" y2="140" stroke="#ff8a80" stroke-width="1.5"/><text x="410" y="132" text-anchor="middle" font-size="10" fill="#ff8a80">lato</text>
    <text x="470" y="40" font-size="12" fill="#23262f" font-weight="700">left = spazioX × x / 100</text>
    <text x="470" y="62" font-size="12" fill="#23262f" font-weight="700">top = spazioY × y / 100</text>
    <text x="470" y="92" font-size="11" fill="#5d6475">x = 0 → tutto a sinistra</text>
    <text x="470" y="110" font-size="11" fill="#5d6475">x = 100 → tocca il bordo destro</text>
    <text x="470" y="128" font-size="11" fill="#5d6475">il riquadro tratteggiato è dove</text>
    <text x="470" y="144" font-size="11" fill="#5d6475">può stare l'angolo in alto a sinistra</text>
  </svg>
  <ul>
    <li>Prima imposta la grandezza (<code>style.width</code> e <code>style.height</code>), poi calcola lo spazio disponibile: larghezza del campo (<code>clientWidth</code>) <b>meno</b> il lato del quadrato, così non esce mai dal bordo.
    Si usa <code>msg.dimensione</code> e non la larghezza misurata, perché un elemento nascosto misura 0. <code>Math.max(0, ...)</code> evita numeri negativi su schermi minuscoli.</li>
    <li>Colore: <code>msg.colore || ''</code>; la stringa vuota cancella lo stile inline e torna il giallo del CSS. <code>setProperty('--bagliore', ...)</code> imposta la variabile CSS del bagliore.</li>
    <li>Toglie le classi <code>preso</code> ed <code>errore</code>, mostra il quadrato (<code>display = 'block'</code>).</li>
    <li>Se c'è <code>durata</code> (solo partite singole) fa partire la barra del tempo, altrimenti (sfida) la ferma.</li>
  </ul>`,
  'Il server manda percentuali, il client le converte in pixel: così funziona su ogni grandezza di schermo.')}
${J([[776, 802]], 'I messaggi "preso" e "mancato"', `
  <p><b>preso</b>: se il numero non è quello del quadrato attuale lo ignora. Altrimenti rimpicciolisce il quadrato (classe <code>preso</code>) e ferma la barra; nella sfida colora il quadrato con il colore di chi l'ha preso.
  Il fumetto dipende da chi l'ha preso:</p>
  <ul>
    <li>io (<code>msg.id === mioId</code>): "+1 per te!" oppure, nell'infinita, "+40 punti" (<code>msg.guadagno</code>), con la stella;</li>
    <li>un altro: "Marco è stato più veloce", con il fulmine.</li>
  </ul>
  <p><b>mancato</b>: nasconde il quadrato e fa "tremare" il campo. Per far ripartire un'animazione CSS già usata c'è un trucco: si toglie la classe, si legge <code>campo.offsetWidth</code>
  (con <code>void</code> davanti perché il valore non serve) che obbliga il browser a ricalcolare la pagina (<b>reflow</b>), poi si rimette la classe. Senza quella riga il browser non si accorgerebbe del cambio e l'animazione non ripartirebbe.</p>`)}
${J([[804, 830]], 'livello, stato_partita, game_over, record, classifica', `
  ${tabella(['tipo', 'Cosa fa il client'], [
    ['<code>livello</code>', 'fumetto "Livello 3!" e bordo del campo del colore del nuovo livello'],
    ['<code>stato_partita</code>', '<code>aggiornaStato(msg)</code>: cuori, punti, quadrati, livello'],
    ['<code>game_over</code>', '<code>mostraGameOver(msg)</code>: schermata di fine partita'],
    ['<code>record</code>', 'salva i record e li ridisegna nel pannello e nella schermata Classifiche (si aggiorna anche se è aperta)'],
    ['<code>classifica</code>', 'aggiorna "Connessi: N" e ridisegna la classifica della sfida'],
  ])}
  <p>Come si vede, molti casi chiamano una funzione: così <code>onmessage</code> resta leggibile e il lavoro vero sta nelle funzioni del § 6.</p>`)}
${J([[832, 851]], 'vittoria e nuova_partita', `
  <p><b>vittoria</b>: nasconde il quadrato, scrive "Hai vinto!" oppure "Ha vinto Marco" (ternario sul confronto <code>msg.id === mioId</code>), colora il titolo, mostra la schermata togliendo
  <code>nascosto</code> e fa partire il conto alla rovescia con i secondi mandati dal server.</p>
  <p><b>nuova_partita</b>: rimette <code>nascosto</code>, ferma il conto (<code>clearInterval</code>) e mostra "Nuova partita! Via!".</p>`)}

<h2 class="nuova"><span class="num">6</span>JavaScript § 5: eventi dell'utente</h2>
${J([[857, 871]], 'Il click sul quadrato e il nome', `
  <p><code>addEventListener('pointerdown', ...)</code>: <code>pointerdown</code> scatta appena si preme il mouse o si tocca lo schermo, prima di <code>click</code> (che aspetta il rilascio). In un gioco di velocità conta.</p>
  <p>Se il quadrato è già preso non manda niente. Altrimenti invia <code>{ tipo: 'click', numero: numeroQuadrato }</code>: <b>solo il numero</b>, nessun punteggio. Sarà il server a decidere se vale.</p>
  <p>Il nome si conferma con il pulsante Continua oppure con <b>Invio</b>: l'evento <code>keydown</code> controlla <code>evento.key === 'Enter'</code>. In entrambi i casi si chiama la stessa funzione <code>entraInPartita</code>
  (passata <b>senza parentesi</b>: la chiamerà il browser al momento del click).</p>`,
  'Il client manda solo { tipo: "click", numero }: punti e vite li decide il server.')}
${J([[874, 898]], 'Pulsanti del menu e degli altri schermi', `
  <p><code>document.querySelectorAll('[data-modalita]')</code> trova tutti gli elementi con l'attributo <code>data-modalita</code>; con <code>forEach</code> a ognuno si collega lo stesso evento.
  <code>pulsante.dataset.modalita</code> legge <code>data-modalita</code>, <code>dataset.difficolta</code> legge <code>data-difficolta</code> (che non c'è nei pulsanti Sfida e Infinita: <code>|| null</code>).</p>
  <p>Gli altri pulsanti: Menu → <code>tornaAlMenu</code>; Classifiche (nell'intestazione e nel menu) → <code>mostraClassifiche</code>; Chiudi → rimette <code>nascosto</code>;
  Rigioca → <code>scegliModalita</code> con la stessa modalità e difficoltà di prima.</p>`)}
${J([[901, 915]], 'Il pulsante della musica', `
  <p><code>audio.paused</code> dice se la musica è ferma. <code>audio.play()</code> restituisce una <b>Promise</b> (un risultato che arriverà più tardi): se il browser non riesce a riprodurre,
  <code>.catch()</code> mostra un avviso invece di dare un errore. L'icona cambia modificando l'<code>href</code> dell'elemento <code>&lt;use&gt;</code>.</p>`)}

<h2><span class="num">7</span>JavaScript § 6: le funzioni</h2>
${J([[920, 933]], 'entraInPartita', `
  <p>Se la connessione non è aperta (<code>readyState !== WebSocket.OPEN</code>) esce. Altrimenti legge il nome (<code>trim</code> toglie gli spazi), lo manda al server con <code>{ tipo: 'nome' }</code>,
  lo scrive nell'intestazione (solo se non è vuoto) e passa dalla schermata del nome al menu, aggiungendo e togliendo la classe <code>nascosto</code>.</p>`)}
${J([[936, 963]], 'scegliModalita', `
  <p>Ricorda modalità e difficoltà, chiede al server di iniziare (<code>{ tipo: 'modalita', modalita, difficolta }</code>), chiude menu e game over, mostra il pulsante Menu e pulisce il campo.</p>
  <p><code>classList.toggle(classe, condizione)</code>: <b>aggiunge</b> la classe se la condizione è vera, la <b>toglie</b> se è falsa. Così, in tre righe:</p>
  <ul>
    <li><code>pannelloSfida</code> è nascosto se la modalità <b>non</b> è sfida;</li>
    <li><code>pannelloSolo</code> è nascosto se la modalità <b>è</b> sfida;</li>
    <li>la riga del livello è nascosta se non è infinita.</li>
  </ul>
  <p>Infine titolo e icona del pannello (con il ternario) e i record della modalità scelta.</p>`,
  'classList: add (aggiunge), remove (toglie), toggle(classe, condizione) (aggiunge o toglie), contains (controlla).')}
${J([[966, 992]], 'tornaAlMenu e pulisciCampo', `
  <p><b>tornaAlMenu</b> manda <code>{ tipo: 'esci' }</code> (il server ferma la partita), azzera la modalità, pulisce il campo, nasconde il pulsante Menu e le schermate di fine partita, mostra il menu.</p>
  <p><b>pulisciCampo</b> riporta il campo allo stato iniziale: quadrato nascosto, <code>numeroQuadrato = 0</code>, barra ferma, bordo normale (<code>''</code> = torna lo stile del CSS).</p>`)}
${J([[995, 1028]], 'aggiornaStato: cuori e statistiche', `
  <p>Costruisce una stringa con un'icona cuore per ogni vita iniziale (<code>viteMax</code>): con il ciclo <code>for</code>, i cuori con indice minore delle vite rimaste ricevono la classe <code>piena</code> (rossi).
  Esempio con 3 vite iniziali e 2 rimaste: ❤ ❤ ♡.</p>
  <p>La inserisce con <code>innerHTML</code>, che interpreta il testo come HTML. Qui è sicuro perché il testo è scritto da noi, non dall'utente.</p>
  <p>Nell'infinita mostra il livello, quanti quadrati mancano (singolare/plurale), la barra di avanzamento e il colore del livello. La larghezza della barra:
  <code>(perLivello − mancanti) / perLivello × 100</code>. Esempio: mancano 7 → (10 − 7) / 10 × 100 = <b>30%</b>.
  Nella modalità difficoltà la terza statistica mostra invece le vite.</p>`)}
${J([[1031, 1044]], 'mostraGameOver', `
  <p>Scrive punti, quadrati e livello (nella modalità difficoltà un trattino). Se la posizione è ≥ 0 scrive "Nuovo record: N° posto!" con <code>posizione + 1</code>, perché il server conta da 0. Poi mostra la schermata.</p>`)}
${J([[1047, 1101]], 'Record e classifiche: aggiornaRecord, disegnaClassifiche, riempiListaRecord', `
  <ul>
    <li><b>aggiornaRecord</b>: sceglie la lista da mostrare (<code>'infinita'</code> o la difficoltà in corso), scrive il titolo e chiama <code>riempiListaRecord</code> per il pannello laterale.</li>
    <li><b>mostraClassifiche</b> / <b>disegnaClassifiche</b>: per ognuna delle quattro chiavi riempie la lista <code>classifica-...</code> della schermata Classifiche.</li>
    <li><b>riempiListaRecord(lista, chiave)</b>: una sola funzione usata in entrambi i posti (niente codice ripetuto). Svuota la lista (<code>innerHTML = ''</code>), se non ci sono record scrive "Nessun record",
    poi per ogni record crea un <code>&lt;li&gt;</code> con posizione, nome e punti (nell'infinita anche il livello) e lo aggiunge con <code>appendChild</code>. <code>append</code> accetta più elementi insieme.</li>
  </ul>
  <p><b>Sicurezza (XSS)</b>: il nome è scritto dall'utente, quindi viene inserito con <code>textContent</code> (dentro <code>creaElemento</code>), mai con <code>innerHTML</code>. Se qualcuno si chiamasse
  <code>&lt;img src=x onerror=...&gt;</code>, apparirebbe come testo e non verrebbe eseguito.</p>`,
  'innerHTML interpreta HTML (va bene solo per testo nostro); textContent mostra sempre testo semplice (sicuro per i dati degli utenti).')}
${J([[1104, 1150]], 'aggiornaClassifica e creaElemento', `
  <p><b>aggiornaClassifica</b> ridisegna la classifica della sfida: per ogni giocatore (già ordinati dal server) crea una riga con posizione, quadratino del suo colore, nome, barra e punti.
  Se la riga sono io, aggiunge la classe <code>io</code> (contorno giallo). La barra è larga <code>punti / puntiPerVincere × 100</code>%: con 4 punti su 10 → 40%.</p>
  <p><b>creaElemento(tag, classe, testo)</b>: funzione di aiuto che crea un elemento con <code>document.createElement</code>, gli dà la classe e il testo e lo restituisce. Evita di ripetere tre righe ogni volta.</p>`)}
${J([[1153, 1174]], 'La barra del tempo', `
  <p>La barra deve svuotarsi in <b>esattamente</b> il tempo concesso dal server. Si usa una <b>transizione CSS</b>:</p>
  <ol>
    <li>transizione disattivata e larghezza 100% (la barra si riempie di colpo);</li>
    <li><code>void barraTempo.offsetWidth</code>: obbliga il browser a "registrare" il 100% (stesso trucco del reflow visto per <code>mancato</code>);</li>
    <li>transizione <code>width durata ms linear</code> e larghezza 0%: il browser anima la barra da 100% a 0% a velocità costante, nel tempo indicato.</li>
  </ol>
  <p>Senza il passo 2 il browser unirebbe i cambi e la barra non ripartirebbe da piena. <b>fermaBarraTempo</b> toglie la transizione e porta la larghezza a 0.</p>`)}
${J([[1177, 1204]], 'mostraMessaggio e il conto alla rovescia', `
  <p><b>mostraMessaggio(testo, icona)</b>: scrive il testo, sceglie l'icona componendo l'id (<code>'stella'</code> → <code>'#i-stella'</code>) e mostra il fumetto. Prima di avviare il nuovo
  <code>setTimeout</code> di 1,5 s annulla quello vecchio con <code>clearTimeout</code>: se arrivano due messaggi di fila, il secondo resta visibile per 1,5 s pieni invece di sparire troppo presto.</p>
  <p><b>avviaContoAllaRovescia(secondi)</b>: con <code>setInterval</code> ogni 1000 ms toglie un secondo e aggiorna il numero; <code>Math.max(secondi, 0)</code> evita numeri negativi.
  Viene fermato con <code>clearInterval</code> quando arriva <code>nuova_partita</code>.</p>`)}

<h2 class="nuova"><span class="num">★</span>Riassunto: cosa succede quando…</h2>
${tabella(['Azione', 'Nel client (index.html)', 'Nel server'], [
  ['Apro la pagina', '<code>new WebSocket(...)</code> → <code>onopen</code>: Continua abilitato', 'evento <code>connection</code>, invia <code>benvenuto</code>'],
  ['Scrivo il nome e premo Invio', '<code>entraInPartita</code>: invia <code>nome</code>, mostra il menu', 'salva <code>ws.nome</code>'],
  ['Scelgo una modalità', '<code>scegliModalita</code>: invia <code>modalita</code>, mostra il pannello giusto', 'avvia la sfida o la partita singola'],
  ['Arriva un quadrato', '<code>onmessage</code> tipo <code>quadrato</code>: percentuale → pixel, barra del tempo', 'lo ha inviato <code>setInterval</code> o <code>prossimoQuadrato</code>'],
  ['Premo sul quadrato', '<code>pointerdown</code>: invia <code>{ click, numero }</code>', 'controlla e risponde <code>preso</code>'],
  ['Non faccio in tempo', 'tipo <code>mancato</code>: campo che trema, un cuore si svuota', 'il <code>setTimeout</code> è scaduto: − 1 vita'],
  ['Finisco le vite', 'tipo <code>game_over</code>: schermata con punti e record', '<code>finePartita</code>, <code>record.aggiungi</code>'],
  ['Premo Menu', '<code>tornaAlMenu</code>: invia <code>esci</code>', '<code>fermaPartita</code>'],
])}

<h2><span class="num">?</span>Domande probabili su index.html</h2>
${domande([
  ['Come si collega il client al server?', 'Con <code>new WebSocket(location.origin.replace(/^http/, \'ws\'))</code>: prende l\'indirizzo da cui è arrivata la pagina e cambia "http" in "ws". Funziona da qualsiasi PC della rete senza scrivere l\'IP nel codice.'],
  ['Come capisce il client che tipo di messaggio è arrivato?', 'Ogni messaggio JSON ha il campo <code>tipo</code>; in <code>onmessage</code> dopo <code>JSON.parse</code> una catena di <code>if / else if</code> sceglie cosa fare.'],
  ['Perché il server manda la posizione in percentuale?', 'Ogni giocatore ha un campo di grandezza diversa. Il client calcola <code>(larghezza campo − lato) × x / 100</code>, così il quadrato è sempre dentro il campo.'],
  ['Cosa manda il client quando clicco il quadrato?', 'Solo <code>{ tipo: \'click\', numero }</code>. Non manda punti: è il server a decidere se il click vale.'],
  ['Perché pointerdown e non click?', '<code>pointerdown</code> scatta appena si preme (mouse o dito), <code>click</code> aspetta il rilascio: in un gioco di velocità si guadagnano millisecondi.'],
  ['Come mostrate e nascondete le schermate?', 'Con la classe CSS <code>nascosto</code> (<code>display: none !important</code>), aggiunta e tolta con <code>classList.add/remove/toggle</code>.'],
  ['A cosa servono gli attributi data-modalita e data-difficolta?', 'Memorizzano nell\'HTML la modalità di ogni pulsante. <code>querySelectorAll(\'[data-modalita]\')</code> li trova tutti e <code>dataset</code> li legge: un solo <code>forEach</code> gestisce tutti i pulsanti.'],
  ['Perché textContent e non innerHTML per i nomi?', 'I nomi li scrivono gli utenti: con <code>innerHTML</code> un nome con codice HTML verrebbe interpretato (attacco XSS). <code>textContent</code> lo mostra sempre come testo.'],
  ['Come funziona la barra del tempo?', 'Si porta a 100% senza transizione, si forza il ricalcolo con <code>offsetWidth</code>, poi una transizione CSS lineare la porta a 0% in esattamente <code>durata</code> millisecondi.'],
  ['Perché c\'è "void campo.offsetWidth"?', 'Leggere <code>offsetWidth</code> obbliga il browser a ricalcolare la pagina (reflow): così togliere e rimettere la classe <code>errore</code> fa ripartire l\'animazione da capo.'],
  ['Come sono fatte le icone?', 'Sono <code>&lt;symbol&gt;</code> SVG definiti una volta in un <code>&lt;svg&gt;</code> invisibile e richiamati con <code>&lt;use href="#i-nome"&gt;</code>. Per cambiarle si cambia l\'<code>href</code> con <code>setAttribute</code>.'],
  ['Cos\'è una Promise in audio.play()?', 'Un oggetto che rappresenta un risultato futuro: <code>play()</code> può riuscire o fallire più tardi; con <code>.catch()</code> gestiamo il fallimento mostrando un avviso.'],
  ['Perché il pulsante Continua è disabilitato all\'inizio?', 'Finché il WebSocket non è aperto non si può mandare il nome. In <code>onopen</code> mettiamo <code>disabled = false</code>.'],
  ['Cosa fa la pagina se il server si spegne?', 'Scatta <code>onclose</code>: stato "Disconnesso" con pallino rosso, quadrato nascosto e messaggio "Connessione persa: ricarica la pagina".'],
])}

<h2><span class="num">A–Z</span>Glossario</h2>
<div class="glossario">
  <p><b>classList</b>: elenco delle classi CSS di un elemento, con <code>add</code>, <code>remove</code>, <code>toggle</code>, <code>contains</code>.</p>
  <p><b>data URI</b>: un file scritto direttamente nell'indirizzo (qui l'icona della scheda).</p>
  <p><b>dataset</b>: legge gli attributi <code>data-...</code> di un elemento.</p>
  <p><b>DOM</b>: la pagina vista da JavaScript come albero di oggetti modificabili.</p>
  <p><b>Evento</b>: qualcosa che succede (click, tasto, messaggio) a cui si collega una funzione.</p>
  <p><b>Flexbox / Grid</b>: sistemi CSS per disporre gli elementi in riga/colonna (flex) o in griglia (grid).</p>
  <p><b>innerHTML / textContent</b>: inseriscono contenuto come HTML / come testo semplice.</p>
  <p><b>Overlay</b>: schermata sovrapposta a tutta la pagina.</p>
  <p><b>Promise</b>: risultato che arriverà in futuro (riuscito o fallito).</p>
  <p><b>Reflow</b>: ricalcolo delle posizioni della pagina da parte del browser.</p>
  <p><b>Stile inline</b>: stile messo con <code>elemento.style</code>; vince sulle regole del CSS tranne quelle con <code>!important</code>.</p>
  <p><b>Transizione CSS</b>: cambio graduale di una proprietà (es. <code>width</code>) in un certo tempo.</p>
  <p><b>Variabile CSS</b>: <code>--nome</code>, letta con <code>var(--nome, riserva)</code>.</p>
  <p><b>XSS</b>: attacco che inserisce codice in una pagina attraverso i dati degli utenti.</p>
</div>`;
  return pagina('Studio - index.html', corpo);
}

// ---------------------------------------------------------------- scrittura e stampa
const guide = [
  ['studio-server.html', guidaServer(), 'Studio - server.js - Acchiappa il quadrato.pdf'],
  ['studio-record.html', guidaRecord(), 'Studio - record.js - Acchiappa il quadrato.pdf'],
  ['studio-index.html', guidaIndex(), 'Studio - index.html - Acchiappa il quadrato.pdf'],
];
for (const [file, html] of guide) {
  fs.writeFileSync(path.join(QUI, file), html);
  console.log('creato', file);
}

const chrome = [
  path.join(os.homedir(), 'Desktop', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!chrome) { console.log('Chrome non trovato: aprire gli HTML e stampare in PDF a mano'); process.exit(0); }
const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
for (const [file, , pdf] of guide) {
  execFileSync(chrome, ['--headless=new', `--user-data-dir=${profilo}`, '--no-pdf-header-footer',
    `--print-to-pdf=${path.join(DOC, pdf)}`, 'file://' + path.join(QUI, file)], { stdio: 'ignore' });
  console.log('creato', pdf);
}
fs.rmSync(profilo, { recursive: true, force: true });
