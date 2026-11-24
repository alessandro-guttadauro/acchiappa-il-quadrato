// Rigenera i due PDF della documentazione:
//   node "documentazione/sorgenti/genera_pdf.js"
// 1) costruisce spiegazione.html prendendo il codice VERO da server.js, record.js e index.html
// 2) stampa manuale.html e spiegazione.html in PDF con Google Chrome (headless)
// (strumento di supporto per il gruppo: NON fa parte dell'applicazione da consegnare)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const QUI = __dirname;
const DOC = path.join(QUI, '..');
const APP = path.join(QUI, '..', '..', 'acchiappa-il-quadrato');

const server = fs.readFileSync(path.join(APP, 'server.js'), 'utf8');
const moduloRecord = fs.readFileSync(path.join(APP, 'record.js'), 'utf8');
const index = fs.readFileSync(path.join(APP, 'public', 'index.html'), 'utf8');

// ---------- estrazione del codice ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function pulisci(testo) {
  return testo.split('\n')
    .filter((r) => !/^\s*\/\//.test(r))            // righe di solo commento JS
    .filter((r) => !/^\s*<!--.*-->\s*$/.test(r))    // righe di solo commento HTML
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');
}
function sezioni(testo, regex) {
  const righe = testo.split('\n');
  const out = {};
  let corrente = null;
  for (const r of righe) {
    const m = r.match(regex);
    if (m) { corrente = m[1]; out[corrente] = []; continue; }
    if (corrente) out[corrente].push(r);
  }
  for (const k in out) out[k] = pulisci(out[k].join('\n'));
  return out;
}
// toglie il rientro comune a tutte le righe (dedent), così il codice parte dal margine sinistro
function dedent(s) {
  const righe = s.split('\n');
  const min = Math.min(...righe.filter((r) => r.trim()).map((r) => r.match(/^ */)[0].length));
  return righe.map((r) => r.slice(min)).join('\n');
}
const codice = (s) => `<pre><code>${esc(dedent(s))}</code></pre>`;

const S = sezioni(server, /^\/\/ \* (\d)\./);
const R = pulisci(moduloRecord);
const script = index.slice(index.indexOf('<script>') + 8, index.indexOf('</script>'));
const C = sezioni(script, /^\s*\/\/ \* --- (\d)\./);
const corpo = pulisci(index.slice(index.indexOf('<body>'), index.indexOf('<!-- ===', index.indexOf('<body>'))))
  // il blocco delle icone SVG è lungo (sono solo disegni): nel PDF lo riassumiamo in una riga
  .replace(/<svg width="0"[\s\S]*?\n\s*<\/svg>/, '<svg width="0" height="0" style="position: absolute"> ... 15 icone <symbol id="i-..."> ... </svg>')
  // anche le schermate sovrapposte sono lunghe: nel PDF teniamo solo l'intestazione e il pannello di gioco
  .replace(/\n\s*<div id="schermata-modalita"[\s\S]*$/, '\n    ... schermate sovrapposte: menu delle modalità, vittoria della sfida, game over ...\n    <audio id="audio" src="/musica" loop preload="none"></audio>');

