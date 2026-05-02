const DEFAULT_LOCALE = 'en';

const dictionaries = {
  en: {
    errors: {
      genericOperation: 'An error occurred while processing your request.',
      commandExecution: 'An unexpected error occurred while running this command.',
      commandTitle: 'Command Error',
      buttonTitle: 'Button Error',
      sessionTitle: 'Session Not Found',
      sessionMissing: 'No active music session in this server.',
      noTrackTitle: 'No Track',
      noTrackPlaying: 'There is nothing playing right now.',
      invalidChannelTitle: 'Wrong Voice Channel',
      invalidChannelMessage: 'You must be in the same voice channel as the bot.',
      unsupportedAction: 'Unsupported action.',
      apiGeneric: 'API request failed.'
    },
    permissions: {
      voiceRequiredTitle: 'Voice Channel Required',
      voiceRequiredMessage: 'Join a voice channel before using music commands.',
      permsCheckFailedTitle: 'Permissions Check Failed',
      permsCheckFailedMessage: 'I cannot verify my permissions in this server.',
      missingPermsTitle: 'Missing Permissions',
      missingPermsMessage: 'I need the following permissions in the voice channel:\n{perms}',
      channelFullTitle: 'Cannot Join',
      channelFullMessage: 'The voice channel is full. Free a slot or increase the user limit.',
      invalidControlChannelTitle: 'Wrong Voice Channel',
      invalidControlChannelMessage: 'To control playback you must be in the same voice channel as the bot.'
    },
    embeds: {
      nowPlayingTitle: 'Now Playing',
      durationField: 'Duration',
      requestedByField: 'Requested by',
      volumeField: 'Volume',
      progressField: 'Progress',
      queueTitle: 'Music Queue',
      queueNowPlayingField: 'Currently Playing',
      queueEmpty: 'The queue is empty.',
      noTrackInline: 'No track',
      helpTitle: 'TunixBot Help',
      volumeUpdatedTitle: 'Volume Updated',
      volumeUpdatedMessage: 'Volume set to **{volume}%**',
      filterTitle: 'Audio Filter',
      filterMessage: 'Active filter: **{filter}**',
      playlistLoadedTitle: 'Playlist Loaded',
      playlistLoadedMessage: 'Added **{count}** tracks{suffix}.',
      dashboardButton: 'Dashboard',
      queueButton: 'Queue',
      pauseButton: 'Pause',
      resumeButton: 'Resume',
      skipButton: 'Skip',
      stopButton: 'Stop',
      loopButton: 'Loop: {loop}',
      volumeDownButton: 'Volume -10',
      volumeUpButton: 'Volume +10',
      endedTitle: 'Playback Ended',
      sessionEndedMessage: 'The session has ended.',
      lyricsTitle: 'Lyrics',
      lyricsUnavailableTitle: 'Lyrics Unavailable',
      nowPlayingEnded: 'The queue has ended.',
      nowPlayingStopped: 'Playback stopped. The bot stays in voice channel.',
      joinedTitle: 'Connected',
      joinedCreatedMessage: 'Joined **{channel}**. Open the dashboard using the button below.',
      joinedExistingMessage: 'Already in **{channel}**. Open the dashboard using the button below.',
      joinFailedTitle: 'Join Failed',
      filterErrorTitle: 'Filter Error',
      loopUpdatedTitle: 'Loop Updated',
      loopUpdatedMessage: 'Loop mode: **{mode}**',
      loopErrorTitle: 'Loop Error',
      pauseTitle: 'Paused',
      pauseMessage: 'Playback paused.',
      resumeTitle: 'Resumed',
      resumeMessage: 'Playback resumed.',
      playFailedTitle: 'Play Failed',
      removeTitle: 'Track Removed',
      removeMessage: 'Removed: **{title}**',
      removeErrorTitle: 'Remove Error',
      seekTitle: 'Seek',
      seekMessage: 'Position set to **{time}**.',
      seekInvalidTitle: 'Invalid Format',
      seekInvalidMessage: 'Use seconds or `mm:ss` / `hh:mm:ss` format.',
      seekErrorTitle: 'Seek Error',
      shuffleTitle: 'Shuffle',
      shuffleMessage: 'Queue shuffled successfully.',
      shuffleErrorTitle: 'Shuffle Error',
      skipMessage: 'Track skipped.',
      stopMessage: 'Playback stopped and queue cleared. I stay in the voice channel.',
      clearQueueTitle: 'Queue Cleared',
      clearQueueMessage: 'The queue has been cleared.',
      queueTrackAddedTitle: 'Track Queued',
      queueTrackAddedMessage: 'Added **{title}**',
      voiceAutoDisconnectTitle: 'Auto Disconnect',
      voiceAutoDisconnectMessage: 'I was alone in voice channel for 10 seconds. Disconnecting now.',
      trackErrorTitle: 'Track Error',
      trackErrorMessage: 'The current track failed. Skipping to the next one...',
      trackStuckTitle: 'Track Stuck',
      trackStuckMessage: 'The track got stuck. Skipping to the next one...',
      trackRecoverTitle: 'Track Recovery',
      trackRecoverFallbackMessage: 'Track **{title}** was not playable. Trying an alternative source...',
      trackRecoverTimeoutMessage: 'Track **{title}** did not start in time. Trying to recover...',
      sessionClosedTitle: 'Session Closed',
      sessionClosedMessage: 'I was disconnected from voice channel. Session closed.',
      autoplayTitle: 'Autoplay Enabled',
      autoplayMessage: 'Queue ended. Continuing with a Spotify related track:\n**{title}** - {author}',
      trackFailureSkip: 'Track recovery failed for: {title} - {author}'
    },
    dashboard: {
      loginRequired: 'Login required',
      sessionNotFound: 'No session found. Use /join from Discord in your target voice channel.',
      sessionGuildUnavailable: 'Session guild is no longer available.',
      connectedAndAuthorized: 'Connected and authorized.',
      enterSameVoice: 'Join the same voice channel as the bot to control music.',
      noSessionActive: 'No active music session.',
      noTrackPlaying: 'No track is currently playing.',
      oauthSecretMissing: 'Missing DISCORD_CLIENT_SECRET in .env',
      oauthIncomplete: 'Incomplete OAuth callback',
      oauthStateInvalid: 'Invalid OAuth state',
      oauthFailed: 'Login failed: {error}',
      errorSession: 'Session error',
      errorSearch: 'Search error',
      errorDiscover: 'Discover error',
      errorPlay: 'Play error',
      errorControl: 'Control error',
      errorLyrics: 'Lyrics unavailable',
      missingQuery: 'Missing parameter: query',
      missingAction: 'Missing parameter: action',
      invalidLoopMode: 'Invalid loop mode',
      unsupportedAction: 'Unsupported action',
      spotifyRequestError: 'Spotify request failed.',
      spotifyNotAllowed: 'Spotify section is not enabled for your account.',
      spotifyFeatureDisabled: 'Spotify user login is not configured on this dashboard.',
      spotifyNotConnected: 'Spotify account not connected.',
      spotifyOauthIncomplete: 'Incomplete Spotify OAuth callback.',
      spotifyOauthStateInvalid: 'Invalid Spotify OAuth state.',
      spotifyOauthFailed: 'Spotify login failed: {error}',
      spotifyLibraryFailed: 'Spotify library error',
      spotifyQueuePlaylistFailed: 'Failed to queue Spotify playlist',
      spotifyQueueLikedFailed: 'Failed to queue liked songs',
      spotifyPlaylistIdMissing: 'Missing Spotify playlist ID.',
      spotifyLikedEmpty: 'No liked songs found on this Spotify account.',
      spotifyLikedSongsName: 'Liked Songs',
      lyricsNotFound: 'Lyrics not found.',
      lyricsNotAvailableForTrack: 'Lyrics are not available for this track.',
      unknownVoice: 'Unknown Voice',
      unknownText: 'Unknown Text'
    },
    commands: {
      helpDescription: 'Show TunixBot command guide.',
      joinDescription: 'Make TunixBot join your voice channel.',
      playDescription: 'Play music from query or URL (YouTube/Spotify).',
      pauseDescription: 'Pause current track.',
      resumeDescription: 'Resume playback.',
      skipDescription: 'Skip current track.',
      stopDescription: 'Stop playback and clear queue (stay in voice channel).',
      queueDescription: 'Show music queue.',
      nowPlayingDescription: 'Show currently playing track.',
      volumeDescription: 'Set playback volume (0-200).',
      loopDescription: 'Set loop mode.',
      shuffleDescription: 'Shuffle queue.',
      removeDescription: 'Remove a track from queue by index.',
      clearQueueDescription: 'Clear the whole queue.',
      seekDescription: 'Move playback position (e.g. 90 or 1:30).',
      lyricsDescription: 'Show lyrics of current track.',
      filterDescription: 'Apply an audio filter.',
      optionQuery: 'Title, YouTube URL or Spotify URL',
      optionFilter: 'Filter',
      optionLoopMode: 'Loop mode',
      optionIndex: 'Queue position',
      optionTime: 'Seconds or mm:ss / hh:mm:ss',
      optionVolume: 'Volume value'
    },
    footer: 'TunixBot • Music System'
  },
  it: {
    errors: {
      genericOperation: 'Si e verificato un errore durante l operazione.',
      commandExecution: 'Si e verificato un errore durante il comando.',
      commandTitle: 'Errore Comando',
      buttonTitle: 'Errore Pulsante',
      sessionTitle: 'Sessione Non Trovata',
      sessionMissing: 'Nessuna sessione musicale attiva in questo server.',
      noTrackTitle: 'Nessun Brano',
      noTrackPlaying: 'Non c e nulla in riproduzione al momento.',
      invalidChannelTitle: 'Canale Non Valido',
      invalidChannelMessage: 'Devi essere nello stesso canale vocale del bot.',
      unsupportedAction: 'Azione non supportata.',
      apiGeneric: 'Errore API.'
    },
    permissions: {
      voiceRequiredTitle: 'Canale Vocale Richiesto',
      voiceRequiredMessage: 'Devi entrare in un canale vocale prima di usare i comandi musicali.',
      permsCheckFailedTitle: 'Permessi Non Verificabili',
      permsCheckFailedMessage: 'Non riesco a verificare i miei permessi in questo server.',
      missingPermsTitle: 'Permessi Mancanti',
      missingPermsMessage: 'Mi servono questi permessi nel canale vocale:\n{perms}',
      channelFullTitle: 'Impossibile Entrare',
      channelFullMessage: 'Il canale vocale e pieno. Libera uno slot oppure aumenta il limite utenti del canale.',
      invalidControlChannelTitle: 'Canale Non Valido',
      invalidControlChannelMessage: 'Per controllare la riproduzione devi essere nello stesso canale vocale del bot.'
    },
    embeds: {
      nowPlayingTitle: 'In Riproduzione',
      durationField: 'Durata',
      requestedByField: 'Richiesto da',
      volumeField: 'Volume',
      progressField: 'Progresso',
      queueTitle: 'Coda Musicale',
      queueNowPlayingField: 'Ora in Riproduzione',
      queueEmpty: 'La coda e vuota.',
      noTrackInline: 'Nessun brano',
      helpTitle: 'TunixBot Help',
      volumeUpdatedTitle: 'Volume Aggiornato',
      volumeUpdatedMessage: 'Volume impostato a **{volume}%**',
      filterTitle: 'Filtro Audio',
      filterMessage: 'Filtro attivo: **{filter}**',
      playlistLoadedTitle: 'Playlist Caricata',
      playlistLoadedMessage: 'Aggiunti **{count}** brani{suffix}.',
      dashboardButton: 'Dashboard',
      queueButton: 'Coda',
      pauseButton: 'Pausa',
      resumeButton: 'Resume',
      skipButton: 'Skip',
      stopButton: 'Stop',
      loopButton: 'Loop: {loop}',
      volumeDownButton: 'Volume -10',
      volumeUpButton: 'Volume +10',
      endedTitle: 'Riproduzione Terminata',
      sessionEndedMessage: 'La sessione e terminata.',
      lyricsTitle: 'Lyrics',
      lyricsUnavailableTitle: 'Lyrics Non Disponibili',
      nowPlayingEnded: 'La coda e terminata.',
      nowPlayingStopped: 'Riproduzione fermata. Il bot resta nel canale vocale.',
      joinedTitle: 'Connesso',
      joinedCreatedMessage: 'Entrato in **{channel}**. Vai nella dashboard con il bottone qui sotto.',
      joinedExistingMessage: 'Sono gia in **{channel}**. Puoi aprire la dashboard dal bottone qui sotto.',
      joinFailedTitle: 'Join Fallito',
      filterErrorTitle: 'Errore Filtro',
      loopUpdatedTitle: 'Loop Aggiornato',
      loopUpdatedMessage: 'Modalita loop: **{mode}**',
      loopErrorTitle: 'Errore Loop',
      pauseTitle: 'Pausa',
      pauseMessage: 'Riproduzione in pausa.',
      resumeTitle: 'Resume',
      resumeMessage: 'Riproduzione ripresa.',
      playFailedTitle: 'Play Fallito',
      removeTitle: 'Brano Rimosso',
      removeMessage: 'Rimosso: **{title}**',
      removeErrorTitle: 'Errore Remove',
      seekTitle: 'Seek',
      seekMessage: 'Posizione impostata a **{time}**.',
      seekInvalidTitle: 'Formato Non Valido',
      seekInvalidMessage: 'Usa secondi o formato `mm:ss` / `hh:mm:ss`.',
      seekErrorTitle: 'Errore Seek',
      shuffleTitle: 'Shuffle',
      shuffleMessage: 'Coda mischiata con successo.',
      shuffleErrorTitle: 'Errore Shuffle',
      skipMessage: 'Brano saltato.',
      stopMessage: 'Riproduzione fermata e coda rimossa. Rimango nel canale vocale.',
      clearQueueTitle: 'Coda Svuotata',
      clearQueueMessage: 'La coda e stata cancellata.',
      queueTrackAddedTitle: 'Brano In Coda',
      queueTrackAddedMessage: 'Aggiunto **{title}**',
      voiceAutoDisconnectTitle: 'Auto Disconnect',
      voiceAutoDisconnectMessage: 'Sono rimasto da solo nel canale vocale per 10 secondi. Mi disconnetto ora.',
      trackErrorTitle: 'Errore Traccia',
      trackErrorMessage: 'Il brano corrente ha generato un errore. Passo al prossimo...',
      trackStuckTitle: 'Traccia Bloccata',
      trackStuckMessage: 'La traccia si e bloccata. Passo al prossimo brano...',
      trackRecoverTitle: 'Recupero Traccia',
      trackRecoverFallbackMessage: 'Il brano **{title}** non era riproducibile.\nProvo una sorgente alternativa...',
      trackRecoverTimeoutMessage: 'Il brano **{title}** non e partito in tempo utile. Provo a recuperarlo...',
      sessionClosedTitle: 'Sessione Terminata',
      sessionClosedMessage: 'Sono stato disconnesso dal canale vocale. Sessione chiusa.',
      autoplayTitle: 'Autoplay Attivo',
      autoplayMessage: 'Coda finita. Continuo con un brano consigliato da Spotify:\n**{title}** - {author}',
      trackFailureSkip: 'Recupero fallito per: {title} - {author}'
    },
    dashboard: {
      loginRequired: 'Login richiesto',
      sessionNotFound: 'Nessuna sessione trovata. Usa /join da Discord nel canale vocale desiderato.',
      sessionGuildUnavailable: 'La guild della sessione non e piu disponibile.',
      connectedAndAuthorized: 'Connesso e autorizzato.',
      enterSameVoice: 'Entra nella stessa vocale del bot per controllare la musica.',
      noSessionActive: 'Nessuna sessione musicale attiva.',
      noTrackPlaying: 'Nessun brano in riproduzione.',
      oauthSecretMissing: 'DISCORD_CLIENT_SECRET mancante nel .env',
      oauthIncomplete: 'Callback OAuth incompleto',
      oauthStateInvalid: 'State OAuth non valido',
      oauthFailed: 'Login fallito: {error}',
      errorSession: 'Errore sessione',
      errorSearch: 'Errore ricerca',
      errorDiscover: 'Errore discover',
      errorPlay: 'Errore play',
      errorControl: 'Errore control',
      errorLyrics: 'Lyrics non disponibili',
      missingQuery: 'Parametro mancante: query',
      missingAction: 'Parametro mancante: action',
      invalidLoopMode: 'Loop mode non valido',
      unsupportedAction: 'Azione non supportata',
      spotifyRequestError: 'Errore richiesta Spotify.',
      spotifyNotAllowed: 'La sezione Spotify non e abilitata per il tuo account.',
      spotifyFeatureDisabled: 'Login Spotify utente non configurato su questa dashboard.',
      spotifyNotConnected: 'Account Spotify non collegato.',
      spotifyOauthIncomplete: 'Callback OAuth Spotify incompleto.',
      spotifyOauthStateInvalid: 'State OAuth Spotify non valido.',
      spotifyOauthFailed: 'Login Spotify fallito: {error}',
      spotifyLibraryFailed: 'Errore libreria Spotify',
      spotifyQueuePlaylistFailed: 'Impossibile mettere in coda la playlist Spotify',
      spotifyQueueLikedFailed: 'Impossibile mettere in coda i brani preferiti',
      spotifyPlaylistIdMissing: 'ID playlist Spotify mancante.',
      spotifyLikedEmpty: 'Nessun brano preferito trovato su questo account Spotify.',
      spotifyLikedSongsName: 'Brani Preferiti',
      lyricsNotFound: 'Lyrics non trovate.',
      lyricsNotAvailableForTrack: 'Lyrics non disponibili per questo brano.',
      unknownVoice: 'Unknown Voice',
      unknownText: 'Unknown Text'
    },
    commands: {
      helpDescription: 'Mostra guida completa dei comandi TunixBot.',
      joinDescription: 'Fa entrare TunixBot nel tuo canale vocale.',
      playDescription: 'Riproduce musica da query o link (YouTube/Spotify).',
      pauseDescription: 'Mette in pausa il brano corrente.',
      resumeDescription: 'Riprende il brano in pausa.',
      skipDescription: 'Salta il brano corrente.',
      stopDescription: 'Ferma la riproduzione e svuota la coda (resta in vocale).',
      queueDescription: 'Mostra la coda musicale.',
      nowPlayingDescription: 'Mostra il brano attualmente in riproduzione.',
      volumeDescription: 'Imposta il volume (0-200).',
      loopDescription: 'Configura la modalita loop.',
      shuffleDescription: 'Mischia la coda.',
      removeDescription: 'Rimuove un brano dalla coda per indice.',
      clearQueueDescription: 'Svuota completamente la coda.',
      seekDescription: 'Sposta il punto di riproduzione (es. 90 o 1:30).',
      lyricsDescription: 'Mostra il testo del brano attuale.',
      filterDescription: 'Applica un filtro audio.',
      optionQuery: 'Titolo, URL YouTube o URL Spotify',
      optionFilter: 'Filtro',
      optionLoopMode: 'Modalita loop',
      optionIndex: 'Numero in coda',
      optionTime: 'Secondi o formato mm:ss / hh:mm:ss',
      optionVolume: 'Valore volume'
    },
    footer: 'TunixBot • Music System'
  }
};

