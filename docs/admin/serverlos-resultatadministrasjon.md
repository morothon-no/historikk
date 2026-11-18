# Nettbasert resultatadministrasjon uten egen server

Status: implementert, men ikke ende-til-ende-verifisert med eierens konto. Ingen ekstern tjeneste er aktivert, ingen legitimasjon er lagt inn og ingen ekte resultatrettelse er publisert av denne leveransen.

## Det som er implementert

Eksisterende Pages-admin under `https://historikk.morothon.no/admin/` får en valgfri tilkobling til en liten serverløs mellomtjeneste. Frontend blir på Pages. Eksisterende deltakersøk, resultatvelger og C2-kontroll brukes videre. Den eksisterende Node-/containerløsningen beholdes som et valgfritt alternativ, ikke et driftskrav.

Flyten er GitHub-innlogging → finn løper → rett eksisterende resultat → lagre og kontroller privat → se før/etter → godkjenn og publiser → kontroller offentlig profil. Historikken viser tidligere og nye verdier, godkjenner, tidspunkt og profillenke. «Trekk tilbake» lager et nytt kontrollert utkast; en egen bekreftelse kreves før publisering.

Siste rettelse kan tilbakeføres. En eldre rettelse kan også tilbakeføres hvis senere publiseringer ikke berører samme resultatlinje. Hele publiseringsjournalen kontrolleres, også dersom en senere endring satte verdien tilbake til det samme. Ingen reset eller sletting av commits brukes.

Personsammenslåing og nye resultatregistreringer publiseres ikke i denne flyten. Bare eksisterende resultatlinjer med versjonsbundet selector støttes. DNS/DNF, plasseringer, profiler, rekorder, merker og øvrige konsekvenser beregnes av de eksisterende motorene. Et importert godkjenningsflagg er aldri eierautorisasjon.

## Tre avgrensede deler

1. **Pages:** eksisterende grensesnitt og godkjente offentlige data. Ny kode ligger i allerede godkjent `admin/web-transport.js`; ingen ny offentlig filtype eller utvidelse av datapakken. Metafeltet `morothon-admin-service` er tomt inntil aktivering godkjennes. Med tomt felt er dagens portal uendret.
2. **Mellomtjeneste:** standard Request/Response, Node-krypto, injiserbare lagrings-/OAuth-adaptere. Den valgfrie `worker.mjs` bruker Cloudflare Workers Free for korte autentiserings-, CAS- og køoperasjoner. Ingen tung Chromium-beregning kjører i Worker.
3. **Privat kontrolljobb:** eksisterende #86/#89-motorer i en manuelt startet, nøyaktig versjonsbundet privat Actions-workflow. Den beregner konsekvenser, tester backup/restore og offentlig bygg, oppretter eksakt data-PR, følger obligatoriske tester/beskyttet merge og kontrollerer alle publiserte filer og berørte profiler før status kan bli «Publisert».

Privat lagring bruker et eksisterende privat GitHub-repository som adapter, ikke en ny database. `main` inneholder bare gjennomgått workflow. Kryptert tilstand ligger på **egen `admin-state`-gren**. Dermed endrer ikke hver lagring den godkjente workflow-SHA-en. Hver skrivning bruker GitHub blob-SHA og separat innholdsrevisjon; samtidige lagringer avvises. AES-256-GCM binder ciphertext til den eksakte posten/filstien.

Publiseringsbackupens store, komprimerte før-/etterfiler lagres én gang som en separat kryptert, innholdsadressert payload. Løpende jobbstatus er liten. Denne private kopien gir gjenopprettbare endringer og historikk, men er **ikke en uavhengig backup av hele GitHub-kontoen**. Tidligere parkert A1D-backup/migrering gjenopptas ikke.

## Sikkerhetsgrenser

