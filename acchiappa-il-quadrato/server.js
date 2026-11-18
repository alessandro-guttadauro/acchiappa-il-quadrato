// =====================================================================================
//  ACCHIAPPA IL QUADRATO - server.js
//  Gioco multiplayer in tempo reale con Node.js + Express + WebSocket (modulo "ws")
//  Gruppo: Gentile, Guttadauro, Pavoni - 5A Informatica - TPSIT 2026/27
// -------------------------------------------------------------------------------------
//  IDEA DEL GIOCO: il SERVER decide ogni 1,2 secondi una posizione casuale del quadrato
//  e la invia a TUTTI i client (broadcast). Il primo giocatore che lo clicca prende
//  1 punto. Chi arriva per primo a 10 punti vince la partita.
//  Il server è l'unico "arbitro": tiene lo stato del gioco (posizione, punti, chi ha
//  preso il quadrato) e i client si limitano a mostrare quello che ricevono.
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


// * ---------------------------------------------------------------------------------
// * 2. COSTANTI DI CONFIGURAZIONE (const = valore che non cambia)
// * ---------------------------------------------------------------------------------

// porta TCP su cui il server resta in ascolto (nel browser: http://localhost:3000)
// process.env contiene le variabili d'ambiente: se PORT è impostata la usiamo, altrimenti (||) usiamo 3000
const PORTA = process.env.PORT || 3000;
// punti necessari per vincere una partita
const PUNTI_PER_VINCERE = 10;
// ogni quanti millisecondi il quadrato cambia posizione (1200 ms = 1,2 secondi)
const INTERVALLO_MS = 1200;
// quanti millisecondi dura la pausa dopo una vittoria prima della nuova partita
const PAUSA_VITTORIA_MS = 5000;
// array di colori: ogni giocatore riceve un colore in base al suo id (come l'array "colori" in ws_socket_04)
const COLORI = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e84393', '#34495e'];


// * ---------------------------------------------------------------------------------
// * 3. STATO DEL GIOCO (variabili che cambiano durante la partita, let = modificabile)
// * ---------------------------------------------------------------------------------

// contatore usato per dare un id univoco a ogni client che si collega (come "quale" in ws_socket_04)
let contatoreId = 0;
// oggetto che descrive il quadrato attuale: numero progressivo, coordinate in percentuale e se è già stato preso
let quadrato = { numero: 0, x: 0, y: 0, preso: true };
// diventa true dopo una vittoria: durante la pausa il quadrato non si muove e i click vengono ignorati
let inPausa = false;


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