const knownErrorPatterns = [
  {
    match: /^Coda piena\. Limite massimo: (\d+) brani\.?$/i,
    it: 'Coda piena. Limite massimo: {limit} brani.',
    en: 'Queue is full. Maximum limit: {limit} tracks.'
  }
];

const knownErrorMap = {
  'Lavalink non e connesso al momento. Spotify e YouTube non possono riprodurre audio finche il nodo non torna online.': {
    it: 'Lavalink non e connesso al momento. Spotify e YouTube non possono riprodurre audio finche il nodo non torna online.',
    en: 'Lavalink is currently offline. Spotify and YouTube playback is unavailable until it reconnects.'
  },
  'Guild non trovata.': {
    it: 'Guild non trovata.',
    en: 'Guild not found.'
  },
  'Sono gia attivo in un altro canale vocale.': {
    it: 'Sono gia attivo in un altro canale vocale.',
    en: 'I am already active in another voice channel.'
  },
  'Sono gia collegato a un altro canale vocale.': {
    it: 'Sono gia collegato a un altro canale vocale.',
    en: 'I am already connected to another voice channel.'
  },
  'Nessun nodo Lavalink disponibile.': {
    it: 'Nessun nodo Lavalink disponibile.',
    en: 'No Lavalink node is currently available.'
  },
  'Nessun risultato trovato per la tua richiesta.': {
    it: 'Nessun risultato trovato per la tua richiesta.',
    en: 'No results found for your request.'
  },
  'Nessun brano in riproduzione.': {
    it: 'Nessun brano in riproduzione.',
    en: 'No track is currently playing.'
  },
  'Nessun brano da skippare.': {
    it: 'Nessun brano da skippare.',
    en: 'No track available to skip.'
  },
  'Nessuna sessione attiva.': {
    it: 'Nessuna sessione attiva.',
    en: 'No active session.'
  },
  'Modalita loop non valida. Usa: off, song, queue': {
    it: 'Modalita loop non valida. Usa: off, song, queue',
    en: 'Invalid loop mode. Use: off, song, queue.'
  },
  'Indice non valido.': {
    it: 'Indice non valido.',
    en: 'Invalid queue index.'
  },
  'Brano non trovato in coda.': {
    it: 'Brano non trovato in coda.',
    en: 'Track not found in queue.'
  },
  'Tempo oltre la durata del brano.': {
    it: 'Tempo oltre la durata del brano.',
    en: 'Seek time exceeds track duration.'
  },
  'Filtro non valido.': {
    it: 'Filtro non valido.',
    en: 'Invalid filter.'
  },
  'Testo non trovato.': {
    it: 'Testo non trovato.',
    en: 'Lyrics not found.'
  },
  'Nessuna sessione musicale attiva.': {
    it: 'Nessuna sessione musicale attiva.',
    en: 'No active music session.'
  },
  'Spotify non configurato. Imposta SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.': {
    it: 'Spotify non configurato. Imposta SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.',
    en: 'Spotify is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.'
  },
  'Spotify track URL non valido': {
    it: 'Spotify track URL non valido',
    en: 'Invalid Spotify track URL.'
  },
  'Spotify album URL non valido': {
    it: 'Spotify album URL non valido',
    en: 'Invalid Spotify album URL.'
  },
  'Spotify playlist URL non valido': {
    it: 'Spotify playlist URL non valido',
    en: 'Invalid Spotify playlist URL.'
  },
  'Link Spotify non valido': {
    it: 'Link Spotify non valido',
    en: 'Invalid Spotify link.'
  },
  'Tipo Spotify non supportato': {
    it: 'Tipo Spotify non supportato',
    en: 'Unsupported Spotify type.'
  },
  'Spotify API non raggiungibile in questo momento. Riprova tra poco.': {
    it: 'Spotify API non raggiungibile in questo momento. Riprova tra poco.',
    en: 'Spotify API is currently unreachable. Please try again shortly.'
  },
  SPOTIFY_NOT_CONNECTED: {
    it: 'Account Spotify non collegato.',
    en: 'Spotify account not connected.'
  },
  SPOTIFY_REFRESH_TOKEN_MISSING: {
    it: 'Refresh token Spotify mancante. Ricollega il tuo account Spotify.',
    en: 'Spotify refresh token missing. Please reconnect your Spotify account.'
  },
  SPOTIFY_PLAYLIST_ID_MISSING: {
    it: 'ID playlist Spotify mancante.',
    en: 'Missing Spotify playlist ID.'
  },
  'Loop mode non valido': {
    it: 'Loop mode non valido',
    en: 'Invalid loop mode.'
  },
  'Azione non supportata': {
    it: 'Azione non supportata',
    en: 'Unsupported action.'
  },
  'Lyrics non trovate.': {
    it: 'Lyrics non trovate.',
    en: 'Lyrics not found.'
  },
  'Lyrics non disponibili per questo brano.': {
    it: 'Lyrics non disponibili per questo brano.',
    en: 'Lyrics are not available for this track.'
  },
  'Callback OAuth incompleto': {
    it: 'Callback OAuth incompleto',
    en: 'Incomplete OAuth callback.'
  },
  'State OAuth non valido': {
    it: 'State OAuth non valido',
    en: 'Invalid OAuth state.'
  },
  'Impossibile leggere profilo Discord': {
    it: 'Impossibile leggere profilo Discord',
    en: 'Unable to read Discord profile.'
  },
  'Impossibile leggere guild Discord utente': {
    it: 'Impossibile leggere guild Discord utente',
    en: 'Unable to read user Discord guilds.'
  }
};

