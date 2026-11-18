// =====================================================================================
//  ACCHIAPPA IL QUADRATO - record.js
//  MODULO PERSONALIZZATO (scritto da noi) che gestisce i RECORD, cioè i migliori punteggi.
//  Le funzioni vengono "esportate" con module.exports e server.js le usa con require('./record').
//  I record vengono salvati sul disco nel file record.json con il modulo fs,
//  così non si perdono quando il server viene spento e riacceso.
// =====================================================================================

// importiamo "fs" (modulo interno di Node) per leggere e scrivere file
const fs = require('fs');
// importiamo "path" (modulo interno di Node) per costruire il percorso del file
const path = require('path');

// percorso completo del file dei record: record.json nella stessa cartella di questo modulo
const FILE_RECORD = path.join(__dirname, 'record.json');
// quanti record teniamo in ogni classifica (i 5 migliori)
const MAX_RECORD = 5;

// variabile con tutte le classifiche dei record; all'inizio è vuota, la riempie carica()
let record = strutturaVuota();

// crea la struttura vuota: una lista per ogni difficoltà e una per la modalità infinita
function strutturaVuota() {
    // restituiamo un oggetto con quattro array vuoti
    return { facile: [], difficile: [], impossibile: [], infinita: [] };
// fine della funzione strutturaVuota
}

// legge i record dal file record.json (viene chiamata una sola volta, all'avvio del server)
function carica() {
    // try/catch: se il file non esiste ancora o è rovinato, readFileSync o JSON.parse lanciano un errore
    try {
        // readFileSync legge tutto il file come testo; è SINCRONA (aspetta la fine) ma va bene perché succede solo all'avvio
        const testo = fs.readFileSync(FILE_RECORD, 'utf8');
        // Object.assign parte dalla struttura vuota e ci copia sopra i dati letti (così le liste mancanti esistono comunque)
        record = Object.assign(strutturaVuota(), JSON.parse(testo));
        // avvisiamo sulla console del server
        console.log('[RECORD] record caricati da record.json');
    // se qualcosa va storto...
    } catch (errore) {
        // ...partiamo con i record vuoti
        record = strutturaVuota();
        // avvisiamo sulla console del server
        console.log('[RECORD] nessun record salvato: si parte da zero');
    // fine del try/catch
    }
// fine della funzione carica
}

// aggiunge un risultato a una classifica; restituisce la posizione raggiunta (0 = primo posto) oppure -1 se non entra nei primi 5
function aggiungi(classifica, risultato) {
    // prendiamo la lista giusta (es. record['facile'])
    const lista = record[classifica];
    // aggiungiamo il nuovo risultato in fondo all'array
    lista.push(risultato);
    // ordiniamo dal punteggio più alto al più basso (a parità di punti resta prima chi c'era già)
    lista.sort((a, b) => b.punti - a.punti);
    // indexOf trova in che posizione è finito il nuovo risultato
    const posizione = lista.indexOf(risultato);
    // teniamo solo i primi MAX_RECORD elementi (slice crea un nuovo array da 0 a MAX_RECORD escluso)
    record[classifica] = lista.slice(0, MAX_RECORD);
    // se il risultato è fuori dai primi 5 non è un record: niente da salvare
    if (posizione >= MAX_RECORD) return -1;
    // altrimenti salviamo i record aggiornati sul file
    salva();
    // e restituiamo la posizione raggiunta
    return posizione;
// fine della funzione aggiungi
}

// scrive tutti i record nel file record.json
function salva() {
    // JSON.stringify(oggetto, null, 2) crea un testo JSON indentato con 2 spazi (leggibile anche aprendo il file)
    const testo = JSON.stringify(record, null, 2);
    // writeFile è ASINCRONA: il server non si blocca mentre scrive; la callback viene chiamata quando ha finito
    fs.writeFile(FILE_RECORD, testo, (errore) => {
        // se la scrittura non è riuscita lo segnaliamo
        if (errore) console.log('[RECORD] errore nel salvataggio: ' + errore.message);
    // fine della callback di writeFile
    });
// fine della funzione salva
}

// restituisce l'oggetto con tutte le classifiche dei record
function elenco() {
    // restituiamo la variabile record
    return record;
// fine della funzione elenco
}

// ESPORTAZIONE: rendiamo disponibili queste tre funzioni a chi fa require('./record')
// (salva e strutturaVuota restano "private": si usano solo qui dentro)
module.exports = { carica, aggiungi, elenco };
