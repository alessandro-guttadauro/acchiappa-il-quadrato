// Rigenera i due PDF della documentazione:
//   node "documentazione/sorgenti/genera_pdf.js"
// 1) costruisce spiegazione.html prendendo il codice VERO da server.js e index.html
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
const S = sezioni(server, /^\/\/ \* (\d)\./);
const script = index.slice(index.indexOf('<script>') + 8, index.indexOf('</script>'));
const C = sezioni(script, /^\s*\/\/ \* --- (\d)\./);
const corpo = pulisci(index.slice(index.indexOf('<body>'), index.indexOf('<!-- ===', index.indexOf('<body>'))));
// toglie il rientro comune a tutte le righe (dedent), così il codice parte dal margine sinistro
function dedent(s) {
  const righe = s.split('\n');
  const min = Math.min(...righe.filter((r) => r.trim()).map((r) => r.match(/^ */)[0].length));
  return righe.map((r) => r.slice(min)).join('\n');
}
const codice = (s) => `<pre><code>${esc(dedent(s))}</code></pre>`;

// ---------- contenuti ----------
const blocchiServer = [
  ['1', 'Importazione dei moduli', `
    <p>Con <code>require()</code> carichiamo i moduli. Ci sono due tipi di moduli:</p>
    <ul>
      <li><b>esterni</b> (<code>express</code>, <code>ws</code>): li installa <code>npm install</code> nella cartella <code>node_modules</code>, e sono elencati nelle <code>dependencies</code> del <code>package.json</code>;</li>
      <li><b>interni</b> (<code>fs</code>, <code>path</code>, <code>os</code>): fanno già parte di Node.js, non vanno installati.</li>
    </ul>
    <p><code>const { Server } = require('ws')</code> è una <b>destrutturazione</b>: dal modulo prendiamo solo la classe <code>Server</code>. È la stessa riga degli esempi del prof.</p>`,
    'ws_socket_00 → 08 (require di express e ws), ws_socket_09 (fs)'],
  ['2', 'Costanti di configurazione', `
    <p>Valori fissi del gioco raccolti in un punto solo: per cambiare le regole (es. 15 punti invece di 10) basta modificare una riga.
    <code>const</code> impedisce di riassegnare la variabile per errore.</p>
    <p><code>process.env.PORT || 3000</code>: <code>process.env</code> contiene le <b>variabili d'ambiente</b> del sistema. Se qualcuno avvia il server con
    <code>PORT=4000 npm start</code> usa la 4000, altrimenti l'operatore <code>||</code> sceglie 3000.</p>
    <p>L'array <code>COLORI</code> funziona come l'array <code>colori</code> dell'esempio 04: il colore si sceglie con l'id del giocatore.</p>`,
    'ws_socket_04 (array colori)'],
  ['3', 'Stato del gioco', `
    <p>Il server è l'<b>unico arbitro</b>: conserva lui lo stato della partita (quale quadrato è in campo, se è già stato preso, se siamo in pausa).
    I client non decidono niente: mostrano solo quello che arriva dal server. Così nessuno può "barare" modificando la pagina nel browser.</p>
    <p><code>quadrato.numero</code> cresce a ogni nuova posizione: serve a scartare i click arrivati in ritardo su un quadrato che ormai si è già spostato.</p>`,
    'ws_socket_04 (variabile quale), ws_socket_03 (contatore tc)'],
  ['4', 'Express: middleware, rotte e avvio del server HTTP', `
    <p><b>Middleware</b>: funzione <code>(req, res, next)</code> eseguita per ogni richiesta, <b>nell'ordine in cui è scritta</b>.
    Il nostro logger stampa la richiesta e chiama <code>next()</code> per passare al successivo.
    Se non chiamasse <code>next()</code> né rispondesse, il browser resterebbe in attesa per sempre.</p>
    <p><code>express.static('public')</code> serve in automatico i file della cartella <code>public</code>: quando il browser chiede <code>/</code> riceve <code>index.html</code>.
    Il prof usava <code>res.sendFile('/index.html', { root: __dirname })</code>: il risultato è lo stesso.</p>
    <p><b>Rotta <code>GET /musica</code></b>: invia il file audio in <b>streaming</b>. <code>fs.createReadStream()</code> legge il file a pezzi (chunk) e
    <code>.pipe(res)</code> li manda subito al browser, senza caricare tutto il file in memoria. <code>writeHead</code> imposta codice 200 e intestazioni
    (<code>Content-Type</code>, <code>Content-Length</code>).</p>
    <p><b>Rotta <code>GET /api/classifica</code></b>: con <code>res.json()</code> restituisce lo stato della partita in JSON (provare ad aprire <code>localhost:3000/api/classifica</code>).</p>
    <p>L'<b>ultimo middleware</b> risponde 404: viene raggiunto solo se nessuna rotta prima ha risposto.
    <code>app.listen()</code> avvia il server e <b>restituisce l'oggetto server HTTP</b>, che passiamo al WebSocket.</p>`,
    'ws_socket_00 → 08 (express + sendFile + listen), ws_socket_09 (createReadStream, pipe, writeHead)'],
  ['5', 'Server WebSocket ed eventi', `
    <p><code>new Server({ server })</code> aggancia il WebSocket al server HTTP: <b>stessa porta 3000</b>. Il browser apre il WebSocket con una richiesta HTTP speciale
    (intestazione <code>Upgrade: websocket</code>); il server risponde <code>101 Switching Protocols</code> e da lì la connessione resta <b>aperta in entrambe le direzioni</b> (full-duplex).</p>
    <ul>
      <li><b>connection</b>: un nuovo client. Gli diamo id, colore, nome e punti salvandoli <b>dentro l'oggetto <code>ws</code></b> (come <code>ws.id = quale</code> dell'esempio 04),
      gli mandiamo il <code>benvenuto</code> con <code>ws.send()</code> (solo a lui) e a tutti la classifica.</li>
      <li><b>message</b>: un messaggio di quel client. Lo convertiamo con <code>JSON.parse</code> dentro un <code>try/catch</code> (un testo non valido non deve far crashare il server)
      e in base al campo <code>tipo</code> gestiamo <code>nome</code> o <code>click</code>.</li>
      <li><b>close</b>: il client se n'è andato; ws lo ha già tolto da <code>ws_server.clients</code>, quindi rimandiamo la classifica aggiornata.</li>
      <li><b>error</b>: gestire l'errore evita che il programma si fermi.</li>
    </ul>
    <p><b>Chi vince il click?</b> Node.js esegue il nostro codice su un <b>solo thread</b> (event loop): i messaggi vengono gestiti <b>uno alla volta, in ordine di arrivo</b>.
    Il primo click valido mette <code>quadrato.preso = true</code>, quindi i click successivi vengono scartati dall'<code>if</code>.</p>`,
    'ws_socket_03 (on message), ws_socket_04/05 (ws.id), ws_socket_06/07 (JSON in arrivo), ws_socket_08 (close + numero connessi)'],
  ['6', 'Ciclo di gioco', `
    <p><code>setInterval</code> richiama la funzione ogni 1200 ms. È il server che "spinge" (push) i dati ai client senza che li chiedano: è proprio quello che con HTTP
    normale non si può fare. Se siamo in pausa o non c'è nessuno collegato, la funzione esce subito con <code>return</code>.</p>`,
    'ws_socket_00 → 04 (setInterval + invio a tutti)'],
  ['7', 'Funzioni di supporto', `
    <ul>
      <li><b>inviaATutti</b>: è il <b>broadcast</b>. Scorre <code>ws_server.clients</code> con <code>forEach</code> e manda il messaggio a ogni client con la connessione <code>OPEN</code>.
      L'oggetto viene convertito in testo con <code>JSON.stringify</code> una sola volta.</li>
      <li><b>listaClassifica</b>: costruisce un array con i giocatori che hanno un nome e lo ordina con <code>sort((a, b) =&gt; b.punti - a.punti)</code> (decrescente).</li>
      <li><b>nuovaPosizione</b>: coordinate casuali da 0 a 100 = <b>percentuale</b> dello spazio. Ogni client le trasforma in pixel secondo la grandezza del suo schermo.</li>
      <li><b>nuovaPartita</b>: azzera i punti; viene chiamata da <code>setTimeout</code> (una volta sola, dopo 5 secondi).</li>
      <li><b>indirizziRete</b>: con <code>os.networkInterfaces()</code> trova l'IP del PC per farlo vedere nel terminale (serve per giocare da altri PC).
      Usa <code>for...in</code> (chiavi di un oggetto) e <code>for...of</code> (elementi di un array).</li>
    </ul>`,
    'ws_socket_00 → 08 (clients.forEach + send), ws_socket_08 (array dei client)'],
];

