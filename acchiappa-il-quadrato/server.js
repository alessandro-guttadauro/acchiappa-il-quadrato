// =====================================================================================
//  ACCHIAPPA IL QUADRATO - server.js
//  Gioco in tempo reale con Node.js + Express + WebSocket (modulo "ws")
//  Gruppo: Gentile, Guttadauro, Pavoni - 5A Informatica - TPSIT 2026/27
// -------------------------------------------------------------------------------------
//  TRE MODALITÀ DI GIOCO:
//  1) SFIDA (multiplayer): il server sposta UN quadrato uguale per tutti ogni 1,2 secondi
//     e lo invia a tutti i giocatori della sfida (broadcast). Il primo che lo clicca
//     prende 1 punto; chi arriva per primo a 10 punti vince.
//  2) DIFFICOLTÀ (da soli): Facile / Difficile / Impossibile. Ogni livello ha un numero
//     di vite, un tempo per cliccare e una grandezza del quadrato diversi.
//     Se il quadrato sparisce prima del click si perde una vita.
//  3) INFINITA (da soli, ispirata a Tetris): ogni 10 quadrati si sale di livello,
//     il quadrato diventa più veloce, più piccolo e cambia colore. Punti = 40 × livello.
//  Nelle partite singole OGNI client ha la sua partita, con i suoi timer, gestita dal server.
//  I migliori punteggi (record) vengono salvati su file e inviati a tutti in tempo reale.
//  Il server è l'unico "arbitro": i client mostrano solo quello che ricevono.
// =====================================================================================


// * ---------------------------------------------------------------------------------
// * 1. IMPORTAZIONE DEI MODULI (require)
// * ---------------------------------------------------------------------------------

// importiamo Express: modulo ESTERNO installato con "npm install express" (si trova in node_modules)
const express = require('express');
// importiamo SOLO la classe Server dal modulo esterno "ws" usando la destrutturazione { }, come negli esempi ws_socket_00..08
const { Server } = require('ws');
// importiamo "fs" (file system): modulo INTERNO di Node, già incluso, serve per leggere i file (come in ws_socket_09)
const fs = require('fs');
// importiamo "path": modulo INTERNO di Node per costruire percorsi di file che funzionano su Mac, Windows e Linux
const path = require('path');
// importiamo "os": modulo INTERNO di Node che dà informazioni sul computer (lo usiamo per scoprire l'indirizzo IP)
const os = require('os');
// importiamo il NOSTRO modulo record.js: il "./" iniziale indica un file del progetto e non un modulo di node_modules
const record = require('./record');


// * ---------------------------------------------------------------------------------
// * 2. COSTANTI DI CONFIGURAZIONE (const = valore che non cambia)
// * ---------------------------------------------------------------------------------

// porta TCP su cui il server resta in ascolto (nel browser: http://localhost:3000)
// process.env contiene le variabili d'ambiente: se PORT è impostata la usiamo, altrimenti (||) usiamo 3000
const PORTA = process.env.PORT || 3000;

// --- modalità SFIDA ---
// punti necessari per vincere una sfida
const PUNTI_PER_VINCERE = 10;
// ogni quanti millisecondi il quadrato della sfida cambia posizione (1200 ms = 1,2 secondi)
const INTERVALLO_MS = 1200;
// lato in pixel del quadrato della sfida
const DIMENSIONE_SFIDA = 64;
// quanti millisecondi dura la pausa dopo una vittoria prima della nuova sfida
const PAUSA_VITTORIA_MS = 5000;
// array di colori: ogni giocatore riceve un colore in base al suo id (come l'array "colori" in ws_socket_04)
const COLORI = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e84393', '#34495e'];

// --- modalità DIFFICOLTÀ ---
// oggetto di configurazione: per ogni difficoltà nome, vite, tempo per cliccare (ms) e lato del quadrato (px)
const DIFFICOLTA = {
    // facile: 3 vite, tempo di reazione normale, quadrato grande
    facile: { nome: 'Facile', vite: 3, tempo: 1400, dimensione: 80 },
    // difficile: 2 vite, tempo di reazione più basso, quadrato medio
    difficile: { nome: 'Difficile', vite: 2, tempo: 900, dimensione: 56 },
    // impossibile: 1 vita, tempo di reazione molto basso, quadrato piccolo
    impossibile: { nome: 'Impossibile', vite: 1, tempo: 550, dimensione: 38 },
// fine dell'oggetto DIFFICOLTA
};