// ROTTA GET /api/classifica: restituisce lo stato della partita in formato JSON (utile per controllare il server dal browser)
app.get('/api/classifica', (req, res) => {
    // res.json() trasforma l'oggetto JavaScript in testo JSON e imposta da solo il Content-Type
    res.json({ connessi: ws_server.clients.size, puntiPerVincere: PUNTI_PER_VINCERE, giocatori: listaClassifica() });
// fine della rotta /api/classifica
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
// * 5. SERVER WEBSOCKET (modulo ws)
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
    // all'inizio il giocatore ha 0 punti
    ws.punti = 0;
    // stampiamo sulla console del server chi si è collegato
    console.log(`[WS] nuovo client connesso, id: ${ws.id}`);

    // inviamo SOLO a questo client un messaggio di benvenuto con il suo id e il suo colore (JSON.stringify: oggetto -> testo)
    ws.send(JSON.stringify({ tipo: 'benvenuto', id: ws.id, colore: ws.colore, puntiPerVincere: PUNTI_PER_VINCERE }));
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
            // mandiamo a tutti la classifica con il nuovo giocatore
            inviaClassifica();
        // fine del caso "nome"
        }

        // CASO 2: il client ha cliccato il quadrato
        if (msg.tipo === 'click') {
            // il click NON vale se: non ha ancora un nome, siamo in pausa, il quadrato è già stato preso o è un quadrato vecchio
            if (!ws.nome || inPausa || quadrato.preso || msg.numero !== quadrato.numero) return;
            // segniamo il quadrato come preso: i click degli altri arrivati DOPO verranno ignorati
            // (Node gestisce i messaggi uno alla volta in ordine di arrivo, quindi vince davvero il più veloce)
            quadrato.preso = true;
            // aggiungiamo un punto a chi ha cliccato
            ws.punti++;
            // stampiamo l'evento sulla console del server
            console.log(`[GIOCO] ${ws.nome} prende il quadrato n.${quadrato.numero} (${ws.punti} punti)`);
            // avvisiamo TUTTI i client: chi ha preso il quadrato e con che colore
            inviaATutti({ tipo: 'preso', numero: quadrato.numero, id: ws.id, nome: ws.nome, colore: ws.colore });
            // mandiamo a tutti la classifica aggiornata
            inviaClassifica();

            // controlliamo se il giocatore ha raggiunto i punti per vincere
            if (ws.punti >= PUNTI_PER_VINCERE) {
                // mettiamo il gioco in pausa
                inPausa = true;
                // stampiamo il vincitore sulla console del server
                console.log(`[GIOCO] *** ${ws.nome} ha vinto la partita! ***`);
                // avvisiamo tutti della vittoria, indicando anche quanti secondi mancano alla nuova partita
                inviaATutti({ tipo: 'vittoria', id: ws.id, nome: ws.nome, colore: ws.colore, secondi: PAUSA_VITTORIA_MS / 1000 });
                // setTimeout esegue nuovaPartita UNA sola volta dopo PAUSA_VITTORIA_MS millisecondi
                setTimeout(nuovaPartita, PAUSA_VITTORIA_MS);
            // fine del controllo vittoria
            }
        // fine del caso "click"
        }
    // fine dell'evento "message"
    });

    // evento "close": scatta quando il client si disconnette (pagina chiusa, rete persa...)
    ws.on('close', () => {
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
// * 6. CICLO DI GIOCO (setInterval, come negli esempi ws_socket_00..04)
// * ---------------------------------------------------------------------------------

// setInterval esegue la funzione ogni INTERVALLO_MS millisecondi, per sempre
setInterval(() => {
    // se siamo nella pausa dopo una vittoria non facciamo niente
    if (inPausa) return;
    // se non c'è nessun client collegato è inutile spostare il quadrato
    if (ws_server.clients.size === 0) return;
    // altrimenti generiamo una nuova posizione e la mandiamo a tutti
    nuovaPosizione();
// fine di setInterval (il secondo parametro è l'intervallo in millisecondi)
}, INTERVALLO_MS);


// * ---------------------------------------------------------------------------------
// * 7. FUNZIONI DI SUPPORTO
// * ---------------------------------------------------------------------------------

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

// crea l'array della classifica, ordinato dal giocatore con più punti a quello con meno
function listaClassifica() {
    // array vuoto da riempire
    const lista = [];
    // scorriamo tutti i client collegati
    ws_server.clients.forEach((client) => {
        // aggiungiamo solo chi ha già scelto un nome (chi è ancora nella schermata iniziale non gioca)
        if (client.nome) lista.push({ id: client.id, nome: client.nome, colore: client.colore, punti: client.punti });
    // fine del forEach
    });
    // sort con funzione di confronto: se b ha più punti di a, b va prima (ordine decrescente)
    lista.sort((a, b) => b.punti - a.punti);
    // restituiamo l'array ordinato
    return lista;
// fine della funzione listaClassifica
}

// invia a tutti il numero di connessi e la classifica
function inviaClassifica() {
    // ws_server.clients è un Set: la proprietà size indica quanti elementi contiene
    inviaATutti({ tipo: 'classifica', connessi: ws_server.clients.size, giocatori: listaClassifica() });
// fine della funzione inviaClassifica
}

// sceglie una nuova posizione casuale del quadrato e la invia a tutti
function nuovaPosizione() {
    // ogni quadrato ha un numero progressivo: serve a riconoscere i click "in ritardo" su un quadrato vecchio
    quadrato.numero++;
    // coordinata orizzontale casuale da 0 a 100 (percentuale dello spazio disponibile nel campo)
    quadrato.x = Math.floor(Math.random() * 101);
    // coordinata verticale casuale da 0 a 100
    quadrato.y = Math.floor(Math.random() * 101);
    // il nuovo quadrato non è ancora stato preso da nessuno
    quadrato.preso = false;
    // broadcast della nuova posizione a tutti i client
    inviaATutti({ tipo: 'quadrato', numero: quadrato.numero, x: quadrato.x, y: quadrato.y });
// fine della funzione nuovaPosizione
}

// azzera i punti e fa ripartire il gioco dopo una vittoria
function nuovaPartita() {
    // scorriamo tutti i client collegati
    ws_server.clients.forEach((client) => {
        // azzeriamo i punti di ognuno
        client.punti = 0;
    // fine del forEach
    });
    // togliamo la pausa: il setInterval ricomincerà a muovere il quadrato
    inPausa = false;
    // stampiamo l'evento sulla console del server
    console.log('[GIOCO] nuova partita!');
    // avvisiamo tutti i client che inizia una nuova partita
    inviaATutti({ tipo: 'nuova_partita' });
    // mandiamo la classifica azzerata
    inviaClassifica();
// fine della funzione nuovaPartita
}

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
