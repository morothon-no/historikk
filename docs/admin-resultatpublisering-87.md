# #87 – kontrollert publisering fra nettbasert admin

## Leveransen

Bygger videre på #82 / PR #86, samme portal, OAuth-innlogging, interne bruker-ID-er,
varige krypterte utkast og eksisterende C2-resultatmotor. Ingen ny frontend-app,
database, hostingavtale eller npm-avhengighet. Heder, AI og arrangørpiloter er ikke
endret. **Ingen virkelig resultatkorrigering eller driftskonfigurasjon er publisert
av dette arbeidet.**

Arbeidsflyt i nettleseren:

1. Finn deltakeren og rett et eksisterende resultat.
2. Vis før/etter og konsekvenser. Lagre og godkjenn nøyaktig siste revisjon.
3. «Klargjør publisering» gjentar serverkontrollene, kontrollerer grønn main og
   kildeversjon, lager en kryptert sikkerhetskopi og prøver faktisk gjenoppretting.
   Den validerer og bygger hele den foreslåtte offentlige pakken. Ingen Git-skriving.
4. Hovedadministrator velger «Publiser godkjent rettelse» og bekrefter separat.
5. Serveren oppretter en dataavgrenset PR. Alle påkrevde kontroller må bestå.
   Serveren bruker GitHubs beskyttede PR-merge, uten omgåelse av review eller tester.
6. Full main-kjøring og Pages-deploy må bestå. Deretter hentes og SHA-kontrolleres
   alle forventede offentlige filer, og berørte løperprofiler rendres med den
   eksisterende nettlesermotoren. Først da vises «Publisert og verifisert».
7. «Foreslå tilbakeføring» lager et nytt utkast med eksakte motsatte verdier.
   Dette krever ny gjennomgang, godkjenning og publisering med ny dataversjon.

En uendret rettelse/no-op, feil kildeversjon, manglende rettighet, endret godkjenning,
feil CI eller uverifisert offentlig versjon gir aldri status publisert. Nettleseren
kan ikke velge arrangør, aktør, Git-filer, godkjent status eller kildehash selv.

## Riktig kilde og publiseringsgrense

En resultatpublisering kan kun endre disse fem filene, i én commit:

| Fil | Formål |
| --- | --- |
| `data/history.json` | Kanonisk historisk resultatkilde |
| `public-data/data/history.json` | Identiske godkjente offentlige resultatbytes |
| `public-data/manifest.json` | Økt dataversjon og nye SHA-256-verdier |
| `.github/public-data-approval.json` | Eksakt tilhørende A1C-godkjenning |
| `tests/public/quick/fixtures/result-publications.json` | Eksakte offentlige før-/etterrader for historisk regresjonskontroll |

Identiteter, aliaser, administrative originalregistre og øvrige rotfelt endres
ikke av denne første publiseringsadapteren. Kun eksisterende resultatlinjer støttes;
ingen import, sletting, sammenslåing eller nye personprofiler publiseres her.
Dynamiske profiler, plasseringer, rekorder, deltakelse, årstall, lojalitet, merker og
diplomgrunnlag bruker samme oppdaterte resultatfil og eksisterende beregningsmotor.
Historiske kildeoppsummeringer i filen omskrives ikke til nye anslag.

Resultatjournalen er ikke et nytt person- eller godkjenningsregister. Den inneholder
bare eksakte allerede offentlige resultatverdier, indekser, versjoner og hashkjede.
Historiske regresjoner rekonstruerer sitt opprinnelige kontrollgrunnlag ved å
reversere bare disse eksakte radene i minnet; nye kontroller låser samtidig den
virkelige filen til manifestet og godkjenningen. Uvedkommende byteendringer,
identitetsendringer og manipulert journal avvises. Ingen kilde, privat notat,
innloggingsidentitet eller administrativ aktør kopieres til data-PR-en.
En korreksjon som bryter andre historiske kontrolltall stopper fortsatt CI og må
vurderes; tjenesten skriver ikke om tester for å få en rettelse gjennom.

## Sikkerhet, backup og tilbakeføring

- `owner` kan publisere; `editor` og `viewer` kan ikke. Eksisterende CSRF-, origin-,
  økt-, innholds-, rate- og kildekontroller beholdes. Godkjenning alene starter
  ingenting. Aktør og eksakt godkjent digest bindes på serveren.
- Publisering er avslått som standard. Backend-kode/nøkler inngår ikke i Pages.
- En separat GitHub App brukes til data-PR-er. OAuth `read:user` brukes bare til
  innlogging og kastes etter identitetsoppslag. Brukerens innloggingstoken gir
  aldri repository-skriverettigheter.