// --- modalità INFINITA (stile Tetris) ---
// vite con cui si parte
const VITE_INFINITA = 3;
// quadrati da prendere per salire di livello (come le 10 righe di Tetris)
const QUADRATI_PER_LIVELLO = 10;
// punti base: come in Tetris, dove una riga vale 40 × livello
const PUNTI_BASE = 40;
// colore dei quadrati per ogni livello (dal livello 11 la lista ricomincia)
const COLORI_LIVELLO = ['#f9ca24', '#2ecc71', '#3498db', '#9b59b6', '#e84393', '#e67e22', '#1abc9c', '#e74c3c', '#00cec9', '#fdcb6e'];

// --- partite singole (difficoltà e infinita) ---
// pausa in millisecondi tra un quadrato preso e il successivo
const PAUSA_QUADRATO_MS = 350;


// * ---------------------------------------------------------------------------------
// * 3. STATO DELLA SFIDA (variabili che cambiano durante la partita, let = modificabile)
// * ---------------------------------------------------------------------------------

// contatore usato per dare un id univoco a ogni client che si collega (come "quale" in ws_socket_04)
let contatoreId = 0;
// quadrato della sfida: numero progressivo, coordinate in percentuale e se è già stato preso
let quadrato = { numero: 0, x: 0, y: 0, preso: true };
// diventa true dopo una vittoria: durante la pausa il quadrato non si muove e i click vengono ignorati
let inPausa = false;

// leggiamo dal file record.json i record salvati nelle volte precedenti (funzione del nostro modulo)
record.carica();


// * ---------------------------------------------------------------------------------
// * 4. CONFIGURAZIONE DI EXPRESS (server HTTP)
// * ---------------------------------------------------------------------------------

// creiamo l'applicazione Express chiamando la funzione express()
const app = express();

// MIDDLEWARE PERSONALIZZATO: funzione eseguita per OGNI richiesta HTTP, prima delle rotte
app.use((req, res, next) => {
    // stampiamo sulla console del server il metodo (GET, POST...) e l'indirizzo richiesto
    console.log(`[HTTP] ${req.method} ${req.url}`);
    // next() passa la richiesta al middleware/rotta successivo; senza next() la richiesta resterebbe bloccata qui
    next();
// fine del middleware di log
});

// MIDDLEWARE STATICO: express.static serve automaticamente i file della cartella "public" (index.html, immagini...)
// __dirname è la cartella in cui si trova server.js; path.join unisce i pezzi del percorso in modo corretto
app.use(express.static(path.join(__dirname, 'public')));

// ROTTA GET /musica: invia la musica di sottofondo in STREAMING (stessa tecnica di ws_socket_09)
app.get('/musica', (req, res) => {
    // costruiamo il percorso completo del file audio
    const fileMusica = path.join(__dirname, 'musica', 'sottofondo.wav');
    // controlliamo che il file esista davvero sul disco
    if (fs.existsSync(fileMusica)) {
        // leggiamo le informazioni del file (ci serve la dimensione in byte)
        const info = fs.statSync(fileMusica);
        // scriviamo l'intestazione della risposta: codice 200 (OK), tipo di contenuto e lunghezza
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': info.size });
        // creiamo uno stream di lettura e con pipe() lo "colleghiamo" alla risposta: il file viene inviato a pezzi (chunk)
        fs.createReadStream(fileMusica).pipe(res);
    // se il file non esiste...
    } else {
        // ...rispondiamo con il codice 404 (non trovato) e un messaggio di testo
        res.status(404).send('Musica non trovata');
    // fine dell'if/else
    }
// fine della rotta /musica
});

// ROTTA GET /api/classifica: restituisce lo stato della sfida in formato JSON (utile per controllare il server dal browser)
app.get('/api/classifica', (req, res) => {
    // res.json() trasforma l'oggetto JavaScript in testo JSON e imposta da solo il Content-Type
    res.json({ connessi: ws_server.clients.size, puntiPerVincere: PUNTI_PER_VINCERE, giocatori: listaClassifica() });
// fine della rotta /api/classifica
});

// ROTTA GET /api/record: restituisce in JSON tutti i record salvati (dal nostro modulo record.js)
app.get('/api/record', (req, res) => {
    // inviamo l'oggetto con le classifiche dei record
    res.json(record.elenco());
// fine della rotta /api/record
});

// MIDDLEWARE FINALE (404): se nessuna rotta precedente ha risposto, la pagina richiesta non esiste
app.use((req, res) => {
    // impostiamo il codice di stato 404 e inviamo un messaggio
    res.status(404).send('Pagina non trovata');
// fine del middleware 404
});

