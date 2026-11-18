# 🎯 Acchiappa il quadrato

Gioco in tempo reale con **Node.js**, **Express** e **WebSocket** (modulo `ws`), con tre modalità:

- **Sfida** – multiplayer, tutti sullo stesso quadrato, vince chi arriva a 10 punti
- **Difficoltà** – da soli: Facile (3 vite), Difficile (2 vite), Impossibile (1 vita)
- **Infinita** – da soli, stile Tetris: ogni 10 quadrati si sale di livello, punti = 40 × livello

I record vengono salvati in `record.json` dal modulo `record.js`.
Lavoro di gruppo TPSIT 2026/27 – 5A Informatica – Gentile, Guttadauro, Pavoni.

## Avvio

```bash
cd acchiappa-il-quadrato
npm install
npm start
```

Poi aprire `http://localhost:3000` nel browser (anche in più finestre).

## Contenuto

- `acchiappa-il-quadrato/` – l'applicazione (server.js, public/index.html)
- `documentazione/` – manuale d'uso (2 pagine) e spiegazione del codice per l'orale
- Per rigenerare i PDF: `node documentazione/sorgenti/genera_pdf.js`
gggg