- Appens installasjonstoken er kortlivet og begrenses til `morothon-no/historikk`.
  Koden tillater ingen andre repositorier, direkte main-skriving, force-push,
  endring av workflow, branch protection eller artefaktkontroller.
- Den kjørende adminversjonens kode-SHA er pinnet. Dersom main får nyere kode
  eller sikkerhetsregler, stopper neste publisering til admin er kontrollert
  oppdatert. Dataendringer alene kan publiseres videre.
- Main må håndheve oppdatert PR, review-regler og obligatoriske tester også for
  administratorer. Publiseringsappen må ikke ha review-unntak. Påkrevde jobber er
  `Public-safe source regression`, `Trusted policy and test plan`,
  `Public package, policy and site build` og `Independent trusted artifact gate`.
  Eksisterende main-source-regresjon og deploy forblir uendret.
- Eksisterende eksterne A1C-variabler settes til **nøyaktig** servergodkjent
  manifest/head. En ubetrodd PR kan ikke sette dem selv. Ved samtidige endringer
  i variablene stoppes jobben. Variablene er repository-globale, så kjør kun én
  resultatpublisering om gangen og samordne med andre policy-/data-PR-er.
- Merge-SHA kan ikke kjennes før GitHub merger. Dersom main-kontrollen starter
  før ekstern godkjenning av denne SHA-en er satt, kan én full omkjøring utføres,
  kun når eneste feilende jobb er policy-planen. Ingen tester hoppes over. Andre
  feil gir stopp. Appen har Actions-write utelukkende for dette begrensede behovet.
- Den private utboksen lagrer backup av alle fem filer, SHA-verdier, godkjent
  rettelsespakke, intern aktør, revisjonslogg og fjernstatus AES-256-GCM-kryptert
  under privat volum, med atomisk revisjonskontroll. Sikkerhetskopien restore-testes
  før publisering tillates. Backup omfatter denne resultatleveransen, **ikke**
  full uavhengig backup av private registre. Det parkerte migreringsarbeidet berøres
  ikke. Volum og separat nøkkelkopi må fortsatt sikres av driftsansvarlig.
- Delvis/ukjent nettverksutfall beholdes for eksplisitt kontroll; ingen blind
  gjentakelse som kan overskrive nyere data. Ved omstart gjenopptas lagret intensjon.
- En normal, verifisert publisering kan reverseres via nytt godkjent utkast.
  Nyere resultatdata overskrives aldri med en gammel kopi. Dersom main er merget
  men main-CI/deploy feiler, beholdes publiseringslåsen og backupen. «Kontroller
  stoppet publisering på nytt» kan gjenoppta etter rettet CI. Automatisk revert
  fra denne delvis publiserte tilstanden er **ikke** implementert; driftsansvarlig
  må kontrollere og eventuelt gjøre beskyttet Git-tilbakeføring med ny kontroll.
  Enheten rapporteres aldri som ferdig publisert i mellomtiden.

## Engangsoppsett før faktisk bruk