// avviamo il server HTTP sulla PORTA: listen() restituisce l'oggetto server, che servirà anche al WebSocket
const server = app.listen(PORTA, () => {
    // questa funzione (callback) viene eseguita quando il server è pronto
    console.log(`Server avviato! Apri nel browser: http://localhost:${PORTA}`);
    // per ogni indirizzo IP del computer nella rete locale...
    indirizziRete().forEach((ip) => {
        // ...stampiamo l'indirizzo che gli altri PC della stessa rete possono usare per giocare
        console.log(`Dagli altri PC della rete:   http://${ip}:${PORTA}`);
    // fine del forEach
    });
// fine della callback di listen
});


// * ---------------------------------------------------------------------------------
// * 5. SERVER WEBSOCKET (modulo ws) ED EVENTI
// * ---------------------------------------------------------------------------------

// creiamo il server WebSocket "agganciato" al server HTTP di Express: usano la STESSA porta 3000 (come negli esempi del prof)
const ws_server = new Server({ server });

// evento "connection": scatta ogni volta che un nuovo client (browser) apre una connessione WebSocket
ws_server.on('connection', (ws) => {
    // incrementiamo il contatore per avere un nuovo id
    contatoreId++;
    // salviamo l'id direttamente dentro l'oggetto ws del client (come ws.id = quale in ws_socket_04)
    ws.id = contatoreId;
    // scegliamo il colore: l'operatore % (modulo) fa ripartire l'array da capo quando i colori finiscono
    ws.colore = COLORI[(ws.id - 1) % COLORI.length];
    // all'inizio il giocatore non ha ancora scelto il nome (null = nessun valore)
    ws.nome = null;
    // modalità scelta: null finché il giocatore è nel menu, poi 'sfida', 'difficolta' o 'infinita'
    ws.modalita = null;
    // punti della sfida multiplayer
    ws.punti = 0;
    // partita singola in corso (difficoltà o infinita): null se non sta giocando da solo
    ws.partita = null;
    // stampiamo sulla console del server chi si è collegato
    console.log(`[WS] nuovo client connesso, id: ${ws.id}`);

    // inviamo SOLO a questo client il benvenuto: id, colore e la configurazione delle difficoltà (per scrivere i pulsanti del menu)
    inviaA(ws, { tipo: 'benvenuto', id: ws.id, colore: ws.colore, puntiPerVincere: PUNTI_PER_VINCERE, difficolta: DIFFICOLTA });
    // gli inviamo anche i record attuali
    inviaA(ws, { tipo: 'record', record: record.elenco() });
    // inviamo a TUTTI la classifica aggiornata, così vedono che il numero di connessi è cambiato (come ws_socket_08)
    inviaClassifica();

    // evento "message": scatta quando QUESTO client ci manda un messaggio
    ws.on('message', (dati) => {
        // dichiariamo la variabile che conterrà il messaggio convertito in oggetto
        let msg;
        // try/catch: se il testo ricevuto non è JSON valido, JSON.parse lancerebbe un errore e il server si fermerebbe
        try {
            // JSON.parse: testo -> oggetto JavaScript
            msg = JSON.parse(dati);
        // se si verifica un errore lo "catturiamo" qui
        } catch (errore) {
            // segnaliamo il problema sulla console
            console.log(`[WS] messaggio non valido da ${ws.id}`);
            // usciamo dalla funzione senza fare altro
            return;
        // fine del try/catch
        }

        // CASO 1: il client ci comunica il nome scelto dal giocatore
        if (msg.tipo === 'nome') {
            // String() converte in testo, trim() toglie gli spazi ai lati, substring() tiene al massimo 15 caratteri
            const nomePulito = String(msg.nome).trim().substring(0, 15);
            // se il nome è vuoto usiamo un nome automatico (l'operatore || sceglie il secondo valore se il primo è vuoto)
            ws.nome = nomePulito || `Giocatore ${ws.id}`;
            // stampiamo il nome sulla console del server
            console.log(`[WS] il client ${ws.id} si chiama "${ws.nome}"`);
        // fine del caso "nome"
        }

        // CASO 2: il giocatore ha scelto una modalità dal menu (o preme "Rigioca")
        if (msg.tipo === 'modalita') {
            // senza nome non si può giocare
            if (!ws.nome) return;
            // se stava già giocando da solo fermiamo la vecchia partita (e i suoi timer)
            fermaPartita(ws);
            // modalità SFIDA multiplayer
            if (msg.modalita === 'sfida') {
                // segniamo che il giocatore è nella sfida
                ws.modalita = 'sfida';
                // entra con 0 punti
                ws.punti = 0;
            // modalità DIFFICOLTÀ: controlliamo che la difficoltà sia una di quelle previste
            // (Object.keys restituisce l'array ['facile', 'difficile', 'impossibile'], includes controlla se c'è)
            } else if (msg.modalita === 'difficolta' && Object.keys(DIFFICOLTA).includes(msg.difficolta)) {
                // segniamo la modalità
                ws.modalita = 'difficolta';
                // facciamo partire la sua partita singola
                iniziaPartitaSingola(ws, 'difficolta', msg.difficolta);
            // modalità INFINITA
            } else if (msg.modalita === 'infinita') {
                // segniamo la modalità
                ws.modalita = 'infinita';
                // facciamo partire la sua partita singola (null = nessuna difficoltà)
                iniziaPartitaSingola(ws, 'infinita', null);
            // fine della scelta della modalità
            }
            // stampiamo la scelta sulla console del server
            console.log(`[WS] ${ws.nome} gioca in modalità ${ws.modalita}${msg.difficolta ? ' (' + msg.difficolta + ')' : ''}`);
            // la classifica della sfida cambia (qualcuno è entrato o uscito): la mandiamo a tutti
            inviaClassifica();
        // fine del caso "modalita"
        }

        // CASO 3: il client ha cliccato il quadrato
        if (msg.tipo === 'click') {
            // nella sfida il click viene gestito dalla logica multiplayer...
            if (ws.modalita === 'sfida') clickSfida(ws, msg.numero);
            // ...altrimenti da quella della partita singola
            else clickSingolo(ws, msg.numero);
        // fine del caso "click"
        }

        // CASO 4: il giocatore torna al menu
        if (msg.tipo === 'esci') {
            // fermiamo l'eventuale partita singola
            fermaPartita(ws);
            // nessuna modalità attiva
            ws.modalita = null;
            // se era nella sfida esce dalla classifica: la aggiorniamo per tutti
            inviaClassifica();
        // fine del caso "esci"
        }
    // fine dell'evento "message"
    });

    // evento "close": scatta quando il client si disconnette (pagina chiusa, rete persa...)
    ws.on('close', () => {
        // fermiamo i timer della sua partita singola, altrimenti continuerebbero a girare per niente
        fermaPartita(ws);
        // stampiamo chi è uscito (ws lo ha già tolto da ws_server.clients)
        console.log(`[WS] client disconnesso, id: ${ws.id}`);
        // mandiamo a chi è rimasto la classifica senza il giocatore uscito (come ws_socket_08)
        inviaClassifica();
    // fine dell'evento "close"
    });

    // evento "error": scatta se c'è un problema sulla connessione; gestendolo il server non si blocca
    ws.on('error', (errore) => {
        // stampiamo il messaggio di errore
        console.log(`[WS] errore sul client ${ws.id}: ${errore.message}`);
    // fine dell'evento "error"
    });
// fine dell'evento "connection"
});