// ---------- contenuti ----------
const blocchiServer = [
  ['1', 'Importazione dei moduli', `
    <p>Con <code>require()</code> carichiamo i moduli. Ce ne sono di tre tipi:</p>
    <ul>
      <li><b>esterni</b> (<code>express</code>, <code>ws</code>): li installa <code>npm install</code> nella cartella <code>node_modules</code> e sono elencati nelle <code>dependencies</code> del <code>package.json</code>;</li>
      <li><b>interni</b> (<code>fs</code>, <code>path</code>, <code>os</code>): fanno già parte di Node.js;</li>
      <li><b>nostri</b> (<code>require('./record')</code>): il <code>./</code> indica un file del progetto, cioè il modulo <code>record.js</code> scritto da noi (vedi capitolo 5).</li>
    </ul>
    <p><code>const { Server } = require('ws')</code> è una <b>destrutturazione</b>: dal modulo prendiamo solo la classe <code>Server</code>, come negli esempi del prof.</p>`,
    'ws_socket_00 → 08 (require di express e ws), ws_socket_09 (fs)'],
  ['2', 'Costanti di configurazione', `
    <p>Tutte le regole del gioco stanno qui, in un punto solo. <code>process.env.PORT || 3000</code> legge una <b>variabile d'ambiente</b> (se manca usa 3000).</p>
    <p>L'oggetto <code>DIFFICOLTA</code> descrive le tre difficoltà con <b>vite</b>, <b>tempo</b> per cliccare in millisecondi e <b>dimensione</b> del quadrato in pixel:
    Facile 3 vite / 1400 ms / 80 px, Difficile 2 / 900 / 56, Impossibile 1 / 550 / 38. Lo stesso oggetto viene mandato al client nel <code>benvenuto</code>,
    così i pulsanti del menu mostrano sempre i valori veri (una sola "fonte" dei dati).</p>
    <p>Per la modalità infinita: 3 vite, si sale di livello ogni <code>QUADRATI_PER_LIVELLO = 10</code> quadrati, <code>PUNTI_BASE = 40</code> e un colore per ogni livello.</p>`,
    'ws_socket_04 (array colori)'],
  ['3', 'Stato della sfida', `
    <p>Il server è l'<b>unico arbitro</b>: conserva lo stato della sfida (quale quadrato è in campo, se è già stato preso, se siamo in pausa).
    I client mostrano solo quello che ricevono, così nessuno può "barare" modificando la pagina. <code>record.carica()</code> legge all'avvio i record salvati.</p>`,
    'ws_socket_04 (variabile quale), ws_socket_03 (contatore tc)'],
  ['4', 'Express: middleware, rotte e avvio del server HTTP', `
    <p><b>Middleware</b>: funzione <code>(req, res, next)</code> eseguita per ogni richiesta, <b>nell'ordine in cui è scritta</b>. Il logger stampa la richiesta e chiama <code>next()</code>.</p>
    <p><code>express.static('public')</code> serve i file della cartella <code>public</code> (il prof usava <code>res.sendFile</code>: il risultato è lo stesso).</p>
    <p><b><code>GET /musica</code></b>: streaming del file audio con <code>fs.createReadStream().pipe(res)</code>, che invia il file a pezzi senza caricarlo tutto in memoria.
    <b><code>GET /api/classifica</code></b> e <b><code>GET /api/record</code></b> rispondono in JSON con <code>res.json()</code>.
    L'ultimo middleware risponde 404. <code>app.listen()</code> restituisce il server HTTP, a cui agganciamo il WebSocket.</p>`,
    'ws_socket_00 → 08 (express + sendFile + listen), ws_socket_09 (createReadStream, pipe, writeHead)'],
  ['5', 'Server WebSocket ed eventi', `
    <p><code>new Server({ server })</code> aggancia il WebSocket al server HTTP: <b>stessa porta 3000</b>. Il browser chiede l'<code>Upgrade: websocket</code>, il server risponde
    <code>101 Switching Protocols</code> e la connessione resta aperta in entrambe le direzioni.</p>
    <ul>
      <li><b>connection</b>: salviamo nell'oggetto <code>ws</code> id, colore, nome, <b>modalità</b> (<code>null</code> = nel menu), punti della sfida e <b>partita</b> singola;
      mandiamo a lui <code>benvenuto</code> e <code>record</code>, a tutti la classifica.</li>
      <li><b>message</b>: <code>JSON.parse</code> dentro <code>try/catch</code>, poi in base a <code>tipo</code>: <code>nome</code>, <code>modalita</code> (sceglie Sfida, Difficoltà o Infinita),
      <code>click</code> (smistato a <code>clickSfida</code> o <code>clickSingolo</code>), <code>esci</code> (torna al menu).</li>
      <li>La difficoltà ricevuta viene controllata con <code>Object.keys(DIFFICOLTA).includes(...)</code>: accettiamo solo <code>facile</code>, <code>difficile</code> o <code>impossibile</code>.</li>
      <li><b>close</b>: <code>fermaPartita(ws)</code> annulla i timer della partita singola, poi aggiorniamo la classifica. <b>error</b>: gestito per non bloccare il server.</li>
    </ul>`,
    'ws_socket_03 (on message), ws_socket_04/05 (ws.id), ws_socket_06/07 (JSON in arrivo), ws_socket_08 (close + numero connessi)'],
  ['6', 'Sfida: ciclo di gioco', `
    <p><code>setInterval</code> sposta il quadrato della sfida ogni 1200 ms: è il server che "spinge" i dati (push). Se siamo in pausa o <b>nessuno sta giocando la sfida</b>
    (<code>giocatoriSfida().length === 0</code>) la funzione esce subito.</p>`,
    'ws_socket_00 → 04 (setInterval + invio a tutti)'],
  ['7', 'Funzioni di invio e della sfida', `
    <ul>
      <li><b>inviaA(ws, msg)</b>: invia a un solo client. <b>inviaATutti(msg)</b>: <b>broadcast</b> a tutti con <code>ws_server.clients.forEach</code>.</li>
      <li><b>giocatoriSfida()</b>: <code>Array.from</code> trasforma il Set dei client in array e <code>filter</code> tiene solo quelli con <code>modalita === 'sfida'</code>.
      <b>inviaASfida</b> manda il messaggio solo a loro: chi gioca da solo o è nel menu non riceve il quadrato della sfida.</li>
      <li><b>listaClassifica</b>: <code>map</code> trasforma i client in oggetti semplici, <code>sort</code> li ordina per punti.</li>
      <li><b>clickSfida</b>: Node gestisce i messaggi <b>uno alla volta</b> (event loop): il primo click mette <code>quadrato.preso = true</code> e i successivi vengono scartati. A 10 punti: <code>vittoria</code> e <code>setTimeout(nuovaSfida, 5000)</code>.</li>
    </ul>`,
    'ws_socket_00 → 08 (clients.forEach + send), ws_socket_08 (array dei client)'],
  ['8', 'Partite singole: Difficoltà e Infinita', `
    <p>Ogni client ha <b>la sua partita</b>, salvata in <code>ws.partita</code> (vite, punti, quadrati presi, livello, numero del quadrato, timer). Il ciclo è fatto di <code>setTimeout</code>:</p>
    <ul>
      <li><b>prossimoQuadrato</b>: manda <b>solo a quel client</b> il quadrato con posizione, <code>dimensione</code>, <code>colore</code> e <code>durata</code>, poi avvia un timer di <code>durata</code> ms.</li>
      <li>Se il timer scade prima del click scatta <b>quadratoScaduto</b>: −1 vita, messaggio <code>mancato</code>; a 0 vite <b>finePartita</b>.</li>
      <li><b>clickSingolo</b>: se il numero è giusto e il quadrato è aperto, <code>clearTimeout</code> annulla il timer (niente vita persa), aggiunge punti e prepara il quadrato successivo.</li>
    </ul>
    <p><b>Formula di Tetris (modalità infinita).</b> Ogni quadrato vale <code>40 × livello</code> punti, come una riga singola in Tetris.
    Il livello è <code>Math.floor(presi / 10) + 1</code>: si sale ogni 10 quadrati. <b>parametriInfinita(livello)</b> calcola la difficoltà:
    tempo <code>1500 × 0,88<sup>livello−1</sup></code> ms (minimo 380), lato <code>76 − 4 × (livello − 1)</code> px (minimo 34), colore preso dall'array con l'operatore <code>%</code>.
    Esempio: 25 quadrati = 10 × 40 + 10 × 80 + 5 × 120 = <b>1800 punti</b>, livello 3.</p>
    <p><b>finePartita</b> salva il risultato con <code>record.aggiungi()</code>; se è un nuovo record lo manda <b>a tutti</b> (<code>inviaATutti</code>), così la lista si aggiorna in tempo reale anche per gli altri.</p>`,
    'ws_socket_03 (click → server), ws_socket_00 → 04 (timer lato server)'],
  ['9', 'Altre funzioni', `
    <p><b>indirizziRete</b>: con <code>os.networkInterfaces()</code> trova l'IP del PC per mostrarlo nel terminale (serve per giocare da altri PC).
    Usa <code>for...in</code> (chiavi di un oggetto) e <code>for...of</code> (elementi di un array).</p>`, ''],
];