Ingen slike innstillinger er opprettet eller endret i denne PR-en.
GitHub Pages kan fortsatt ikke kjøre en Node-tjeneste. Bruk samme minste,
leverandøruavhengige HTTPS-vert som beskrevet i
[innloggingsleveransen](admin-resultatutkast-82.md#konkret-driftsblokkering-og-minste-oppsett):
én uprivilegert Node-prosess, varig privat disk, Chromium med fungerende sandbox,
vedlikeholdt reverseproxy. Ingen ny skytjeneste er valgt eller kjøpt. Innlogget
admin, API og OAuth må være på samme origin. For dagens `/admin/`-adresse må
proxyen rute `/admin/`, `/admin-api/` og `/auth/` til tjenesten, mens offentlig side
fortsatt leveres fra kontrollert Pages-bygg. Alternativt velges egen admin-origin
uten CORS-snarvei. Dette krever godkjent vert/proxy og DNS-oppsett.

Driftsansvarlig setter først alle eksisterende private #82-innstillinger, inkludert
stabil intern bruker-ID, numerisk GitHub-identitet og OAuth-app med callback
`<ADMIN_ORIGIN>/auth/github/callback`. Deretter:

1. Opprett en egen organisasjonseid GitHub App, installer **kun i `historikk`**.
   Ingen webhook, brukerrettigheter, Pages-/deployrettigheter eller tilgang til
   `historikk-admin`. Repository-rettigheter: Contents **write**, Pull requests
   **write**, Variables **write**, Actions **write**, Checks **read**, Administration
   **read** (GitHub gir også obligatorisk Metadata read). Behold alle review-regler;
   hvis reviewer kreves, må vedkommende godkjenne data-PR-en. Appen godkjenner ikke
   sin egen PR og fjerner ikke reviewkrav.
2. Lagre appens private PEM-nøkkel utenfor Git og offentlig bygg, filmodus `0600`.
   Ikke legg den, OAuth-secret eller lagringsnøkkel i frontend/PR/logger.
3. Sett følgende serverkonfigurasjon i det private driftsmiljøet:

| Variabel | Verdi |
| --- | --- |
| `MOROTHON_PUBLISH_ENABLED` | `true`, først etter godkjent aktivering |
| `MOROTHON_PUBLISH_APP_ID` | Appens numeriske ID |
| `MOROTHON_PUBLISH_INSTALLATION_ID` | Installasjonen i `historikk` |
| `MOROTHON_PUBLISH_APP_KEY_FILE` | Absolutt privat PEM-sti |
| `MOROTHON_PUBLISH_CODE_SHA` | Full SHA for kjørende kontrollert kode fra grønn main |

4. Bekreft at branch protection faktisk krever de fire kontrollene over, strict
   oppdatert head og enforce admins. Serveren kontrollerer dette og stopper hvis
   det mangler. Innstillingene er **ikke** påstått aktivert av denne PR-en.
5. Start eksisterende `node scripts/admin-web.cjs`. Bekreft innlogging og negativ
   tilgangstest med publisering fortsatt avslått; godkjenn deretter aktivering.
6. Velg en konkret faktisk rettelse og få eksplisitt arrangørgodkjenning før første
   virkelige publiseringshandling. Den allerede korrekte testregistreringen skal
   ikke publiseres på nytt som om det var en ny feil.

Arrangøren trenger deretter bare nettleseren, ingen JSON-redigering, Git-kommandoer
eller lokal installasjon. Uten verts-, OAuth- og App-oppsettet fungerer eksisterende
Pages-portal som før; den later ikke som den kan lagre eller publisere.

## Tester og praktiske grenser

```sh
node --test tests/github-result-publisher.cjs tests/result-publication.cjs \
  tests/public/quick/result-publications.cjs tests/source-history-preservation.cjs
CHROMIUM_PATH=/usr/bin/chromium node --test tests/result-publication-browser.cjs \
  tests/admin-web-auth.cjs tests/admin-result-review.cjs tests/admin-web-browser.cjs
npm test
npm run build
npm run public:kontroll
```

Nye tester dekker eiergodkjenning, manglende innlogging/rolle, kildekonflikt,
konkurrerende redigering, kryptert restore-test, idempotent data-PR, nøyaktig fem
filer, kortlivet App-token, påkrevd uavhengig gate, nektet merge/review, feil CI,
begrenset policy-omkjøring, gammel offentlig nettside, omvendt rettelse med ny
versjon og tilbakekalt publiseringstilgang.

Nettlesertesten gjenspiller den allerede arrangørbekreftede 2012-øvelse-/
distanserettelsen fra eksisterende november-fixture, kun i midlertidige data.
Den bruker ekte admin, C2Project, kryptert filstore, et ekte isolert Git-repository
uten remote, offentlig bygg, HTTP-henting av alle runtimefiler og faktisk rendret
løperprofil. OAuth og GitHub/Actions-transport/utfall er eksplisitt simulerte.
**Dette dokumenterer ikke reell hosting, ekstern OAuth, App-tilgang eller grønn
produksjonspublisering.** Slike kontroller gjenstår etter godkjent engangsoppsett.

Nettleseren kontrolleres ved 1440, 768 og 390 px, uten horisontal side-overflyt.
Sett `MOROTHON_C1_REVIEW_DIR=/absolutt/privat/kontrollmappe` for faktiske kontrollbilder
fra testen. Ingen personregistre, nøkler eller store kontrollbilder committes.
Nye backend-integrasjonstester inngår i komplett betrodd `npm test`; PR-sparse-jobben
har fortsatt sitt eksisterende, avgrensede offentlige testutvalg. GitHub Actions og
A1C-sikkerhetsfiler er ikke endret. Komplett testresultat og eksakt commit oppgis i
PR-rapporten. Produksjonsstart krever fungerende Chromium-sandbox; Codex-testene
bruker en injisert testnettleser uten sandbox fordi dette miljøet mangler SUID/userns.
Ingen usikret produksjonsfallback er innført.