// * ---------------------------------------------------------------------------------
// * 6. SFIDA MULTIPLAYER: ciclo di gioco (setInterval, come negli esempi ws_socket_00..04)
// * ---------------------------------------------------------------------------------

// setInterval esegue la funzione ogni INTERVALLO_MS millisecondi, per sempre
setInterval(() => {
    // se siamo nella pausa dopo una vittoria non facciamo niente
    if (inPausa) return;
    // se nessuno sta giocando la sfida è inutile spostare il quadrato
    if (giocatoriSfida().length === 0) return;
    // altrimenti generiamo una nuova posizione e la mandiamo ai giocatori della sfida
    nuovaPosizione();
// fine di setInterval (il secondo parametro è l'intervallo in millisecondi)
}, INTERVALLO_MS);


// * ---------------------------------------------------------------------------------
// * 7. FUNZIONI DI INVIO E DELLA SFIDA MULTIPLAYER
// * ---------------------------------------------------------------------------------

// invia un messaggio a UN solo client (se la sua connessione è aperta)
function inviaA(ws, messaggio) {
    // readyState OPEN = connessione aperta; JSON.stringify trasforma l'oggetto in testo
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(messaggio));
// fine della funzione inviaA
}

// BROADCAST: invia lo stesso messaggio a tutti i client collegati
function inviaATutti(messaggio) {
    // convertiamo l'oggetto in testo JSON una sola volta (invece di farlo per ogni client)
    const testo = JSON.stringify(messaggio);
    // ws_server.clients contiene tutti i client collegati: li scorriamo con forEach (come negli esempi del prof)
    ws_server.clients.forEach((client) => {
        // inviamo solo ai client con la connessione aperta (OPEN), per evitare errori su quelli che si stanno chiudendo
        if (client.readyState === client.OPEN) client.send(testo);
    // fine del forEach
    });
// fine della funzione inviaATutti
}

