# P1A – kontrollert publisering av årsresultater

Viderefører #123, #155 og #156 fra main
`de201a6e814dc2955dea14320e8685011748b4f1`. Bruker eksisterende parser,
[årsimportkontrakt](arsimport-kontrakt.md), [web-import](arsimport-web-admin.md),
privat AES-GCM/CAS-lager og publiseringsmotor. Ingen ny database, adminside,
GitHub-workflow eller avhengighet er innført.

## Brukerflyt etter særskilt godkjent aktivering

Under **Årets arrangement → Endelige resultater**:

1. Importer filen, avklar identiteter, serverkontroller og lagre privat.
2. For en ny årgang: bekreft at filen omfatter alle individuelle øvelser.
   Denne bekreftelsen er nå synlig også når ingen gamle resultater er endret.
3. **Beregn før og etter** beregner kandidaten på serveren fra originalbytes,
   personvalg og gjeldende godkjent kilde. Visningen inneholder eksakte
   kilderader og alle endrede profiler, årsstatistikker, plasseringer, rangeringer,
   løyperekorder, lojalitetsberegninger og merke-/diplomgrunnlag.
   En ny årgang kan også endre foreløpige Heder-estimater og godkjenningsgrunnlaget
   for enkelte diplomvarianter. Disse forskjellene beregnes og vises særskilt;
   endret innhold får ikke beholde godkjenning for ren utskrift. Ingen registrerte
   utmerkelser eller Heder-kilder oppdateres automatisk.
4. **Godkjenn kontrollen** godkjenner den eksakte serverberegnede kandidaten.
   Privat lagring eller en nettleserbeslutning er ingen publiseringsgodkjenning.
5. **Publiser godkjent år** er en separat, uttrykkelig eierhandling. Eksisterende
   motor gjenoppretter og kontrollerer backupbytes, validerer/bygger datapakken,
   oppretter data-PR og krever eksisterende branch protection og obligatorisk CI.
6. Først etter godkjent main-bygg, Pages-utrulling, kontrollsummer og faktisk
   profilkontroll blir status **Publisert og verifisert**.
7. **Tilbakefør publisering** lager et nytt privat tilbakeføringsgrunnlag. Dette
   må kontrolleres, godkjennes og publiseres gjennom den samme kjeden.

Statusene skiller mellom privat lagret, serverkontrollert, godkjent, pågående,
stoppet og verifisert publisert. Ukjent svar eller HTTP 202 er ingen bekreftelse
på lagring/publisering. **Hent status** og **Fortsett publiseringskontroll**
gjenopptar eksisterende jobb. Ingen tidsgrenser eller sikkerhetskontroller er
fjernet. Utkast, originalfil og revisjonsspor slettes ikke ved feil. Etter
verifisert publisering arkiveres fil, plan og godkjenning privat, før aktivt
arbeidsgrunnlag tømmes for neste import.

## Avgrenset adapter og kompatibilitet

`annual-result-candidate.cjs` produserer en tilleggskandidat for eksisterende
`result-publication.cjs` sitt adapterpunkt. `serverless/annual-publication.cjs`
gjenbruker outbox, CAS-reservasjon, backup, PR, CI, etterkontroll og reversering.
Identitets- og ordinær resultatpublisering beholder sine adaptere. Globale
jobbreservasjoner og kontroll av andre modulers publiseringslåser forhindrer
samtidige, kolliderende skrivejobber.

Resultatrekkefølge, eksisterende personobjekter, aliaser, redirects og original-
resultater beholdes. Nye personer får stabile ID-er fra den eksisterende
importkontrakten. Nye resultatlinjer legges bakerst; korrigeringer krever eksakte
førverdier og radvalg. Ingen automatisk sammenslåing eller sletting av manglende
rader. DNS oppretter ikke person/deltakelse. DNF teller som start og deltakelse,
med tom sluttid og plassering. Usikre identiteter, mulige dobbeltstarter og
uavklarte kildekonflikter sperrer publisering. Nye personers kjønn må være
avklart før kjønnsbaserte beregninger kan publiseres.