const blocchiClient = [
  ['1', 'Connessione WebSocket', `
    <p><code>location.origin</code> è l'indirizzo da cui è arrivata la pagina (es. <code>http://192.168.1.20:3000</code>). Con <code>replace(/^http/, 'ws')</code> diventa
    <code>ws://192.168.1.20:3000</code>: il client si collega sempre allo stesso server che gli ha dato la pagina, qualunque sia l'IP. Stessa riga degli esempi del prof.
    L'oggetto <code>WebSocket</code> è già incluso nel browser: lato client il modulo <code>ws</code> non serve.</p>`, 'tutti gli esempi (stessa riga)'],
  ['2', 'Riferimenti agli elementi della pagina', `
    <p>Con <code>document.getElementById</code> salviamo una sola volta i riferimenti agli elementi HTML che useremo spesso (DOM = la pagina vista da JavaScript).</p>`, 'ws_socket_01 → 08'],
  ['3', 'Variabili del client', `
    <p>Il client ricorda solo poche cose: il proprio <b>id</b> (per capire "sono io?"), il <b>numero del quadrato</b> in campo (da rimandare con il click) e i timer, per poterli fermare.</p>`, ''],
  ['4', 'Eventi del WebSocket', `
    <ul>
      <li><code>onopen</code>: connessione pronta, abilitiamo il pulsante <b>Gioca</b>.</li>
      <li><code>onclose</code>: server spento o rete persa, avvisiamo il giocatore.</li>
      <li><code>onmessage</code>: il testo ricevuto diventa oggetto con <code>JSON.parse</code>; il campo <b>tipo</b> decide cosa fare
      (<code>benvenuto</code>, <code>quadrato</code>, <code>preso</code>, <code>classifica</code>, <code>vittoria</code>, <code>nuova_partita</code>).</li>
    </ul>
    <p>Posizione del quadrato: spazio disponibile = dimensione del campo − dimensione del quadrato; pixel = spazio × percentuale / 100.
    Così il quadrato resta sempre dentro il campo, anche sul telefono.</p>`, 'ws_socket_01/02 (onmessage + style.left/top), ws_socket_08 (tipi di messaggio diversi)'],
  ['5', 'Eventi dell\'utente', `
    <p><code>addEventListener</code> collega una funzione a un evento. Sul quadrato usiamo <code>pointerdown</code>, che scatta appena si preme (mouse o dito): più rapido di <code>click</code>.
    Il client <b>non</b> assegna punti: manda solo <code>{ tipo: 'click', numero }</code> e decide il server.
    <code>audio.play()</code> restituisce una <b>Promise</b>; con <code>.catch()</code> gestiamo il caso in cui il browser blocchi l'audio.</p>`, 'ws_socket_03 → 08 (addEventListener + webSocket.send)'],
  ['6', 'Funzioni', `
    <ul>
      <li><b>entraInPartita</b>: controlla <code>readyState === WebSocket.OPEN</code>, manda il nome e nasconde la schermata iniziale.</li>
      <li><b>aggiornaClassifica</b>: svuota la lista e la ricrea con <code>createElement</code> / <code>appendChild</code> (come la griglia dell'esempio 07).
      I nomi vengono scritti con <code>textContent</code> e <b>non</b> con <code>innerHTML</code>: se qualcuno si chiamasse <code>&lt;script&gt;...</code> il browser lo mostrerebbe come testo e non lo eseguirebbe (protezione XSS).</li>
      <li><b>mostraMessaggio</b>: <code>setTimeout</code> nasconde il fumetto dopo 1,5 s; <code>clearTimeout</code> annulla il timer precedente.</li>
      <li><b>avviaContoAllaRovescia</b>: <code>setInterval</code> ogni secondo, fermato con <code>clearInterval</code> quando parte la nuova partita.</li>
    </ul>`, 'ws_socket_07 (createElement)'],
];