// restituisce l'array dei client che stanno giocando la sfida multiplayer
function giocatoriSfida() {
    // Array.from trasforma il Set dei client in un array; filter tiene solo quelli con modalità 'sfida'
    return Array.from(ws_server.clients).filter((client) => client.modalita === 'sfida');
// fine della funzione giocatoriSfida
}

// invia un messaggio solo ai giocatori della sfida
function inviaASfida(messaggio) {
    // per ogni giocatore della sfida usiamo la funzione inviaA
    giocatoriSfida().forEach((client) => inviaA(client, messaggio));
// fine della funzione inviaASfida
}

// crea l'array della classifica della sfida, ordinato dal giocatore con più punti a quello con meno
function listaClassifica() {
    // map trasforma ogni client in un oggetto con solo i dati che servono alla classifica
    const lista = giocatoriSfida().map((client) => ({ id: client.id, nome: client.nome, colore: client.colore, punti: client.punti }));
    // sort con funzione di confronto: se b ha più punti di a, b va prima (ordine decrescente)
    lista.sort((a, b) => b.punti - a.punti);
    // restituiamo l'array ordinato
    return lista;
// fine della funzione listaClassifica
}

// invia a tutti il numero di connessi e la classifica della sfida
function inviaClassifica() {
    // ws_server.clients è un Set: la proprietà size indica quanti elementi contiene
    inviaATutti({ tipo: 'classifica', connessi: ws_server.clients.size, giocatori: listaClassifica() });
// fine della funzione inviaClassifica
}

// sceglie una nuova posizione casuale del quadrato della sfida e la invia ai giocatori
function nuovaPosizione() {
    // ogni quadrato ha un numero progressivo: serve a riconoscere i click "in ritardo" su un quadrato vecchio
    quadrato.numero++;
    // coordinata orizzontale casuale da 0 a 100 (percentuale dello spazio disponibile nel campo)
    quadrato.x = Math.floor(Math.random() * 101);
    // coordinata verticale casuale da 0 a 100
    quadrato.y = Math.floor(Math.random() * 101);
    // il nuovo quadrato non è ancora stato preso da nessuno
    quadrato.preso = false;
    // inviamo la nuova posizione ai giocatori della sfida (colore null = giallo standard)
    inviaASfida({ tipo: 'quadrato', numero: quadrato.numero, x: quadrato.x, y: quadrato.y, dimensione: DIMENSIONE_SFIDA, colore: null });
// fine della funzione nuovaPosizione
}

// gestisce il click di un giocatore della sfida
function clickSfida(ws, numero) {
    // il click NON vale se siamo in pausa, il quadrato è già stato preso o è un quadrato vecchio
    if (inPausa || quadrato.preso || numero !== quadrato.numero) return;
    // segniamo il quadrato come preso: i click degli altri arrivati DOPO verranno ignorati
    // (Node gestisce i messaggi uno alla volta in ordine di arrivo, quindi vince davvero il più veloce)
    quadrato.preso = true;
    // aggiungiamo un punto a chi ha cliccato
    ws.punti++;
    // stampiamo l'evento sulla console del server
    console.log(`[SFIDA] ${ws.nome} prende il quadrato n.${quadrato.numero} (${ws.punti} punti)`);
    // avvisiamo i giocatori della sfida: chi ha preso il quadrato e con che colore
    inviaASfida({ tipo: 'preso', numero: quadrato.numero, id: ws.id, nome: ws.nome, colore: ws.colore });
    // mandiamo a tutti la classifica aggiornata
    inviaClassifica();
    // controlliamo se il giocatore ha raggiunto i punti per vincere
    if (ws.punti >= PUNTI_PER_VINCERE) {
        // mettiamo la sfida in pausa
        inPausa = true;
        // stampiamo il vincitore sulla console del server
        console.log(`[SFIDA] *** ${ws.nome} ha vinto la sfida! ***`);
        // avvisiamo della vittoria, indicando anche quanti secondi mancano alla nuova sfida
        inviaASfida({ tipo: 'vittoria', id: ws.id, nome: ws.nome, colore: ws.colore, secondi: PAUSA_VITTORIA_MS / 1000 });
        // setTimeout esegue nuovaSfida UNA sola volta dopo PAUSA_VITTORIA_MS millisecondi
        setTimeout(nuovaSfida, PAUSA_VITTORIA_MS);
    // fine del controllo vittoria
    }
// fine della funzione clickSfida
}