Ny årgang krever gjennomgått, komplett **individuelt** resultatgrunnlag uten
avviste rader. Stafettimport, sletting av årganger og hel erstatning av et
eksisterende årsarkiv er ikke aktivert. Blandet stafettgrunnlag må avklares;
adapteren overser ikke uavklarte rader stille.

For nye år lager adapteren den eksisterende ti-felts `yearStats`-raden:
år, antall kilderader, unike startere, starter, fullføringer, DNF, DNS, voksne
herrer, voksne damer og juniorstarter. Ved tillegg/retting i et eksisterende år
oppdateres bare unike deltakere (felt 2). Øvrige gamle felt er arkiverte
kildetall, blant annet historisk DNS som ikke finnes som resultatlinjer; disse
rekonstrueres ikke fra dagens personopplysninger. Rangeringer og profilstatistikk
beregnes av de eksisterende offentlige motorene fra resultatlinjene.

Offentlig proveniens utvides kompatibelt til journal v3 med eksakte offentlige
før-/etterverdier for personer, resultater, årsrad og periode. v1-resultat- og
v2-identitetsjournaler beholdes. Hele kjeden kan rulles tilbake til nøyaktige
originalbytes. Tilbakeføring avviser nyere endringer på berørte rader/identiteter
og nyere tillegg som hindrer sikker fjerning av sist tilføyde kilderader. Den
skriver ikke over nyere arbeid. Journalen inneholder ingen private kildefiler,
interne begrunnelser, tokens eller private godkjenningsbevis.

Den offentlige publiseringen bruker fortsatt bare de fem godkjente filstiene.
Manifestversjon øker også ved tilbakeføring. Offentlig datakontrakt, original-
registre, medaljer, Heder-data og diplomer er ikke endret i denne leveransen.

## Beskyttet serverkjede

Eksisterende `GET /annual-import` returnerer kildebundet publiseringskontroll
bare når funksjonen er aktivert. Nye owner-beskyttede køhandlinger bruker
`POST /annual-import/publication/{check,approve,publish,continue,reverse,cancel}`.
De krever eksakt privat revisjon/kontrollsum og unikt forespørsels-ID; approve
krever også kandidatens kontrollsum, publish/reverse uttrykkelig bekreftelse.
Alle ruter, Origin-kontroller, nonce, OIDC, eier-ID, pinnede kodeversjoner og
rollebegrensninger går gjennom eksisterende broker/prosessor. Gjentatt eksakt
forespørsel gjenbruker jobben; motstridende gjenbruk avvises.

Rapporter og historikk ligger i eksisterende kryptert `annual-requests`-lager.
Store rapporter legges ikke i den mindre kontrolljournalen. Eksisterende
lagringsgrenser beholdes; for stor rapport avvises uten avkorting. Godkjenning
beregner rapporten på nytt og stoler ikke på importert JSON eller klientens tall.
Utdaterte rapporter vises ikke som gjeldende godkjenningsgrunnlag.

Bare aktiverte `annual-publication-publish`/`continue` kan få eksisterende,
avgrenset offentlig GitHub-skrivetoken. Import, kontroll og godkjenning får ikke
slik skrivetilgang. Fortsettelse kan lese et allerede feilet deploy-snapshot for
å etterkontrollere/reparere jobben; nye publiseringer krever fortsatt grønn main,
beskyttede grener, riktige kildeversjoner og obligatoriske kontroller.

## Ikke aktivert – separat godkjenning kreves

`scripts/admin/serverless/annual-publication-policy.cjs` har **ENABLED=false**.
Det finnes ingen miljøvariabel, nettleserbryter eller HTTP-parameter som åpner
funksjonen. I standardoppsettet er publiseringsrutene 404, private skriveleases
avvises, og publiseringspanelet er skjult. Testene aktiverer kun isolerte,
syntetiske instanser. Ingen ekte rettelse, Worker, secret, workflowpin eller
produksjonsressurs er endret.

Etter kodegjennomgang og grønn CI må eier separat godkjenne aktivering og
[manuell utrulling](manuell-worker-utrulling.md):

1. Gjennomgå aktiveringsendringen, velg gjennomgått main/prosessor-SHA og
   oppdater den private workflowens kodepin.