const messaggi = [
  ['Server → un client', 'benvenuto', '{ tipo, id, colore, puntiPerVincere }', 'appena il client si collega'],
  ['Client → server', 'nome', '{ tipo, nome }', 'il giocatore preme Gioca'],
  ['Server → tutti', 'quadrato', '{ tipo, numero, x, y }', 'ogni 1,2 s (setInterval)'],
  ['Client → server', 'click', '{ tipo, numero }', 'il giocatore preme sul quadrato'],
  ['Server → tutti', 'preso', '{ tipo, numero, id, nome, colore }', 'primo click valido'],
  ['Server → tutti', 'classifica', '{ tipo, connessi, giocatori[] }', 'entra/esce qualcuno, cambia un punteggio'],
  ['Server → tutti', 'vittoria', '{ tipo, id, nome, colore, secondi }', 'qualcuno arriva a 10 punti'],
  ['Server → tutti', 'nuova_partita', '{ tipo }', '5 s dopo la vittoria (setTimeout)'],
];

const concetti = [
  ['Moduli e require (interni / esterni)', 'server.js § 1', '00 → 09'],
  ['package.json, npm install, npm start', 'package.json', '—'],
  ['Express: app, listen con callback', 'server.js § 4', '00 → 08'],
  ['Middleware (req, res, next) e ordine', 'server.js § 4', '00 (app.use)'],
  ['File statici (express.static / sendFile)', 'server.js § 4', '00 → 08'],
  ['Rotte GET, res.json, codici di stato (200/404)', 'server.js § 4', '09 (writeHead)'],
  ['Stream: fs.createReadStream().pipe(res)', 'server.js § 4', '09'],
  ['Server ws agganciato al server HTTP', 'server.js § 5', '00 → 08'],
  ['Eventi connection / message / close / error', 'server.js § 5', '00, 03, 08'],
  ['Id e dati salvati sul client (ws.id)', 'server.js § 5', '04 → 08'],
  ['send a un client e broadcast a tutti', 'server.js § 5, § 7', '00 → 08'],
  ['Messaggi JSON con campo "tipo"', 'server.js § 5, index § 4', '02, 06, 07, 08'],
  ['Lista client connessi e numero connessi', 'server.js § 7', '08'],
  ['Timer: setInterval / setTimeout', 'server.js § 6, § 7', '00 → 04'],
  ['Gestione errori: try/catch', 'server.js § 5', '—'],
  ['Variabili d\'ambiente e modulo os', 'server.js § 2, § 7', '—'],
  ['Client: new WebSocket, onopen/onmessage/onclose, send', 'index.html § 1, § 4', '00 → 08'],
  ['DOM: getElementById, createElement, addEventListener', 'index.html § 2, § 5, § 6', '03 → 08'],
];