// azzera i punti e fa ripartire la sfida dopo una vittoria
function nuovaSfida() {
    // azzeriamo i punti di ogni giocatore della sfida
    giocatoriSfida().forEach((client) => { client.punti = 0; });
    // togliamo la pausa: il setInterval ricomincerà a muovere il quadrato
    inPausa = false;
    // stampiamo l'evento sulla console del server
    console.log('[SFIDA] nuova sfida!');
    // avvisiamo i giocatori che inizia una nuova sfida
    inviaASfida({ tipo: 'nuova_partita' });
    // mandiamo la classifica azzerata
    inviaClassifica();
// fine della funzione nuovaSfida
}


// * ---------------------------------------------------------------------------------
// * 8. PARTITE SINGOLE: modalità DIFFICOLTÀ e INFINITA (ogni client ha la sua partita)
// * ---------------------------------------------------------------------------------

// crea una nuova partita singola per il client ws e fa partire il primo quadrato
function iniziaPartitaSingola(ws, modalita, difficolta) {
    // configurazione della difficoltà scelta (solo nella modalità difficoltà, altrimenti null)
    const conf = modalita === 'difficolta' ? DIFFICOLTA[difficolta] : null;
    // vite iniziali: quelle della difficoltà oppure quelle della modalità infinita (operatore ternario ? :)
    const vite = conf ? conf.vite : VITE_INFINITA;
    // salviamo lo stato della partita dentro l'oggetto ws del client (come ws.id e ws.nome)
    ws.partita = {
        // 'difficolta' oppure 'infinita'
        modalita: modalita,
        // 'facile', 'difficile', 'impossibile' oppure null
        difficolta: difficolta,
        // vite rimaste
        vite: vite,
        // vite iniziali (servono al client per disegnare i cuori vuoti)
        viteMax: vite,
        // punteggio
        punti: 0,
        // quadrati presi (in Tetris sarebbero le righe completate)
        presi: 0,
        // livello attuale (usato nella modalità infinita)
        livello: 1,
        // numero del quadrato attuale
        numero: 0,
        // true quando il quadrato attuale è chiuso (preso o scaduto)
        preso: true,
        // timer attivo (setTimeout), salvato per poterlo annullare con clearTimeout
        timer: null,
        // diventa true al game over
        finita: false,
    // fine dell'oggetto partita
    };
    // inviamo al client lo stato iniziale (vite, punti, livello)
    inviaStato(ws);
    // il primo quadrato arriva dopo 800 ms, per dare il tempo di prepararsi
    ws.partita.timer = setTimeout(() => prossimoQuadrato(ws), 800);
// fine della funzione iniziaPartitaSingola
}

// calcola tempo, grandezza e colore della modalità infinita in base al livello
function parametriInfinita(livello) {
    // tempo: parte da 1500 ms e a ogni livello si moltiplica per 0,88 (-12%), ma non scende mai sotto i 380 ms
    const tempo = Math.max(380, Math.round(1500 * Math.pow(0.88, livello - 1)));
    // grandezza: parte da 76 px e perde 4 px a ogni livello, ma non scende mai sotto i 34 px
    const dimensione = Math.max(34, 76 - (livello - 1) * 4);
    // colore del livello: l'operatore % fa ripartire l'array dopo l'ultimo colore
    const colore = COLORI_LIVELLO[(livello - 1) % COLORI_LIVELLO.length];
    // restituiamo i tre valori in un oggetto (scrittura abbreviata: { tempo } equivale a { tempo: tempo })
    return { tempo, dimensione, colore };
// fine della funzione parametriInfinita
}