2. Kontroller faktisk ny workflow-SHA, OIDC-binding og Workerens samsvarende
   `PROCESSOR_CODE_SHA`/`PRIVATE_WORKFLOW_SHA`. Avklar aktive jobber før pinbytte.
3. Bygg beskyttede adminressurser og rull ut gjennomgått Worker. Eksisterende
   secrets og rettigheter beholdes; ingen nye secrets kreves.
4. Verifiser innlogging, privat gjennomgang og driftskontroller. Publisering av
   ekte årsresultater krever egen uttrykkelig godkjenning av faktisk kandidat.

Rollback: gjeninnfør tidligere gjennomgått kode og assets samlet. En tilbakeført
privat workflow på main får ny SHA; oppdater bindingen til denne faktiske
versjonen. Behold krypterte arbeidsdata og publiseringsbackup. En allerede
publisert resultatendring reverseres med kontrollert datarelease, ikke ved å
rulle kode tilbake eller overskrive originalfiler manuelt.

Pages #510 og Worker #45 er separate driftsavvik. De svekker ingen isolerte
tester her, men ekte publisering er blokkert inntil eksisterende drifts-/CI-
krav faktisk består. Denne PR-en forsøker ikke å omgå disse kravene.

## Regresjon og etterprøvbar kontroll

Målrettede syntetiske tester:

- `tests/annual-publication.cjs`: kandidat, godkjenning, reimport, feil/CI,
  backup, nøyaktig tilbakeføring og bevaring av privat kilde.
- `tests/serverless-annual-publication.cjs`: ekte auth, broker, kryptert privat
  lager, lease og driver mot simulerte eksterne tjenester; ny innlogging,
  ulovlig tilgang, feil kandidat, foreldet grunnlag og samtidige låser.
- `tests/public/quick/annual-publications.cjs`: kompatibel proveniens v1/v2/v3,
  manipulerte kontrollsummer, uautoriserte felt og nyere motstridende endringer.
- `tests/github-result-publisher.cjs`: isolert faktisk Git-repository, kun fem
  datafiler, idempotent PR-gren, rød/grønn CI og beskyttet merge.
- `tests/serverless-annual-publication-browser.cjs`: faktisk web-admin,
  eksisterende Chromium-beregninger, godkjenning, ny innlogging, offentlig bygg,
  kontrollsummer, virkelige profiler og tilbakeføring av syntetisk 2027-årgang.

`MOROTHON_P1A_REVIEW_DIR=/tmp/morothon-p1a-review node --test tests/serverless-annual-publication-browser.cjs`
regenererer PC-/nettbrett-/mobilbilder ved 1440, 768 og 390 px. Kjør også de
eksisterende årsimport-, autentiserings-, Personkontroll- og publiseringstestene.
Det trengs ingen egne Heder-tester eller diplomgallerier for endringen.

`tests/annual-publication-ci.cjs` kjører dessuten offentlig hurtigkontroll og
relevante nettleserkontroller mot en faktisk, isolert offentlig pakke med neste
syntetiske resultatår og en ny syntetisk løper. Den bruker ingen administrative
originalregistre og endrer ingen originale filer. Den avdekket faste
2026-forutsetninger i eksisterende tester: historiske fasiter testes nå på
nøyaktig journalrekonstruert historikk, mens gjeldende nettside/API kontrolleres
mot gjeldende godkjente data. Enny-fingeravtrykk, 2026-milepæler, den tidligere
33-statistikken og de 86 historiske diplomfasitene beholdes. Endret Heder-innhold
kontrolleres i tillegg mot live data og må være sperret for ren utskrift.
Dette tester konsekvensene av årsbyttet; det genererer ikke et nytt diplomgalleri.

Rapporter lokal betrodd kontroll og GitHub CI separat mot eksakt head-SHA.
Dagens begrensede PR-kildejobb oppdager ikke vilkårlig nye administrative tester;
den erstatter ikke kjøring av de nye testene i komplett betrodd checkout.
Offentlig CI og uavhengig artifact-gate er uendret. Før aktivering skal offentlig
byggepakke fortsatt være byteidentisk med main: 59 filer, 43 synlige
Heder-profiler og uendret godkjent manifest.