const blocchiClient = [
  ['1', 'Connessione WebSocket', `
    <p><code>location.origin.replace(/^http/, 'ws')</code> trasforma l'indirizzo della pagina (es. <code>http://192.168.1.20:3000</code>) in <code>ws://192.168.1.20:3000</code>:
    il client si collega sempre al server che gli ha dato la pagina. Lato browser l'oggetto <code>WebSocket</code> è già incluso, il modulo <code>ws</code> serve solo al server.</p>`, 'tutti gli esempi (stessa riga)'],
  ['2', 'Riferimenti agli elementi della pagina', `
    <p>Con <code>document.getElementById</code> (e <code>querySelector</code>, che accetta un selettore CSS) salviamo una volta sola i riferimenti agli elementi del DOM che useremo spesso.</p>`, 'ws_socket_01 → 08'],
  ['3', 'Variabili del client', `
    <p>Il client ricorda il proprio <b>id</b>, il <b>numero del quadrato</b> in campo, la <b>modalità</b> e la <b>difficoltà</b> in corso, la configurazione delle difficoltà ricevuta dal server, gli ultimi <b>record</b> e i timer.</p>`, ''],
  ['4', 'Eventi del WebSocket', `
    <p><code>onopen</code> abilita il pulsante, <code>onclose</code> avvisa che la connessione è persa, <code>onmessage</code> converte il testo con <code>JSON.parse</code> e sceglie cosa fare in base a <code>tipo</code>:</p>
    <ul>
      <li><code>quadrato</code>: imposta <b>grandezza</b>, <b>posizione</b> (percentuale → pixel), <b>colore</b> e bagliore (variabile CSS <code>--bagliore</code> con <code>setProperty</code>); se c'è <code>durata</code> fa partire la barra del tempo.</li>
      <li><code>preso</code>, <code>mancato</code> (il campo "trema" con un'animazione CSS), <code>livello</code> (il bordo prende il colore del livello), <code>stato_partita</code>, <code>game_over</code>, <code>record</code>, <code>classifica</code>, <code>vittoria</code>, <code>nuova_partita</code>.</li>
    </ul>`, 'ws_socket_01/02 (onmessage + style.left/top), ws_socket_08 (tipi di messaggio diversi)'],
  ['5', 'Eventi dell\'utente', `
    <p><code>pointerdown</code> sul quadrato manda solo <code>{ tipo: 'click', numero }</code>: decide il server. I pulsanti del menu hanno attributi personalizzati
    <code>data-modalita</code> e <code>data-difficolta</code>: <code>querySelectorAll('[data-modalita]')</code> li trova tutti e <code>dataset</code> ne legge i valori, così un solo
    <code>forEach</code> collega tutti i pulsanti. <code>audio.play()</code> restituisce una <b>Promise</b> gestita con <code>.catch()</code>.</p>`, 'ws_socket_03 → 08 (addEventListener + webSocket.send)'],
  ['6', 'Funzioni', `
    <ul>
      <li><b>scegliModalita</b> manda <code>{ tipo: 'modalita' }</code> e mostra il pannello giusto con <code>classList.toggle(classe, condizione)</code>; <b>tornaAlMenu</b> manda <code>esci</code>.</li>
      <li><b>aggiornaStato</b> disegna i cuori (pieni = vite rimaste) e le statistiche in stile Tetris: punti, quadrati, livello e barra verso il prossimo livello.</li>
      <li><b>mostraGameOver</b> e <b>aggiornaRecord</b>: i nomi sono scritti con <code>textContent</code>, non <code>innerHTML</code>, così un nome con codice HTML non viene eseguito (protezione XSS).</li>
      <li><b>avviaBarraTempo</b>: la barra torna al 100% senza transizione, <code>void barraTempo.offsetWidth</code> obbliga il browser a ricalcolare, poi una <b>transizione CSS</b> la porta a 0% in esattamente <code>durata</code> millisecondi.</li>
      <li><b>mostraMessaggio(testo, icona)</b> sceglie l'icona con <code>setAttribute('href', '#i-' + icona)</code>; <code>setTimeout</code>/<code>clearTimeout</code> gestiscono la durata.</li>
    </ul>`, 'ws_socket_07 (createElement)'],
];