const safeGet = (source, key) => {
  if (!source || !key) return undefined;
  return String(key)
    .split('.')
    .reduce((acc, part) => (acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined), source);
};

const interpolate = (template, vars = {}) => {
  if (typeof template !== 'string') return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return `{${name}}`;
    return String(vars[name]);
  });
};

const normalizeLocale = (rawLocale) => {
  const normalized = String(rawLocale || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_LOCALE;
  if (normalized === 'it' || normalized.startsWith('it-')) return 'it';
  return 'en';
};

const getInteractionLocale = (interaction) => normalizeLocale(interaction?.locale || interaction?.guildLocale);

const t = (locale, key, vars = {}) => {
  const resolvedLocale = normalizeLocale(locale);
  const localized = safeGet(dictionaries[resolvedLocale], key);
  if (typeof localized === 'string') return interpolate(localized, vars);

  const fallback = safeGet(dictionaries[DEFAULT_LOCALE], key);
  if (typeof fallback === 'string') return interpolate(fallback, vars);

  return key;
};

const translateKnownErrorMessage = (message, locale) => {
  const raw = String(message || '').trim();
  if (!raw) return null;

  const direct = knownErrorMap[raw];
  if (direct) return direct[normalizeLocale(locale)] || direct.en || raw;

  for (const pattern of knownErrorPatterns) {
    const match = raw.match(pattern.match);
    if (!match) continue;
    const vars = { limit: match[1] };
    return interpolate(pattern[normalizeLocale(locale)] || pattern.en || raw, vars);
  }

  return null;
};

const localizeErrorMessage = (locale, error, fallbackKey = 'errors.genericOperation') => {
  const message =
    typeof error === 'string' ? error : typeof error?.message === 'string' ? error.message : '';
  const resolvedLocale = normalizeLocale(locale);

  const known = translateKnownErrorMessage(message, resolvedLocale);
  if (known) return known;

  if (message && resolvedLocale === 'it') return message;
  if (message && resolvedLocale === 'en') {
    const looksItalian = /\b(nessun|errore|riproduzione|brano|coda|canale|sessione|impossibile|permessi|traccia)\b/i.test(
      message
    );
    if (!looksItalian) return message;
  }

  return t(resolvedLocale, fallbackKey);
};

module.exports = {
  DEFAULT_LOCALE,
  dictionaries,
  normalizeLocale,
  getInteractionLocale,
  t,
  translateKnownErrorMessage,
  localizeErrorMessage
};