// mostra al client un nuovo quadrato e fa partire il conto alla rovescia per cliccarlo
function prossimoQuadrato(ws) {
    // prendiamo la partita del client
    const p = ws.partita;
    // se la partita non c'è più o è finita non facciamo niente
    if (!p || p.finita) return;
    // parametri del quadrato: dalla difficoltà scelta oppure calcolati dal livello della modalità infinita
    const param = p.modalita === 'difficolta' ? DIFFICOLTA[p.difficolta] : parametriInfinita(p.livello);
    // nuovo numero progressivo
    p.numero++;
    // il quadrato è "aperto": si può prendere
    p.preso = false;
    // inviamo SOLO a questo client il quadrato: posizione casuale in percentuale, grandezza, colore e tempo a disposizione
    inviaA(ws, {
        // tipo del messaggio
        tipo: 'quadrato',
        // numero del quadrato
        numero: p.numero,
        // coordinata orizzontale casuale da 0 a 100
        x: Math.floor(Math.random() * 101),
        // coordinata verticale casuale da 0 a 100
        y: Math.floor(Math.random() * 101),
        // lato del quadrato in pixel
        dimensione: param.dimensione,
        // colore del livello (nella modalità difficoltà non c'è: null = giallo standard)
        colore: param.colore || null,
        // millisecondi a disposizione (il client li usa per la barra del tempo)
        durata: param.tempo,
    // fine del messaggio
    });
    // se entro param.tempo millisecondi il quadrato non viene preso, scatta quadratoScaduto
    p.timer = setTimeout(() => quadratoScaduto(ws), param.tempo);
// fine della funzione prossimoQuadrato
}

// il tempo è finito e il quadrato non è stato preso: si perde una vita
function quadratoScaduto(ws) {
    // prendiamo la partita del client
    const p = ws.partita;
    // controllo di sicurezza: partita assente, quadrato già chiuso o partita finita
    if (!p || p.preso || p.finita) return;
    // chiudiamo il quadrato: un click arrivato in ritardo non varrà più
    p.preso = true;
    // togliamo una vita
    p.vite--;
    // avvisiamo il client che il quadrato è stato mancato
    inviaA(ws, { tipo: 'mancato', numero: p.numero, vite: p.vite });
    // mandiamo lo stato aggiornato (cuori)
    inviaStato(ws);
    // se le vite sono finite è game over
    if (p.vite <= 0) {
        // chiudiamo la partita
        finePartita(ws);
        // e usciamo dalla funzione
        return;
    // fine del controllo delle vite
    }
    // altrimenti dopo una pausa un po' più lunga arriva il prossimo quadrato
    p.timer = setTimeout(() => prossimoQuadrato(ws), PAUSA_QUADRATO_MS * 2);
// fine della funzione quadratoScaduto
}

// gestisce il click nelle partite singole
function clickSingolo(ws, numero) {
    // prendiamo la partita del client
    const p = ws.partita;
    // il click non vale se: non c'è partita, è finita, il quadrato è già chiuso o è un quadrato vecchio
    if (!p || p.finita || p.preso || numero !== p.numero) return;
    // chiudiamo il quadrato
    p.preso = true;
    // annulliamo il timer che avrebbe tolto una vita
    clearTimeout(p.timer);
    // un quadrato preso in più
    p.presi++;
    // punti guadagnati con questo quadrato
    let guadagno = 1;
    // livello prima del click (serve per capire se si è saliti di livello)
    const livelloPrima = p.livello;
    // nella modalità infinita usiamo la FORMULA DI TETRIS
    if (p.modalita === 'infinita') {
        // punti = 40 × livello attuale (come una riga singola in Tetris)
        guadagno = PUNTI_BASE * p.livello;
        // livello = (quadrati presi diviso 10, arrotondato per difetto) + 1 → si sale ogni 10 quadrati
        p.livello = Math.floor(p.presi / QUADRATI_PER_LIVELLO) + 1;
    // fine del caso infinita
    }
    // aggiungiamo i punti guadagnati
    p.punti += guadagno;
    // avvisiamo il client: preso, con i punti guadagnati
    inviaA(ws, { tipo: 'preso', numero: p.numero, id: ws.id, nome: ws.nome, colore: ws.colore, guadagno: guadagno });
    // se il livello è aumentato lo comunichiamo con il nuovo colore
    if (p.livello > livelloPrima) {
        // messaggio di nuovo livello
        inviaA(ws, { tipo: 'livello', livello: p.livello, colore: parametriInfinita(p.livello).colore });
        // stampiamo sulla console del server
        console.log(`[INFINITA] ${ws.nome} sale al livello ${p.livello}`);
    // fine del controllo del livello
    }
    // mandiamo lo stato aggiornato (punti, quadrati, livello)
    inviaStato(ws);
    // dopo una breve pausa arriva il prossimo quadrato
    p.timer = setTimeout(() => prossimoQuadrato(ws), PAUSA_QUADRATO_MS);
// fine della funzione clickSingolo
}