- Kun forhåndsgodkjent numerisk GitHub-ID kan logge inn som eier. Intern UUID, ekstern identitet og medlemskap holdes atskilt; ingen automatisk kontokobling.
- Offisiell OAuth med PKCE, fem minutters flow og HttpOnly/Secure/SameSite=Lax-cookie på mellomtjenesten. Full sideomdirigering unngår avhengighet av tredjepartscookies. Pages får en engangskode bundet til PKCE, gyldig i ett minutt.
- Bare engangsverifikator/state lagres kort i `sessionStorage`, og fjernes ved retur. OAuth-token og klienthemmelighet forlater aldri mellomtjenesten. Det kortvarige ugjennomsiktige API-sessiontokenet eksisterer bare i minnet i fanen, aldri i localStorage, sessionStorage eller URL. Økten varer maksimalt 15 minutter; nytt innloggingsforsøk kreves etter oppfriskning. Private utkast bevares.
- API krever eksakt tillatt Origin og eksplisitt bearer-token; ingen cookie-basert ambient API-autorisasjon. CORS tillater bare Pages-origin, GET/POST og Authorization/Content-Type. Skriving krever JSON og avgrenset størrelse. Rollepåstander fra klienten ignoreres. Ingen åpen skrive- eller godkjenningsrute.
- Worker-konfigurasjon krever to rate-limit-bindinger. De begrenser innlogging/processor-lease til 5 og øvrige API-kall til 60 per minutt og IP, men er omtrentlig og per Cloudflare-lokasjon, ikke en global streng kvote. Ikke stol på rate limiting som identitetskontroll.
- Privat lager må fortsatt være privat med forventet repositorynavn og main. Lagring er sperret ellers. Ingen administrative originalregistre kopieres eller leses av den nye private kontrolljobben.
- Bare en GitHub-signert OIDC-identitet fra det eksakte private repository-ID-et, privat synlighet, main-ref, godkjent workflow-SHA/sti, workflow_dispatch, GitHub-hosted runner og konfigurert App-bot-ID kan hente en lease. Jobben må også ha eiergodkjent task/nonce, kodeversjon og tidsfrist. Leasen bindes til én run-ID. En offentlig PR-/Actions-jobb kan ikke hente den.
- Leasen inneholder kortvarige repoavgrensede installasjonstokens og lagringsnøkkel, ikke App-private key eller OAuth secret. Privat jobbs logg maskerer verdiene umiddelbart. Validering/tilbakeføringsforberedelse får bare leserettigheter i offentlig repository; publish/continue får #89-publiseringsrettighetene. Ingen private artifacts eller credential caches lastes opp.
- Privat workflow henter kun gjennomgått **offentlig prosessorkode på nøyaktig commit** anonymt med sparse checkout. Den sjekker at original `data/`, eksportleser og kildeeksportskript ikke finnes. Den kjører ikke kode fra publiserings-PR-en og har ingen PR-trigger.
- Eksisterende A1C-datapolicy, uavhengig artifact-gate, fire påkrevde PR-statuser, strict branch protection, fem datafiler og eksplisitte publiseringsvariabler beholdes. Publiseringsappen skal ikke ha bypass og skal aldri godkjenne sin egen PR.

Hvis GitHub krever menneskelig review vises at godkjenning gjenstår. Dette er **ikke** automatisk én-knapps publisering. Etter tillatt review kan eieren velge «Kontroller og fortsett» i admin. Ingen påstand om aktiv branch protection eller korrekt App-installasjon gjøres før dette er verifisert i målmiljøet.

Nettside-XSS er fortsatt en risiko for en aktiv økt i fanen. Kort levetid og fravær av lagrede tokens begrenser konsekvensen, men erstatter ikke trygg DOM-rendering og beskyttet frontendkode. Endring av sikkerhets-/publiseringskode krever fortsatt normal gjennomgang. Native Worker-limiter og én privat jobb om gangen er driftsadaptere; de definerer ingen nye personregler.

## Konkret engangsoppsett – krever eiergodkjenning

Dette skal utføres én gang etter kodegjennomgang. Oppsettet er ikke utført i denne PR-en. Eieren skal ikke bruke terminal eller håndtere filer ved hver resultatrettelse.