const messaggi = [
  ['Server → un client', 'benvenuto', '{ tipo, id, colore, puntiPerVincere, difficolta }', 'appena il client si collega'],
  ['Server → un client / tutti', 'record', '{ tipo, record }', 'alla connessione e quando c\'è un nuovo record'],
  ['Client → server', 'nome', '{ tipo, nome }', 'il giocatore preme Continua'],
  ['Client → server', 'modalita', '{ tipo, modalita, difficolta }', 'sceglie la modalità o preme Rigioca'],
  ['Client → server', 'esci', '{ tipo }', 'preme Menu'],
  ['Server → sfida / un client', 'quadrato', '{ tipo, numero, x, y, dimensione, colore, durata }', 'nuovo quadrato (durata solo nelle partite singole)'],
  ['Client → server', 'click', '{ tipo, numero }', 'il giocatore preme sul quadrato'],
  ['Server → sfida / un client', 'preso', '{ tipo, numero, id, nome, colore, guadagno }', 'click valido'],
  ['Server → un client', 'mancato', '{ tipo, numero, vite }', 'il tempo è scaduto: −1 vita'],
  ['Server → un client', 'livello', '{ tipo, livello, colore }', 'ogni 10 quadrati (infinita)'],
  ['Server → un client', 'stato_partita', '{ tipo, vite, viteMax, punti, presi, livello, mancanti, ... }', 'dopo ogni cambiamento della partita singola'],
  ['Server → un client', 'game_over', '{ tipo, punti, presi, livello, posizione }', 'vite finite'],
  ['Server → tutti', 'classifica', '{ tipo, connessi, giocatori[] }', 'entra/esce qualcuno, cambia un punteggio della sfida'],
  ['Server → sfida', 'vittoria', '{ tipo, id, nome, colore, secondi }', 'qualcuno arriva a 10 punti'],
  ['Server → sfida', 'nuova_partita', '{ tipo }', '5 s dopo la vittoria'],
];

const concetti = [
  ['Moduli e require (interni / esterni / nostri)', 'server.js § 1', '00 → 09'],
  ['Modulo personalizzato con module.exports', 'record.js', '—'],
  ['fs sincrono (readFileSync) e asincrono (writeFile con callback)', 'record.js', '09 (fs)'],
  ['package.json, npm install, npm start', 'package.json', '—'],
  ['Express: app, listen con callback', 'server.js § 4', '00 → 08'],
  ['Middleware (req, res, next) e ordine', 'server.js § 4', '00 (app.use)'],
  ['File statici (express.static / sendFile)', 'server.js § 4', '00 → 08'],
  ['Rotte GET, res.json, codici di stato (200/404)', 'server.js § 4', '09 (writeHead)'],
  ['Stream: fs.createReadStream().pipe(res)', 'server.js § 4', '09'],
  ['Server ws agganciato al server HTTP', 'server.js § 5', '00 → 08'],
  ['Eventi connection / message / close / error', 'server.js § 5', '00, 03, 08'],
  ['Dati salvati sul client (ws.id, ws.modalita, ws.partita)', 'server.js § 5, § 8', '04 → 08'],
  ['send a un client, broadcast a tutti, invio a un gruppo (filter)', 'server.js § 7', '00 → 08'],
  ['Messaggi JSON con campo "tipo"', 'server.js § 5, index § 4', '02, 06, 07, 08'],
  ['Timer: setInterval (sfida) e setTimeout/clearTimeout (partite singole)', 'server.js § 6, § 8', '00 → 04'],
  ['Validazione dei dati ricevuti, try/catch', 'server.js § 5', '—'],
  ['Array: map, filter, sort, slice, indexOf, Array.from', 'server.js § 7, record.js', '08'],
  ['Variabili d\'ambiente e modulo os', 'server.js § 2, § 9', '—'],
  ['Client: new WebSocket, onopen/onmessage/onclose, send', 'index.html § 1, § 4', '00 → 08'],
  ['DOM: getElementById, createElement, addEventListener, dataset', 'index.html § 2, § 5, § 6', '03 → 08'],
];