const domande = [
  ['Che differenza c\'è tra HTTP e WebSocket?', 'In HTTP è sempre il client a fare una richiesta e il server risponde, poi la comunicazione finisce. Il WebSocket è una connessione <b>persistente e bidirezionale</b> (full-duplex): resta aperta e anche il <b>server può inviare dati quando vuole</b>, come la posizione del quadrato ogni 1,2 secondi.'],
  ['Come fanno HTTP e WebSocket a usare la stessa porta?', 'Il WebSocket parte come una richiesta HTTP con l\'intestazione <code>Upgrade: websocket</code>. Il server (ws, agganciato al server di Express con <code>new Server({ server })</code>) risponde <code>101 Switching Protocols</code> e da quel momento la connessione diventa WebSocket.'],
  ['Cos\'è un middleware? A cosa serve next()?', 'È una funzione <code>(req, res, next)</code> che Express esegue per ogni richiesta, nell\'ordine in cui è registrata. Può rispondere oppure chiamare <code>next()</code> per passare la richiesta al middleware/rotta successivo. Esempi nel nostro codice: logger, <code>express.static</code>, 404.'],
  ['Perché non consegnate la cartella node_modules?', 'Perché si ricrea con <code>npm install</code>: il <code>package.json</code> elenca le dipendenze (express e ws) con le versioni. Così lo zip è leggero.'],
  ['Come fate il broadcast?', 'Il server ws tiene l\'insieme dei client in <code>ws_server.clients</code>: lo scorriamo con <code>forEach</code> e chiamiamo <code>client.send()</code> su ognuno (funzione <code>inviaATutti</code>).'],
  ['Perché usate JSON e il campo "tipo"?', 'Il WebSocket trasporta testo: con <code>JSON.stringify</code> trasformiamo un oggetto in testo, con <code>JSON.parse</code> facciamo il contrario. Il campo <code>tipo</code> dice a chi riceve che messaggio è e quindi cosa deve fare.'],
  ['Se due giocatori cliccano quasi insieme, chi prende il punto?', 'Quello il cui messaggio arriva prima al server. Node gestisce gli eventi uno alla volta (event loop su un solo thread): il primo click mette <code>quadrato.preso = true</code> e i successivi vengono ignorati. Il numero del quadrato evita che vengano contati click su un quadrato vecchio.'],
  ['Perché è il server a decidere i punti e non il client?', 'Perché il codice del client si può modificare dal browser: se decidesse il client si potrebbe barare. Il server è l\'unico arbitro, i client mostrano solo lo stato.'],
  ['Come assegnate id e colore ai giocatori?', 'Alla connessione incrementiamo <code>contatoreId</code> e lo salviamo in <code>ws.id</code>. Il colore è <code>COLORI[(id - 1) % COLORI.length]</code>: l\'operatore modulo fa ripartire l\'array quando i colori finiscono.'],
  ['Cosa succede quando un giocatore chiude la pagina?', 'Scatta l\'evento <code>close</code>: ws lo toglie da <code>ws_server.clients</code> e noi rimandiamo a tutti la classifica, così sparisce dalla lista e il numero di connessi scende.'],
  ['Cos\'è uno stream e perché lo usate per la musica?', 'È un flusso di dati letto a pezzi. <code>fs.createReadStream()</code> legge il file un pezzo alla volta e <code>pipe(res)</code> lo invia mentre legge: non serve caricare tutto il file in memoria.'],
  ['Differenza tra setInterval e setTimeout?', '<code>setInterval</code> ripete la funzione ogni N millisecondi (movimento del quadrato); <code>setTimeout</code> la esegue una sola volta dopo N millisecondi (nuova partita dopo 5 s). Si fermano con <code>clearInterval</code> / <code>clearTimeout</code>.'],
  ['Perché le coordinate sono in percentuale?', 'Ogni giocatore può avere uno schermo diverso (PC, telefono). Il server manda 0-100 e ogni client la trasforma in pixel in base alla grandezza del suo campo.'],
  ['Perché textContent e non innerHTML per i nomi?', 'Con <code>innerHTML</code> un nome contenente codice HTML verrebbe interpretato (rischio XSS); <code>textContent</code> lo mostra sempre come semplice testo.'],
  ['Cosa succederebbe senza il try/catch?', 'Se arrivasse un messaggio non in formato JSON, <code>JSON.parse</code> lancerebbe un errore non gestito e il server si fermerebbe per tutti i giocatori.'],
  ['Come si gioca da un altro PC?', 'Tutti sulla stessa rete; dagli altri PC si apre <code>http://IP-del-server:3000</code>. L\'IP lo stampa il server all\'avvio grazie al modulo <code>os</code>. Il firewall deve permettere le connessioni a Node.js.'],
];