// fine della partita singola (vite finite): salva il record e avvisa il client
function finePartita(ws) {
    // prendiamo la partita del client
    const p = ws.partita;
    // segniamo la partita come finita
    p.finita = true;
    // annulliamo eventuali timer rimasti
    clearTimeout(p.timer);
    // la classifica dei record in cui va il risultato: 'infinita' oppure il nome della difficoltà
    const classifica = p.modalita === 'infinita' ? 'infinita' : p.difficolta;
    // proviamo ad aggiungere il risultato ai record (funzione del nostro modulo record.js)
    const posizione = record.aggiungi(classifica, {
        // nome del giocatore
        nome: ws.nome,
        // punteggio
        punti: p.punti,
        // livello raggiunto
        livello: p.livello,
        // quadrati presi
        presi: p.presi,
        // data di oggi in formato italiano (es. 18/11/2026)
        data: new Date().toLocaleDateString('it-IT'),
    // fine del risultato
    });
    // stampiamo il risultato sulla console del server
    console.log(`[GAME OVER] ${ws.nome} (${classifica}): ${p.punti} punti, livello ${p.livello}`);
    // avvisiamo il client: game over con il riepilogo e la posizione nei record (-1 = nessun record)
    inviaA(ws, { tipo: 'game_over', modalita: p.modalita, difficolta: p.difficolta, punti: p.punti, presi: p.presi, livello: p.livello, posizione: posizione });
    // se è un nuovo record lo mandiamo a TUTTI i client collegati, così lo vedono subito
    if (posizione >= 0) inviaATutti({ tipo: 'record', record: record.elenco() });
// fine della funzione finePartita
}

// ferma la partita singola del client (cambio modalità, ritorno al menu, disconnessione)
function fermaPartita(ws) {
    // se non c'è una partita non c'è niente da fermare
    if (!ws.partita) return;
    // annulliamo il timer in corso
    clearTimeout(ws.partita.timer);
    // togliamo la partita
    ws.partita = null;
// fine della funzione fermaPartita
}

// invia al client lo stato della sua partita singola
function inviaStato(ws) {
    // prendiamo la partita del client
    const p = ws.partita;
    // inviamo i dati che il client mostra nel pannello laterale
    inviaA(ws, {
        // tipo del messaggio
        tipo: 'stato_partita',
        // modalità e difficoltà
        modalita: p.modalita,
        // difficoltà scelta (o null)
        difficolta: p.difficolta,
        // vite rimaste e vite iniziali
        vite: p.vite,
        // vite iniziali
        viteMax: p.viteMax,
        // punteggio
        punti: p.punti,
        // quadrati presi
        presi: p.presi,
        // livello
        livello: p.livello,
        // quadrati che mancano al prossimo livello (% = resto della divisione)
        mancanti: QUADRATI_PER_LIVELLO - (p.presi % QUADRATI_PER_LIVELLO),
        // quadrati per livello (per disegnare la barra di avanzamento)
        perLivello: QUADRATI_PER_LIVELLO,
        // colore del livello attuale
        colore: p.modalita === 'infinita' ? parametriInfinita(p.livello).colore : null,
    // fine del messaggio
    });
// fine della funzione inviaStato
}


// * ---------------------------------------------------------------------------------
// * 9. ALTRE FUNZIONI
// * ---------------------------------------------------------------------------------

// restituisce gli indirizzi IPv4 del computer nella rete locale (es. 192.168.1.20)
function indirizziRete() {
    // array dei risultati
    const indirizzi = [];
    // os.networkInterfaces() restituisce un oggetto con tutte le schede di rete (Wi-Fi, Ethernet...)
    const interfacce = os.networkInterfaces();
    // ciclo for...in: scorre i NOMI delle schede di rete (le chiavi dell'oggetto)
    for (const nome in interfacce) {
        // ciclo for...of: scorre gli indirizzi di quella scheda (gli elementi dell'array)
        for (const info of interfacce[nome]) {
            // teniamo solo gli indirizzi IPv4 non interni (escludiamo 127.0.0.1 = localhost)
            if (info.family === 'IPv4' && !info.internal) indirizzi.push(info.address);
        // fine del ciclo for...of
        }
    // fine del ciclo for...in
    }
    // restituiamo l'array degli indirizzi trovati
    return indirizzi;
// fine della funzione indirizziRete
}
