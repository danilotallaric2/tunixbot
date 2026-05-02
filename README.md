# TunixBot

TunixBot e un bot Discord musicale moderno e professionale, pensato per riprodurre musica nei canali vocali da query/link YouTube e da link Spotify (track, playlist, album) usando API ufficiali Spotify.

Include anche una dashboard web in stile Spotify per ricerca tracce, gestione coda e controllo player live.
La dashboard non usa login Spotify personale: playlist e preferiti account utente non sono gestiti.

## Stack

- Node.js
- discord.js v14
- Shoukaku + Lavalink
- Spotify Web API
- Configurazione via `.env`

## Funzionalita principali

- `/play <query/link>`
- `/join`
- `/pause`
- `/resume`
- `/skip`
- `/stop`
- `/queue`
- `/nowplaying`
- `/volume <0-200>`
- `/loop off/song/queue`
- `/shuffle`
- `/remove <numero>`
- `/clearqueue`
- `/seek <tempo>`
- `/lyrics`
- `/filter bassboost/nightcore/vaporwave/8d/clear`
- `/help`

## UX moderna con embed

- Embed dedicati per now playing, queue, errori, filtri, volume, help, playlist caricata e permessi mancanti
- Tema neon blu/viola
- Thumbnail brano
- Footer fisso `TunixBot • Music System`
- Progress bar nel now playing
- Pulsanti interattivi sotto now playing:
  - Pause/Resume
  - Skip
  - Stop
  - Queue
  - Loop
  - Volume + / -

## Architettura progetto

```text
src/
  index.js
  config.js
  commands/
  events/
  dashboard/
  music/
  utils/
.env.example
package.json
README.md
```

## Requisiti

- Node.js >= 18.17
- Un server Lavalink attivo
- Bot Discord con privilegi `bot` + `applications.commands`
- Credenziali Spotify (Client Credentials flow)

## Setup rapido

1. Installa dipendenze:

```bash
npm install
```

2. Copia il file env:

```bash
cp .env.example .env
```

3. Compila `.env` con i tuoi valori:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` (deve combaciare con quello nel Discord Developer Portal)
- `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

4. Avvia il bot:

```bash
npm start
```

5. Apri la dashboard:

```text
http://127.0.0.1:3000
```

Puoi cambiare host/porta con `DASHBOARD_HOST` e `DASHBOARD_PORT`.
Per usare la dashboard devi prima fare login Discord e poi usare `/join` da Discord nel canale vocale.
La dashboard non richiede selezione manuale di server/canale: usa automaticamente server, vocale e canale testo derivati da `/join`.

## Registrazione comandi slash

I comandi vengono registrati automaticamente all'avvio.

- Se imposti `DISCORD_GUILD_ID`, registra a livello guild (piu veloce in sviluppo).
- Se non lo imposti, registra globalmente.

## Note Lavalink

TunixBot usa Shoukaku come client Lavalink. Devi avere un nodo Lavalink funzionante prima di avviare il bot.
Per aggiornamenti "live" senza rifare `/join`, il bot abilita il resume Lavalink + restore sessioni da JSON.

Variabili utili:

- `LAVALINK_RESUME=true`
- `LAVALINK_RESUME_TIMEOUT_SEC=120`
- `LAVALINK_RESUME_BY_LIBRARY=true`
- `MUSIC_SESSION_PERSISTENCE_ENABLED=true`
- `MUSIC_SESSION_PERSISTENCE_FILE=src/data/music-sessions.json`
- `MUSIC_SESSION_RESTORE_ON_START=true`

Per deploy in produzione usa restart graceful (esempio PM2):

```bash
pm2 reload tunixbot
```

## Stabilita e produzione

- Queue separata per ogni guild
- Gestione multi-server simultanea
- Auto-disconnect solo quando il bot resta da solo in vocale (10s)
- Controlli permessi utente/bot
- Error handling completo su comandi e player
- Messaggi ephemeral per errori/permessi quando utile

## Licenza

MIT