// ---------- HTML ----------
const blocco = (n, titolo, testo, esempio, cod) => `
  <div class="blocco">
    <h3><span class="sez">§ ${n}</span> ${titolo}</h3>
    ${cod}
    <div class="spiega">${testo}${esempio ? `<p class="rif">📎 Negli esempi del prof: ${esempio}</p>` : ''}</div>
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
</style></head><body>

<div class="copertina">
  <h1>🎯 Acchiappa il <span>quadrato</span></h1>
  <div class="sotto">Spiegazione del codice · guida allo studio per la presentazione</div>
  <div class="chi">Gentile · Guttadauro · Pavoni — 5A Informatica — TPSIT 2026/27</div>
</div>

<div class="box giallo">
  <b>Come usare questa guida.</b> Nel codice (VS Code) ogni riga ha già il suo commento. Qui invece il codice è spiegato <b>a blocchi</b>:
  per ogni blocco c'è il codice (senza commenti, per leggerlo più facilmente), la spiegazione e l'esempio del prof da cui deriva.
  In fondo trovate la <b>mappa dei concetti</b> e le <b>domande probabili all'interrogazione</b> con le risposte.
  I numeri <b>§</b> corrispondono alle sezioni segnate nei file (<code>// * 1.</code>, <code>// * --- 1.</code>).
</div>

<h2>1. Struttura del progetto</h2>
<div class="box"><div class="albero">acchiappa-il-quadrato/
├── package.json        dati del progetto, dipendenze (express, ws) e script "npm start"
├── server.js           SERVER: Express (HTTP) + WebSocket (ws) + logica del gioco
├── public/
│   └── index.html      CLIENT: pagina del gioco (HTML + CSS + JavaScript)
├── musica/
│   └── sottofondo.wav  musica inviata in streaming dalla rotta GET /musica
└── node_modules/       moduli installati da "npm install" (non si consegna)</div></div>

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
  <text x="565" y="102" text-anchor="middle" font-size="11" fill="#c8cbe0">pagina, /musica, /api/classifica</text>
  <rect x="460" y="132" width="210" height="88" rx="9" fill="#2d3250"/>
  <text x="565" y="157" text-anchor="middle" font-size="13" font-weight="700" fill="#f9ca24">WebSocket (ws)</text>
  <text x="565" y="176" text-anchor="middle" font-size="11" fill="#c8cbe0">stato del gioco, setInterval,</text>
  <text x="565" y="192" text-anchor="middle" font-size="11" fill="#c8cbe0">broadcast a tutti i client</text>
  <line x1="185" y1="40" x2="455" y2="88" stroke="#5d6475" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#f)"/>
  <text x="200" y="22" font-size="11" fill="#5d6475">1) HTTP GET /  →  index.html</text>
  ${[0, 1, 2].map((i) => `<line x1="185" y1="${55 + i * 75}" x2="455" y2="${165 + (i - 1) * 14}" stroke="#e1a800" stroke-width="2.2" marker-start="url(#f)" marker-end="url(#f)"/>`).join('')}
  <text x="190" y="258" font-size="11" fill="#b38600" font-weight="700">2) WebSocket: messaggi JSON nei due sensi (connessione sempre aperta)</text>
</svg>
<p>Il browser chiede la pagina con una normale richiesta <b>HTTP</b> (Express la serve dalla cartella <code>public</code>). Poi lo script della pagina apre un
<b>WebSocket</b> verso lo stesso server e la stessa porta. Da quel momento client e server si scambiano <b>messaggi JSON</b> in tempo reale.</p>

<h2 style="margin-top:6mm">3. I messaggi scambiati (protocollo)</h2>
<p>Ogni messaggio è un oggetto JSON con un campo <code>tipo</code>, che dice a chi lo riceve cosa fare.</p>
<table>
  <tr><th>Direzione</th><th>tipo</th><th>Contenuto</th><th>Quando</th></tr>
  ${messaggi.map((m) => `<tr><td class="dir">${m[0]}</td><td><code>${m[1]}</code></td><td><code>${m[2]}</code></td><td>${m[3]}</td></tr>`).join('')}
</table>

<div class="box"><b>Una partita, passo per passo.</b>
<ol style="margin:2mm 0 0; padding-left:5mm">
  <li>Il browser apre la pagina e il WebSocket → il server crea l'id e manda <code>benvenuto</code>.</li>
  <li>Il giocatore scrive il nome → <code>nome</code> → il server manda a tutti la <code>classifica</code>.</li>
  <li>Ogni 1,2 s il server sceglie una posizione e la manda a tutti → <code>quadrato</code>.</li>
  <li>Un giocatore preme il quadrato → <code>click</code> → il server controlla che sia il primo → +1 punto → <code>preso</code> + <code>classifica</code> a tutti.</li>
  <li>Qualcuno arriva a 10 → <code>vittoria</code> → pausa di 5 s → <code>nuova_partita</code>.</li>
</ol></div>

<div class="capitolo">
<h2>4. Il server — server.js</h2>
${blocchiServer.map((b) => blocco(b[0], b[1], b[2], b[3], codice(S[b[0]] || ''))).join('')}
</div>

<div class="capitolo">
<h2>5. Il client — public/index.html</h2>
<div class="blocco">
  <h3><span class="sez">HTML</span> Struttura della pagina</h3>
  ${codice(corpo)}
  <div class="spiega"><p>La pagina ha: un'<b>intestazione</b> (nome, connessi, stato, musica), il <b>campo</b> con il quadrato, la <b>classifica</b> (lista <code>&lt;ol&gt;</code> riempita da JavaScript),
  due <b>schermate sovrapposte</b> (nome iniziale e vittoria, mostrate/nascoste aggiungendo o togliendo la classe CSS <code>nascosto</code>) e l'elemento
  <code>&lt;audio&gt;</code> che prende la musica dalla rotta <code>/musica</code> del server. Il CSS (dentro <code>&lt;style&gt;</code>) serve solo alla grafica.</p></div>
</div>
${blocchiClient.map((b) => blocco(b[0], b[1], b[2], b[3], codice(C[b[0]] || ''))).join('')}
</div>

<div class="capitolo">
<h2>6. Mappa dei concetti</h2>
<p>Dove si trova nel nostro codice ogni argomento visto a lezione, e in quale esempio del prof (<code>ws_socket_NN</code>) compariva.</p>
<table>
  <tr><th>Concetto</th><th>Nel nostro codice</th><th>Esempi del prof</th></tr>
  ${concetti.map((c) => `<tr><td>${c[0]}</td><td>${c[1]}</td><td>${c[2]}</td></tr>`).join('')}
</table>

<h2 style="margin-top:7mm">7. Domande probabili all'interrogazione</h2>
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
fs.rmSync(profilo, { recursive: true, force: true });
