# Sicurezza dei contatti in Directus

## Configurazione applicata il 19 ottobre 2026

I contatti del sito sono conservati nella collezione `richieste`.
Il permesso di lettura `22`, precedentemente assegnato alla policy pubblica,
e stato spostato alla `Frontend Policy`, usata dal token server `DIRECTUS_TOKEN`:

- Policy pubblica: `abf8a154-5b1c-4a46-ac9c-7300570f4f17`.
- Policy backend: `c732d763-802f-4199-8752-edd65191f69e`.
- Nessun dato dei contatti e stato modificato o eliminato.
- Il permesso pubblico di creazione e rimasto invariato.
- I permessi di lettura delle pagine pubbliche sono rimasti invariati.

La modifica e gia applicata sull'istanza Directus; non dipende dal deploy Astro.
Su altre istanze occorre configurare gli stessi vincoli nelle policy effettivamente
assegnate agli utenti anonimi e al backend, senza riutilizzare alla cieca gli ID.

## Verifica

```sh
npm test
npm run test:security
```

Il secondo comando esegue richieste reali, di sola lettura, contro
`PUBLIC_DIRECTUS_URL`, `DIRECTUS_URL` oppure, in assenza di entrambe,
`https://admin.controllocartellesattoriali.it`.
Verifica il blocco REST di elenco, singolo record e conteggio, il blocco GraphQL
e la disponibilita delle pagine pubbliche. Non recupera dati personali.

Per verificare anche l'accesso autenticato, fornire `DIRECTUS_TOKEN` nell'ambiente.
Con una versione di Node che supporta `--env-file` e il file `.env` locale:

```sh
node --env-file=.env --test tests/directus-security.live.mjs
```

Senza token il solo test autenticato viene saltato. I test non creano richieste,
non inviano email e non eseguono pagamenti; l'invio completo dei moduli non viene
quindi verificato da questa suite.