const domande = [
  ['Che differenza c\'è tra HTTP e WebSocket?', 'In HTTP è sempre il client a chiedere e il server risponde, poi la comunicazione finisce. Il WebSocket è una connessione <b>persistente e bidirezionale</b> (full-duplex): anche il <b>server può inviare dati quando vuole</b>, come i quadrati della sfida o il messaggio "mancato" allo scadere del tempo.'],
  ['Come fanno HTTP e WebSocket a usare la stessa porta?', 'Il WebSocket parte come una richiesta HTTP con l\'intestazione <code>Upgrade: websocket</code>. Il server ws, agganciato a quello di Express con <code>new Server({ server })</code>, risponde <code>101 Switching Protocols</code> e la connessione diventa WebSocket.'],
  ['Cos\'è un middleware? A cosa serve next()?', 'È una funzione <code>(req, res, next)</code> che Express esegue per ogni richiesta, nell\'ordine in cui è registrata. Può rispondere oppure chiamare <code>next()</code> per passare al successivo. Nel nostro codice: logger, <code>express.static</code>, 404.'],
  ['Cos\'è record.js e come lo usate?', 'È un <b>modulo scritto da noi</b>. Esporta tre funzioni con <code>module.exports = { carica, aggiungi, elenco }</code> e <code>server.js</code> lo importa con <code>require(\'./record\')</code>. Le funzioni non esportate (<code>salva</code>) restano private al modulo.'],
  ['Perché readFileSync in un punto e writeFile nell\'altro?', '<code>readFileSync</code> è <b>sincrona</b>: blocca finché il file è letto, ma la usiamo una volta sola all\'avvio. <code>writeFile</code> è <b>asincrona</b>: il server continua a gestire i giocatori mentre scrive, e la callback avvisa quando ha finito o se c\'è un errore.'],
  ['Come funziona la modalità infinita?', 'Come Tetris: ogni 10 quadrati presi (le "righe") si sale di livello, <code>livello = Math.floor(presi / 10) + 1</code>. Ogni quadrato vale <code>40 × livello</code> punti. A ogni livello il tempo si moltiplica per 0,88 (−12%), il lato diminuisce di 4 px e il colore cambia.'],
  ['Come fa ogni giocatore ad avere la sua partita?', 'Lo stato è salvato in <code>ws.partita</code>, dentro l\'oggetto della connessione di quel client, con il suo timer <code>setTimeout</code>. I messaggi della partita vanno solo a lui con <code>inviaA(ws, ...)</code>.'],
  ['Come si perde una vita?', 'Quando il server manda un quadrato avvia un <code>setTimeout</code> di <code>durata</code> ms. Se il click arriva prima, <code>clearTimeout</code> annulla il timer; altrimenti scatta <code>quadratoScaduto</code>, che toglie una vita e manda <code>mancato</code>.'],
  ['Cosa succede ai timer se il giocatore chiude la pagina?', 'Nell\'evento <code>close</code> chiamiamo <code>fermaPartita(ws)</code>, che fa <code>clearTimeout</code> e cancella la partita: altrimenti i timer continuerebbero a girare per un client che non c\'è più.'],
  ['Come evitate che chi gioca da solo riceva il quadrato della sfida?', 'Ogni client ha <code>ws.modalita</code>. <code>giocatoriSfida()</code> filtra i client con <code>modalita === \'sfida\'</code> e <code>inviaASfida</code> manda i messaggi solo a loro.'],
  ['Perché controllate la difficoltà con Object.keys(...).includes?', 'Il messaggio arriva dal client e potrebbe contenere qualsiasi cosa. Accettiamo solo le chiavi <code>facile</code>, <code>difficile</code>, <code>impossibile</code>: un valore come <code>constructor</code> non deve essere preso per una difficoltà.'],
  ['Se due giocatori della sfida cliccano quasi insieme, chi prende il punto?', 'Quello il cui messaggio arriva prima: Node gestisce gli eventi uno alla volta (event loop su un solo thread). Il primo click mette <code>quadrato.preso = true</code> e gli altri vengono ignorati.'],
  ['Perché è il server a decidere punti e vite?', 'Perché il codice del client si può modificare dal browser: se decidesse il client si potrebbe barare. Il server è l\'unico arbitro.'],
  ['Cos\'è uno stream e perché lo usate per la musica?', 'Un flusso di dati letto a pezzi: <code>fs.createReadStream()</code> legge il file un pezzo alla volta e <code>pipe(res)</code> lo invia mentre legge, senza caricare tutto in memoria.'],
  ['Perché textContent e non innerHTML per i nomi?', 'Con <code>innerHTML</code> un nome contenente codice HTML verrebbe interpretato (rischio XSS); <code>textContent</code> lo mostra sempre come testo.'],
  ['Come si gioca da un altro PC?', 'Tutti sulla stessa rete; dagli altri PC si apre <code>http://IP-del-server:3000</code>. L\'IP lo stampa il server all\'avvio grazie al modulo <code>os</code>. Il firewall deve permettere le connessioni a Node.js.'],
];

// ---------- HTML ----------
const blocco = (n, titolo, testo, esempio, cod) => `
  <div class="blocco">
    <h3><span class="sez">§ ${n}</span> ${titolo}</h3>
    ${cod}
    <div class="spiega">${testo}${esempio ? `<p class="rif"><svg class="ico"><use href="#i-graffetta"/></svg> Negli esempi del prof: ${esempio}</p>` : ''}</div>
  </div>`;

