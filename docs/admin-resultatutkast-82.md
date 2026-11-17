# #82 – innlogging og varige resultatkorrigeringer, første leveranse

Dette dokumenterer #82. Den separate, valgfritt aktiverte publiseringsleveransen
er beskrevet i [#87 – resultatpublisering](admin-resultatpublisering-87.md).

Dette kobler den **eksisterende** adminportalen til en autentisert Node-tjeneste.
Arrangøren bruker nettleseren: finn deltaker → «Rett et resultat» → rediger →
«Vis før/etter» → «Lagre utkast» → gjenåpne → «Godkjenn lagret utkast».
Verken utkast eller godkjenning endrer offentlige resultater.

**Tjenesten er implementert og integrasjonstestet, men er ikke satt i drift.**
GitHub Pages kan ikke kjøre serveren. Den offentlige Pages-portalen beholder
dagens funksjoner, uten en falsk serverlagringsknapp. Ingen hosting, konto,
OAuth-app, database, DNS-endring eller betalt tjeneste er opprettet.

## Hva som faktisk fungerer

- GitHub OAuth med engangs-state, nettleserbinding og PKCE. Bare en allerede
  registrert ekstern identitet slipper inn. Ingen registrering ut fra navn,
  e-post eller GitHub-brukernavn; ingen repository-scope eller Git-skriving.
- Uforutsigbare serverøkter, `__Host-`-cookie med `Secure`, `HttpOnly` og
  `SameSite=Lax`. CSRF-token finnes bare i øktminnet og sendes i egen header.
  Serveren sjekker Origin, HTTP-metode, innholdstype, størrelse og arrangørrolle.
  Ingen CORS-åpning, nettleserlagring av hemmeligheter eller anonym skrivemodus.
- Rett eksisterende resultat via dagens deltakersøk og C2.2/C2.3-editor.
  Resultatvalg, førverdier, kilde og begrunnelse bruker samme rettelseskontrakt.
  «Vis før/etter» og «Lagre utkast» tar med de aktuelle skjemaverdiene; de
  lagrer ikke stille en tidligere versjon dersom felt er endret etter kontroll.
- Serveren gjentar kilde-, status-, identitets- og konsekvenskontrollene. Den
  bruker **den eksisterende `C2Project`-motoren**, inkludert faktiske profil-,
  rekord-, plasserings-, merke-, lojalitets- og diplomregler. Klientens beregning
  eller `handoff`-flagg er aldri en servergodkjenning.
- Eksisterende `privateFileStore` lagrer AES-256-GCM-kryptert, bundet til
  arrangøren, utenfor Git og offentlig bygg. Atomiske skriv, revisjonskontroll,
  før-/etterverdier og aktørlogg beholdes. Ny redigering opphever godkjenningen.
  En foreldet historikkversjon eller samtidig skriving avvises.
- Gjenåpning etter ny nettleserøkt og omstart av autentisering, lagringsadapter
  og revisjonstjeneste er testet. Hentingen er eksplisitt og spør før den
  erstatter et eksisterende arbeid i fanen.
- Tilgang kontrolleres ved hvert API-kall. Arrangør og rolle kommer fra serveren,
  aldri fra en kropp, URL eller nettleserbeslutning. Kun `sogne-morothon`
  aktiveres i oppstartskonfigurasjonen.

| Rolle | Hente lagret arbeid | Endre/lagre utkast | Godkjenne | Publisere |
| --- | --- | --- | --- | --- |
| `owner` | Ja | Ja | Ja | Nei |
| `editor` | Ja | Ja | Nei | Nei |
| `viewer` | Ja | Nei | Nei | Nei |

Bare én `owner` opprettes ved serveroppstart. Rollemodellen er forberedt og
testet; denne leveransen har ingen invitasjoner eller brukeradministrasjon.
Offentlig visning/eksisterende verktøy kan fortsatt gjøre lokale beregninger;
det gir ingen rett til å lagre eller godkjenne på serveren.

## Leverandøruavhengige kontoer

Autentisering og autorisasjon er skilt i egne små moduler:

- `account-directory.cjs`: interne brukere med stabile UUID-er, separate
  eksterne identiteter `(provider, subject) → userId` og medlemskap
  `(userId, organizerId, role, active)`. Én ekstern identitet kan bare tilhøre
  én intern bruker. UUID-en genereres én gang ved klargjøring, **aldri** fra
  GitHub-ID, e-post eller brukernavn og aldri på nytt ved innlogging/omstart.
- `github-auth.cjs`: kun OAuth-håndtrykket og oppslag av en forhåndsregistrert
  leverandøridentitet. GitHub er første adapter, ikke brukerregisteret.
- `session-auth.cjs`: leverandøruavhengige økter som bare lagrer intern `userId`.
- `access-control.cjs`: medlemskap, rettigheter og intern revisjonsaktør.
- `result-review.cjs`: bruker de eksisterende rettelses- og lagringstjenestene;
  den kjenner ingen GitHub-identitet, OAuth-token eller repository-tilgang.

Oppstartskonfigurasjonen oppretter tre separate registreringer i det private
kontoregisteret. Verdiene kommer fra varig serverkonfigurasjon, ikke fra
nettleseren. Ingen konto/person kobles automatisk. Flere arrangører kan senere
bruke samme interne konto via separate medlemskap uten å dele resultatgrunnlag.

Ved et senere leverandørbytte beholdes interne UUID-er, medlemskap,
arrangør-ID-er, lagrede utkast, krypteringsnøkler og revisjonsaktører.
En ny adapter skal bevise en ekstern identitet og slå opp samme interne bruker.
Resultatdata og brukere skal ikke migreres eller gjenopprettes.

**Kontokobling er ikke implementert eller eksponert.** Før en ny ekstern identitet
knyttes til en eksisterende bruker, må brukeren nylig ha autentisert både den
eksisterende kontoen og den nye leverandøridentiteten i en kortlivet, engangs,
CSRF-beskyttet flyt. Unik kobling må håndheves atomisk, hendelsen må logges på
intern bruker-ID, og aktive økter må tilbakekalles ved frakobling/overtakelsesfare.
Lik e-post/navn eller et importert JSON-dokument er ikke bevis. Gjenoppretting
uten tilgang til gammel leverandør krever separat dokumentert identitetskontroll.
Ingen av disse nye innloggings-/koblingsmetodene aktiveres her.

## Konkret driftsblokkering og minste oppsett

Det mangler **en godkjent serverplassering med HTTPS, varig privat disk og en
GitHub OAuth-app**. Ingen eksisterende privat databaseforbindelse eller drifts-
legitimasjon er konfigurert i repoet. PostgreSQL-adapteren kan gjenbrukes senere;
første leveranse krever ingen ny database eller nye npm-avhengigheter.

Anbefalt minstevalg: én arrangøreid Linux-tjeneste, uprivilegert Node 24-prosess,
Chromium med fungerende sandbox og en vedlikeholdt HTTPS-reverseproxy.
Samme bygde adminfiler gjenbrukes; dette er ikke en alternativ localhost-app.
Tjenesten lytter bare på `127.0.0.1`; kun HTTPS-proxyen skal ta imot trafikk.

For å beholde **`https://historikk.morothon.no/admin/`** må proxyen rute
`/admin/`, `/admin-api/` og `/auth/` til denne tjenesten, mens den offentlige
Adelskalenderen fortsatt leveres som det samme kontrollerte statiske bygget.
GitHub Pages alene kan ikke rute API-ene. Dette nettverks-/driftsoppsettet er
ikke endret i PR-en. Dersom en separat admin-vert velges senere, bruker den
fortsatt samme portal; hele innloggingsflyten og API-et må ha **samme HTTPS-origin**.
Ingen ad hoc CORS- eller frontend-tokenløsning skal legges til.

Driftsansvarlig må sette følgende **på serveren**, ikke i repo, Pages eller PR:

| Konfigurasjon | Betydning |
| --- | --- |
| `MOROTHON_ADMIN_ORIGIN` | Eksakt HTTPS-origin, uten sti eller avsluttende `/` |
| `MOROTHON_ADMIN_SITE` | Absolutt sti til det godkjente, uendrede offentlige byggeproduktet |
| `MOROTHON_ADMIN_APPROVAL` | Absolutt sti til tilhørende betrodde `public-data-approval.json` |
| `MOROTHON_ADMIN_PRIVATE_DIR` | Varig privat mappe utenfor alle Git-arbeidstrær, modus `0700` |
| `MOROTHON_ADMIN_STORAGE_KEY` | Stabil, tilfeldig 256-bit nøkkel som 64 heksadesimale tegn, fra hemmelighetslager |
| `MOROTHON_OWNER_USER_ID` | Én stabil intern UUID, beholdes ved alle senere leverandør-/driftsbytter |
| `MOROTHON_OWNER_GITHUB_ID` | Den bekreftede administratorens numeriske GitHub-ID; separat ekstern kobling |
| `MOROTHON_GITHUB_CLIENT_ID` | OAuth-appens klient-ID |
| `MOROTHON_GITHUB_CLIENT_SECRET` | OAuth-appens hemmelighet, kun serverens hemmelighetslager |
| `PORT` | Intern port, standard `3000` |
| `CHROMIUM_PATH` | Eventuelt annen absolutt sti til vedlikeholdt Chromium |

OAuth-appens callback er `<MOROTHON_ADMIN_ORIGIN>/auth/github/callback`.
Proxyen må bevare korrekt `Host`, aldri cache `/admin/`, `/admin-api/` eller
`/auth/`, og maskere/utelate callback-query, cookies og autorisasjonsheadere i
tilgangslogger. Koden logger ikke OAuth-koder, tokens, utkast eller nøkkelverdier.

Driftskommando, etter vanlig installasjon av repoets eksisterende avhengigheter:

```sh
node scripts/admin-web.cjs
```

Dette er **driftsansvarliges** engangsklargjøring. Arrangøren bruker deretter
nettleseren og trenger ingen terminal, lokale programmer eller manuell filredigering.
Ingen konfigurasjon fylles ut med faktiske hemmeligheter av denne PR-en.

Før virkelige utkast tas i bruk må privat volum og separat nøkkelkopi ha godkjent
backup/restore og retensjon. Det tidligere parkerte backup-/migreringsarbeidet
gjenopptas ikke automatisk. En testmappe på flyktig disk er ikke produksjonslagring.

## Sikkerhetsgrenser og gjenværende begrensninger

- Tillitsroten for kildegrunnlag er eksisterende A1C-godkjenning. Tjenesten leser
  bare det godkjente offentlige byggeproduktet, ingen administrative originaler.
  Endres den godkjente dataversjonen, stopper lagring/godkjenning frem til en
  kontrollert omstart med nytt bygg. Foreldede utkast bevares, men må gjennomgås;
  automatisk rebase av rettelser er ikke implementert.
- Beregninger gjøres i isolerte engangskontekster med nettverk sperret gjennom
  en eksakt fil-liste over bygget. Serverens nøkler eller prosessmiljø overføres
  ikke til siden. Én tung API-kontroll kjører om gangen.
- Produksjonsstart krever Chromium-sandbox og har **ingen usikret fallback**.
  Dette Codex-miljøet mangler en fungerende SUID/userns-sandbox. Nettlesertestene
  bruker eksisterende testpraksis med en eksplisitt injisert testnettleser uten
  sandbox, syntetiske kontoer og en lokal test-TLS-sertifikat. Dette er ikke
  dokumentasjon på at en fremtidig server er korrekt herdet.
- Tilgangsregistre er i første versjon en privat, skrivebeskyttet bootstrap fra
  serverkonfigurasjon. Endringer krever kontrollert konfigurasjonsendring og
  omstart, som også ugyldiggjør alle økter. Øktenes maksimale levetid er 8 timer,
  med 30 minutters inaktivitet. Ingen invitasjoner eller kontokobling er innført.
- Det gamle frontend-arbeidsrommet gjenbruker inline-handlere og trenger en
  tilsvarende CSP. Nye person-/kildetekster settes med `textContent`, ikke HTML.
  Samme-origin offentlige skript er dermed også del av tillitsflaten; skjult URL,
  `noindex` eller CSP alene erstatter ikke autentisering eller sikker kodereview.
- Lagret status er `draft` eller `review-approved`. **`published` kan ikke settes
  av denne tjenesten.** Godkjenning er ikke publisering, formell merketildeling
  eller diplomgodkjenning. Ingen GitHub-skrivekanal eller publiseringsendepunkt.
- Første serverflyt tillater bare rettelser av **eksisterende resultater**.
  Import, personmatching, sammenslåing og øvrig C2-funksjonalitet beholdes, men
  deres varige integrasjon kommer senere. Ustøttede sakstyper får en konkret feil;
  de overskrives eller publiseres ikke. Heder og AI er uendret.
- Audit-loggen har intern aktør, tid, revisjon og innholdsdigest. Den siste
  rettelsespakken har opprinnelige førverdier og eksisterende reverseringsgrunnlag.
  Full historikk over hver tidligere lagret pakke krever separat retensjon/backup;
  dette innføres ikke som et nytt system her.

## Kontroll og reproduksjon

```sh
node --test tests/admin-web-auth.cjs tests/admin-result-review.cjs tests/admin-web-browser.cjs
node --test tests/c24-review-workspace.cjs tests/postgres-review-store.cjs
node --test tests/public/visual/corrections.cjs tests/public/visual/web-admin.cjs
npm test
npm run build -- /tmp/morothon-admin82-build
node scripts/check-public-site.cjs /tmp/morothon-admin82-build
```

Testene dekker state/PKCE/replay, fremmed konto, sessions/CSRF, roller og
arrangørisolasjon, varig kryptert lagring, samtidig/foreldet skriving,
manipulerte førverdier, DNS/DNF, ny redigering etter kontroll, separat godkjenning
og byteidentiske offentlige resultater. En forsinket lagringsrespons testes også:
tekst som endres mens serveren arbeider, kan ikke fremstå som lagret/godkjent.
Godkjenningsknappen er bundet til den viste lokale kopien og nøyaktig lagret
revisjon/digest, ikke bare til at en lagringsforespørsel har lyktes.
Første browserflyt bruker bare syntetiske
personer. En annen test gjenspiller en **allerede dokumentert og korrigert**
Morothon-øvelsesrettelse fra 2012 i en isolert kopi, gjennom de faktiske motorene;
ingen ny feil eller oppdiktet historisk prestasjon introduseres.

HTTPS-nettlesertesten kjører PC 1440, nettbrett 768 og mobil 390 px, sjekker at
ingen helsides horisontal rulling oppstår, og registrerer JavaScript-feil.
Med `MOROTHON_C1_REVIEW_DIR=/tmp/kontroll` regenereres kontrollbilder.
Ingen rå kontrollbilder, sertifikatnøkler eller private utkast følger offentlig bygg.

De nye server-/auth-testene krever komplett betrodd checkout. Eksisterende
PR-sparse-testpakke inkluderer ikke de nye servermodulene; den er **ikke** bevis
på at disse testene er kjørt. Betrodd fullkontroll skal dokumenteres på eksakt
PR-head, i tillegg til eksisterende uavhengig artefaktkontroll. Ingen workflow,
offentlig data-policy eller sikkerhetssperre endres for å få grønne sjekker.

Eksakte SHA-er, testantall og CI-status oppgis i PR-/leveranserapporten.
Reell OAuth-innlogging og proxy/lagring på ønsket nettadresse må verifiseres
etter at driftskonfigurasjonen er godkjent og etablert; de er ikke testet live.

Fullkontrollen avdekket også en eksisterende timingfeil i Designstudio-testen:
to påfølgende valg kunne starte overlappende diplomkontroller under høy last.
Testen venter nå på eksisterende `pending=false`/A4-resultat etter hvert valg.
Alle kontroller av datoer, bilder, kontrollsummer, layout og sperret utskrift
beholdes; produksjonskoden og dens opptatt-sperre er uendret. Dette endrer ikke
eller omgår reell feilhåndtering for samtidige forhåndsvisninger.