1. **Godkjenn Workers Free og privat jobb.** Bruk en organisasjonseid Cloudflare-konto, gratisplan og en `*.workers.dev`-adresse. Ingen DNS-endring eller betalt abonnement trengs. Godkjenn at krypterte utkast/jobber lagres i `morothon-no/historikk-admin`; dette kopierer ikke de administrative originalregistrene. Verifiser private synlighet og repository-ID før opprettelse av tilstand.
2. **Godkjenn én GitHub App og OAuth-klient.** Gjenbruk eksisterende hvis tilgjengelig. Eier bekrefter sin numeriske GitHub-ID gjennom GitHub; login-navn er ikke tilstrekkelig. App installeres bare på `historikk` og `historikk-admin`, uten branch-protection-bypass. Repositoryrettigheter: Contents read/write, Pull requests read/write, Actions read/write, Variables read/write, Checks read, Administration read, Metadata read. Ingen organisasjons-/brukeradministrasjon. OAuth-klient trenger kun `read:user`; callback er `https://<valgt-worker-adresse>/auth/callback`, hjemmeside er eksisterende `/admin/`. Ikke lim hemmeligheter inn i chat eller repository.
3. **Legg hemmeligheter i godkjent hemmelighetslager.** Mellomtjenesten trenger `OAUTH_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY` og en separat kryptografisk tilfeldig 32-byte `STORAGE_KEY` (64 hextegn). Nøkkelen skal oppbevares separat fra eksport av ciphertext. Øvrige verdier er ikke-hemmelige og står i konfigurasjonsmalen. En organisasjonseid tjenestekonto bør eie integrasjonen, med sikker gjenoppretting og totrinnskontroll.
4. **Teknisk klargjøring kan deretter utføres samlet.** Installer `deploy/admin-serverless/private-workflow.yml.example` som `.github/workflows/morothon-result-job.yml` i privat main; opprett separat admin-state-gren uten persondata. Sett nøyaktig gjennomgått offentlig main-SHA, broker-URL og privat workflow-SHA. Konfigurer privat repo-ID og App-botens numeriske actor-ID. Gi aldri offentlig workflow en privat nøkkel eller token. Pinning endres ved gjennomgått kodeoppdatering, ikke ved hver resultat-/utkastendring.
5. **Aktiver den godkjente adressen.** Kopier Wrangler-malen til en faktisk `.jsonc`-fil uten hemmeligheter, fyll public vars og deploy den gjennomgåtte Worker-bundlen. Installer ikke en kontinuerlig server. Sett deretter kun offentlig service-origin i metafeltet i adminmalen og publiser gjennom vanlig beskyttet Pages-flyt. Uten dette siste trinnet forblir live-admin i dagens testmodus.
6. **Eieren prøver innlogging og velger én allerede bekreftet rettelse.** Før faktisk publisering trengs uttrykkelig godkjenning av den konkrete før-/etterverdien. Verifiser ny offentlig profil, og avtal test av tilbakeføring. Ikke registrer en oppdiktet korrigering i virkelige data bare for å teste.

Ved behov for en teknisk deploykommando for den som utfører godkjent oppsett, bruk et separat oppsettmiljø med Wrangler 4.164.0, for eksempel `wrangler deploy --config <utfylt-konfigurasjon>.jsonc`. Malens `.example`-endelse må fjernes; Wrangler tolker ikke denne som JSONC. Ingen ny npm-avhengighet legges i Morothons applikasjon.

Cloudflare-nodekompatibilitet krever `nodejs_compat`. Privat jobbs system-Chrome må ha fungerende Linux-sandbox; `checkSandbox()` stanser jobben hvis PID-/Seccomp-sandbox mangler. Ikke erstatt kontrollen med `--no-sandbox` i drift.

## Gratisgrenser og begrensninger

Kontrollert 18. november 2026 mot Cloudflares dokumentasjonskilder: Workers Free har 100 000 forespørsler/døgn og 10 ms CPU per forespørsel. Nettverksventing er ikke CPU-tid. Derfor ligger tunge beregninger/PDF/profilkontroll i privat Actions, og store backup-payloads krypteres der. Wrangler 4.164.0 bundler uten nye appavhengigheter; AES-GCM og RSA-JWT er også prøvd i lokal workerd med syntetiske nøkler. Eksplisitte Buffer-inndata brukes for Node-krypto-kompatibilitet. Lokal bundling og runtime-kontroll erstatter ikke en måling på ekte Free-instans; 10 ms-budsjettet og eventuell rate-limit-tilgjengelighet skal kontrolleres under engangsoppsettet. Ikke oppgrader til betalt plan automatisk.