const html = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><title>Acchiappa il quadrato - Spiegazione del codice</title>
<style>
  @page { size: A4; margin: 16mm 15mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Helvetica Neue", "Segoe UI", Roboto, sans-serif; color: #23262f; font-size: 10.2pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 24pt; margin: 0; letter-spacing: -0.5px; }
  h1 span { color: #f9ca24; }
  h2 { font-size: 15pt; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 2.5px solid #f9ca24; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 0 0 2mm; break-after: avoid; }
  .sez { display: inline-block; background: #1e2233; color: #f9ca24; border-radius: 1.5mm; padding: 0.3mm 2mm; font-size: 9pt; margin-right: 1.5mm; }
  p { margin: 0 0 2mm; }
  ul { margin: 0 0 2mm; padding-left: 5mm; } li { margin-bottom: 1.2mm; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 8.6pt; background: #f2f3f7; border: 1px solid #e3e5ec; border-radius: 1mm; padding: 0 1mm; }
  pre { margin: 0 0 3mm; background: #1e2233; color: #e8eaf6; border-radius: 2.5mm; padding: 3mm 4mm; white-space: pre-wrap; word-break: break-word; }
  pre code { background: none; border: none; padding: 0; color: inherit; font-size: 7.9pt; line-height: 1.5; }
  .copertina { background: #1e2233; color: #fff; border-radius: 4mm; padding: 10mm 10mm 8mm; margin-bottom: 7mm; }
  .copertina .sotto { color: #c8cbe0; margin-top: 2mm; font-size: 11pt; }
  .copertina .chi { margin-top: 5mm; font-size: 9.5pt; color: #c8cbe0; }
  .box { background: #f6f7fb; border: 1px solid #e3e5ec; border-radius: 3mm; padding: 4mm 5mm; margin-bottom: 5mm; }
  .box.giallo { background: #fff8db; border-color: #f3dd85; }
  .capitolo { break-before: page; }
  .blocco { margin-bottom: 6mm; }
  .spiega { padding-left: 1mm; }
  .rif { color: #5d6475; font-size: 9pt; font-style: italic; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 5mm; }
  th, td { text-align: left; padding: 1.7mm 2.4mm; border-bottom: 1px solid #e3e5ec; vertical-align: top; }
  th { background: #f6f7fb; font-size: 8.4pt; text-transform: uppercase; color: #5d6475; letter-spacing: 0.3px; }
  tr { break-inside: avoid; }
  .dir { white-space: nowrap; font-weight: 600; }
  .albero { font-family: "SF Mono", Menlo, monospace; font-size: 8.8pt; line-height: 1.6; white-space: pre; }
  .domanda { break-inside: avoid; margin-bottom: 3.5mm; padding: 3mm 4mm; border: 1px solid #e3e5ec; border-left: 4px solid #f9ca24; border-radius: 2mm; }
  .domanda b.q { display: block; margin-bottom: 1mm; }
  svg text { font-family: -apple-system, "Helvetica Neue", sans-serif; }
  .ico { width: 1.1em; height: 1.1em; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -0.17em; }
  .ico.logo { color: #f9ca24; width: 0.95em; height: 0.95em; margin-right: 3mm; vertical-align: -0.12em; }
</style></head><body>
<svg width="0" height="0" style="position:absolute">
  <symbol id="i-bersaglio" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></symbol>
  <symbol id="i-graffetta" viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></symbol>
</svg>

<div class="copertina">
  <h1><svg class="ico logo"><use href="#i-bersaglio"/></svg>Acchiappa il <span>quadrato</span></h1>
  <div class="sotto">Spiegazione del codice · guida allo studio per la presentazione</div>
  <div class="chi">Gentile · Guttadauro · Pavoni — 5A Informatica — TPSIT 2026/27</div>
</div>

<div class="box giallo">
  <b>Come usare questa guida.</b> Nel codice (VS Code) ogni riga ha già il suo commento. Qui invece il codice è spiegato <b>a blocchi</b>:
  per ogni blocco c'è il codice (senza commenti, per leggerlo più facilmente), la spiegazione e l'esempio del prof da cui deriva.
  In fondo trovate la <b>mappa dei concetti</b> e le <b>domande probabili all'interrogazione</b> con le risposte.
  I numeri <b>§</b> corrispondono alle sezioni segnate nei file (<code>// * 1.</code>, <code>// * --- 1.</code>).
</div>

<h2>1. Struttura del progetto e modalità</h2>
<div class="box"><div class="albero">acchiappa-il-quadrato/
├── package.json        dati del progetto, dipendenze (express, ws) e script "npm start"
├── server.js           SERVER: Express (HTTP) + WebSocket (ws) + logica delle tre modalità
├── record.js           MODULO NOSTRO: legge e salva i record (module.exports)
├── record.json         i record salvati (si crea da solo giocando)
├── public/
│   └── index.html      CLIENT: pagina del gioco (HTML + CSS + JavaScript)
├── musica/
│   └── sottofondo.wav  musica inviata in streaming dalla rotta GET /musica
└── node_modules/       moduli installati da "npm install" (non si consegna)</div></div>
<table>
  <tr><th>Modalità</th><th>Giocatori</th><th>Regole</th></tr>
  <tr><td><b>Sfida</b></td><td>tutti insieme</td><td>un quadrato uguale per tutti ogni 1,2 s; il primo click vale 1 punto; vince chi arriva a 10</td></tr>
  <tr><td><b>Difficoltà</b></td><td>da soli</td><td>Facile 3 vite / 1,4 s / 80 px · Difficile 2 / 0,9 s / 56 px · Impossibile 1 / 0,55 s / 38 px; quadrato mancato = −1 vita</td></tr>
  <tr><td><b>Infinita</b></td><td>da soli</td><td>3 vite; ogni 10 quadrati +1 livello (più veloce, più piccolo, nuovo colore); punti = 40 × livello</td></tr>
</table>

<h2>2. Architettura</h2>
<svg viewBox="0 0 700 268" width="100%" style="margin-bottom:4mm">
  <defs><marker id="f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5d6475"/></marker></defs>
  ${[0, 1, 2].map((i) => `<g transform="translate(10,${20 + i * 75})"><rect width="170" height="56" rx="10" fill="#f6f7fb" stroke="#c9ccd8"/>
    <text x="85" y="24" text-anchor="middle" font-size="13" font-weight="700" fill="#23262f">Browser ${i + 1}</text>
    <text x="85" y="42" text-anchor="middle" font-size="11" fill="#5d6475">index.html + new WebSocket</text></g>`).join('')}
  <rect x="440" y="15" width="250" height="220" rx="14" fill="#1e2233"/>
  <text x="565" y="42" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">server.js · Node.js · porta 3000</text>
  <rect x="460" y="58" width="210" height="62" rx="9" fill="#2d3250"/>
  <text x="565" y="83" text-anchor="middle" font-size="13" font-weight="700" fill="#f9ca24">Express (HTTP)</text>
  <text x="565" y="102" text-anchor="middle" font-size="11" fill="#c8cbe0">pagina, /musica, /api/...</text>
  <rect x="460" y="132" width="210" height="88" rx="9" fill="#2d3250"/>
  <text x="565" y="157" text-anchor="middle" font-size="13" font-weight="700" fill="#f9ca24">WebSocket (ws)</text>
  <text x="565" y="176" text-anchor="middle" font-size="11" fill="#c8cbe0">sfida + partite singole,</text>
  <text x="565" y="192" text-anchor="middle" font-size="11" fill="#c8cbe0">record.js → record.json</text>
  <line x1="185" y1="40" x2="455" y2="88" stroke="#5d6475" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#f)"/>
  <text x="200" y="22" font-size="11" fill="#5d6475">1) HTTP GET /  →  index.html</text>
  ${[0, 1, 2].map((i) => `<line x1="185" y1="${55 + i * 75}" x2="455" y2="${165 + (i - 1) * 14}" stroke="#e1a800" stroke-width="2.2" marker-start="url(#f)" marker-end="url(#f)"/>`).join('')}
  <text x="190" y="258" font-size="11" fill="#b38600" font-weight="700">2) WebSocket: messaggi JSON nei due sensi (connessione sempre aperta)</text>
</svg>
<p>Il browser chiede la pagina con una normale richiesta <b>HTTP</b> (Express la serve dalla cartella <code>public</code>). Poi lo script della pagina apre un
<b>WebSocket</b> verso lo stesso server e la stessa porta. Da quel momento client e server si scambiano <b>messaggi JSON</b> in tempo reale.</p>

<div style="margin-top:6mm">
<h2>3. I messaggi scambiati (protocollo)</h2>
<p>Ogni messaggio è un oggetto JSON con un campo <code>tipo</code>, che dice a chi lo riceve cosa fare. "Sfida" = solo i giocatori della sfida; "un client" = solo chi gioca da solo.</p>
<table>
  <tr><th>Direzione</th><th>tipo</th><th>Contenuto</th><th>Quando</th></tr>
  ${messaggi.map((m) => `<tr><td class="dir">${m[0]}</td><td><code>${m[1]}</code></td><td><code>${m[2]}</code></td><td>${m[3]}</td></tr>`).join('')}
</table>

<div class="box"><b>Una partita singola (Difficoltà o Infinita), passo per passo.</b>
<ol style="margin:2mm 0 0; padding-left:5mm">
  <li>Il client manda <code>nome</code>, poi <code>modalita</code> → il server crea <code>ws.partita</code> e manda <code>stato_partita</code>.</li>
  <li>Il server manda <code>quadrato</code> (con <code>durata</code>) e avvia un <code>setTimeout</code>.</li>
  <li>Click in tempo → <code>click</code> → <code>clearTimeout</code>, punti → <code>preso</code> (+ <code>livello</code> ogni 10) + <code>stato_partita</code> → nuovo quadrato.</li>
  <li>Tempo scaduto → <code>mancato</code>, −1 vita. A 0 vite → <code>game_over</code>; se è un record, <code>record</code> a tutti.</li>
</ol></div>
</div>

<div class="capitolo">
<h2>4. Il server — server.js</h2>
${blocchiServer.map((b) => blocco(b[0], b[1], b[2], b[3], codice(S[b[0]] || ''))).join('')}
</div>

<div class="capitolo">
<h2>5. Il modulo dei record — record.js</h2>
<div class="blocco">
  <h3><span class="sez">MODULO</span> Un modulo scritto da noi</h3>
  ${codice(R)}
  <div class="spiega">
    <p>Un modulo è un file JavaScript che <b>esporta</b> qualcosa con <code>module.exports</code>. Qui esportiamo <code>carica</code>, <code>aggiungi</code> ed <code>elenco</code>;
    <code>salva</code> e <code>strutturaVuota</code> restano private. In <code>server.js</code> basta <code>const record = require('./record')</code> e poi <code>record.aggiungi(...)</code>.</p>
    <ul>
      <li><b>carica</b>: <code>fs.readFileSync</code> (sincrona, solo all'avvio) e <code>JSON.parse</code> dentro <code>try/catch</code>: se il file non c'è si parte con i record vuoti.
      <code>Object.assign</code> unisce la struttura vuota con i dati letti.</li>
      <li><b>aggiungi</b>: una partita con 0 punti non è un record e viene scartata subito (restituisce −1); altrimenti <code>push</code>, <code>sort</code> decrescente, <code>indexOf</code> per la posizione e <code>slice(0, 5)</code> per tenere i 5 migliori. Restituisce la posizione oppure −1.</li>
      <li><b>salva</b>: <code>fs.writeFile</code> è <b>asincrona</b>: il server non si blocca mentre scrive e la callback segnala eventuali errori. <code>JSON.stringify(record, null, 2)</code> scrive il JSON indentato.</li>
    </ul>
    <p class="rif"><svg class="ico"><use href="#i-graffetta"/></svg> Negli esempi del prof: ws_socket_09 (modulo fs)</p>
  </div>
</div>
</div>

<div class="capitolo">
<h2>6. Il client — public/index.html</h2>
<div class="blocco">
  <h3><span class="sez">HTML</span> Struttura della pagina</h3>
  ${codice(corpo)}
  <div class="spiega"><p>La pagina ha: un'<b>intestazione</b> (nome, connessi, stato, Menu, Musica), il <b>campo</b> con il quadrato, il fumetto e la barra del tempo, e un <b>pannello laterale</b>
  con due parti mostrate in alternativa: la <b>classifica</b> della sfida oppure il pannello delle partite singole (cuori, punti, quadrati, livello, record).
  Le <b>schermate sovrapposte</b> (nome, menu delle modalità, vittoria, game over) si mostrano e nascondono con la classe CSS <code>nascosto</code>.</p>
  <p><b>Icone vettoriali (SVG).</b> All'inizio del <code>body</code> un contenitore <code>&lt;svg&gt;</code> invisibile contiene i <code>&lt;symbol&gt;</code>: ognuno è un'icona
  disegnata una sola volta. Dove serve scriviamo <code>&lt;svg class="icona"&gt;&lt;use href="#i-trofeo"/&gt;&lt;/svg&gt;</code>: <code>&lt;use&gt;</code> "copia" il simbolo.
  Restano nitide a ogni grandezza e prendono il colore dal CSS (<code>stroke: currentColor</code>). Stile del set open source Lucide (licenza ISC).</p></div>
</div>
${blocchiClient.map((b) => blocco(b[0], b[1], b[2], b[3], codice(C[b[0]] || ''))).join('')}
</div>

<div class="capitolo">
<h2>7. Mappa dei concetti</h2>
<p>Dove si trova nel nostro codice ogni argomento visto a lezione, e in quale esempio del prof (<code>ws_socket_NN</code>) compariva.</p>
<table>
  <tr><th>Concetto</th><th>Nel nostro codice</th><th>Esempi del prof</th></tr>
  ${concetti.map((c) => `<tr><td>${c[0]}</td><td>${c[1]}</td><td>${c[2]}</td></tr>`).join('')}
</table>

<h2 style="margin-top:7mm">8. Domande probabili all'interrogazione</h2>
${domande.map((d, i) => `<div class="domanda"><b class="q">${i + 1}. ${d[0]}</b>${d[1]}</div>`).join('')}
</div>

</body></html>`;

fs.writeFileSync(path.join(QUI, 'spiegazione.html'), html);
console.log('creato spiegazione.html');

// ---------- stampa PDF con Chrome ----------
const chrome = [
  path.join(os.homedir(), 'Desktop', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!chrome) { console.log('Chrome non trovato: aprire gli HTML e stampare in PDF a mano'); process.exit(0); }
const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
const stampa = (html, pdf) => {
  execFileSync(chrome, ['--headless=new', `--user-data-dir=${profilo}`, '--no-pdf-header-footer',
    `--print-to-pdf=${path.join(DOC, pdf)}`, 'file://' + path.join(QUI, html)], { stdio: 'ignore' });
  console.log('creato', pdf);
};
stampa('manuale.html', "Manuale d'uso - Acchiappa il quadrato.pdf");
stampa('spiegazione.html', 'Spiegazione del codice - Acchiappa il quadrato.pdf');
stampa('guida-di-gioco.html', 'Guida di gioco - Acchiappa il quadrato.pdf');
fs.rmSync(profilo, { recursive: true, force: true });