Private GitHub Actions bruker organisasjonens inkluderte minutter; eksakt tilgjengelig kvote avhenger av eksisterende abonnement/forbruk. Sett budsjett/overforbruk til 0 før aktivering. En ny rettelse kan kjøre eksisterende offentlige PR- og main-tester samt en privat kontrolljobb på inntil 45 minutter. Ved oppbrukt kvote stoppes jobben; dette er ikke ubegrenset gratis drift. Ingen artifacts, ekstern database eller betalt lagringsabonnement er nødvendig i denne første modellen. GitHub API-kvoten gjelder også; UI poller hvert 15. sekund under jobb, tung jobb hvert minutt. Tjenesten gir aldri en vellykket publiseringsmelding ved tidsavbrudd.

Kilder:

- <https://developers.cloudflare.com/workers/platform/limits/>
- <https://developers.cloudflare.com/workers/platform/pricing/>
- <https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/>
- <https://docs.github.com/en/billing/concepts/product-billing/github-actions>
- <https://docs.github.com/en/actions/reference/security/oidc>

## Feil, gjenopptak og flytting

En kølagt jobb med ukjent dispatch-utfall beholder samme ID og nonce ved eksplisitt nytt oppstartsforsøk. En oppstart som ikke er leased kan avbrytes av eieren; gammel godkjenning blir ugyldig. En startet jobb kan ikke annulleres gjennom denne snarveien. Ved avbrutt workflow beholdes utkast, backup og publiseringsreservasjon; ingen stille ny produksjonsskriving. «Kontroller og fortsett» bruker samme sporbare publisering.

Hvis main allerede er merget, men deploy feilet, kan continuation lese samme kildekontrollerte snapshot uten krav om grønn main bare for å gjenoppta denne jobben. Ny `prepare()` krever fortsatt grønn main. Bare ett avgrenset full-rerun av den allerede kjente policy-merge-racen er tillatt fra #89. Andre testfeil omgås ikke.

Kjernegrensene er autentisering, intern bruker/medlemskap, generisk `get`/`transact`-lagring, resultatkontroll og publiseringsadapter. Ny OAuth-leverandør skal kobles sikkert til samme interne UUID. GitHub-lagring kan erstattes uten å endre selectors eller resultatmotor. Cloudflare-adapteren kan erstattes med en annen Request/Response-host eller eksisterende Node-tjeneste. Ingen Cloudflare/Fly.io-SDK eller database er brukt i kjernelogikken.

Ved flytting: stopp nye jobber, vent på/avklar aktive publiseringer, eksporter hele admin-state-historikken kryptert, eksporter konfigurasjon og separate nøkler sikkert, verifiser SHA-256, gjenopprett i isolert privat miljø og test CAS, utkast, journal, login og public-verifisering. Bevar alle interne ID-er og godkjenningshendelser. Invalider aktive økter og roter leverandørlegitimasjon. Bytt bare offentlig service-origin etter godkjent restore-test. Behold forrige miljø til kontrollert tilbakeføring er prøvd. Et privat Git-repository alene erstatter ikke en separat, godkjent backupdestinasjon.

## Test og faktisk ferdigkriterium

`tests/serverless-admin.cjs` bruker syntetisk OAuth, ekte kryptografi/JWK-signaturer, kryptert CAS, samme private driver og publiseringsmotor. `tests/serverless-admin-browser.cjs` bruker eksisterende Pages-grensesnitt i Chromium, syntetiske resultater, isolert ekte Git, eksisterende bygg og faktiske løperprofilkontroller. OAuth/Actions-nettverket simuleres eksplisitt; testen er ikke en påstand om live-innlogging eller produksjonsdeploy.

Kjør separat `node --test tests/serverless-admin.cjs tests/serverless-admin-browser.cjs tests/result-publication.cjs tests/github-result-publisher.cjs`, deretter `npm test` i komplett betrodd checkout og `npm run build`. Ingen nye source-tester skal beskrives som kjørt i offentlig sparse PR-jobb dersom den ikke omfatter dem; full betrodd kjøring dokumenteres separat.

Live-aksept krever fortsatt at eieren ved eksisterende nettadresse logger inn, finner riktig virkelig resultat, lagrer/gjenåpner, godkjenner, får riktig offentlig verdi og trekker den tilbake med samme kontroller. Frem til dette er demonstrert er leveransen **implementert, men ikke ende-til-ende-verifisert**.
