# Årsimport – serverkontrakt og privat utkast

Første avgrensede del av hovedleveransen for nye resultatår. Dette er kjørbar
serverkode, ikke en ny importmotor eller en offentlig importtjeneste. Ingen
nettside, produksjonsfil, Worker-binding eller eksisterende rettingskontrakt endres.

## Det som virker

- `scripts/admin/annual-result-import.cjs` gjenbruker `MorothonIntake.Results` for
  CSV/TSV, tegnsett, felt-/øvelsestolkning, aliaser og resultatavstemming.
- Den beregner en deterministisk, versjons- og kildebundet plan for nye år, nye
  registreringer og rettelser i eksisterende år. Både originalbytes og de
  uttrykkelige person-/resultatvalgene inngår i kontrollgrunnlaget.
- Eksisterende løper må bekreftes før et nytt resultat knyttes til personen.
  Ny person krever et uttrykkelig valg og en stabil lokal personreferanse. Ved
  navnetreff må arrangøren i tillegg bekrefte at dette er en annen person.
  Kollisjoner i ID-er og uforenlig gjenbruk av samme referanse avvises.
- Uavklarte personvalg, kildekonflikter og stafetter blir kontrolloppgaver i
  planen. De oppretter ikke personer eller deltakelser automatisk. Overføring
  til den eksisterende Personkontroll-tjenesten gjenstår.
- DNF teller som deltakelse, med tom sluttid og plassering i nye/endrede rader.
  DNS uten dokumentert start oppretter verken profil eller deltakelse. DNS som
  motsier en dokumentert start sperrer klargjøringen.
- Historiske øvelser/distanser, manglende kilderader og gamle aliaser beholdes.
  Ved rettelse bevares eventuell opprinnelig redirect-ID på resultatlinjen.
- `scripts/admin/annual-import-review.cjs` gir autentisert `preview`, `save` og
  `load`, med eksisterende roller, kryptert lagring, revisjonskontroll/CAS og
  interne bruker-ID-er i revisjonssporet. Identisk privat reimport endrer ikke
  revisjonen. Bytte av fil krever eksakt gammel revisjon/kontrollsum og et
  uttrykkelig valg; forrige kilde og plan beholdes privat.

En kilde som erklæres komplett, får fortsatt bare **tillegg/rettelser**. Manglende
rader er aldri en sletteordre. Full erstatning av et års offentlige data er ikke
støttet av denne første kontrakten.

## Bruk fra betrodd prosessor

Kontrakten heter `morothon-annual-result-import-v1`. Bygg forespørselen med
`request({organizer, base, year, bytes, options, decisions})`. `base` kommer fra
serverens godkjente historikk, ikke fra klientens godkjenning. `options` er bare
de eksisterende parservalgene: feltkobling, skilletegn og bekreftede øvelsesvalg.
Ikke logg forespørselen: den inneholder den private kildefilen som base64.

`prepare(context, request)` returnerer plan, kontrolloppgaver, differanser og
beregnede deltakelsesår for berørte personer. Beslutninger bindes til planens
`interpretationSha256` og den aktuelle radreferansen. `existing` krever en
eksisterende person-ID og, ved rettelse, eksakt resultatindeks. `new-person`
krever `personKey`. `defer` og `reject` bevarer historikken.

`verify(context, request, plan)` beregner alt på nytt. En klientberegnet
kontrollsum eller feltet `ready` er aldri godkjenningsbevis. `ready` betyr bare at
denne planens kontrolloppgaver er avklart; `hasChanges` angir om noe faktisk endres.

Utkasttjenesten får de eksisterende serverfunksjonene `authenticate` og
`loadContext`, samt et modulavgrenset lager. Filadapteren bruker eksisterende
AES-256-GCM-/CAS-implementasjon under navnerommet `annual-result-import-v1`.
`annualImportStore({openNamespace})` gjør samme tjeneste uavhengig av fysisk
lagringsleverandør. Denne PR-en oppretter ikke et nytt eksternt lager og kobler
ikke på GitHub/Worker-transport. Eksisterende identitets- og resultatlagre røres ikke.

`save` krever `expectedRevision`, `expectedDigest` og `replaceCurrent` i tillegg
til `session`, `organizer` og `input`. Etter ny autentisert sesjon kan `load`
hente nøyaktig samme kilde, valg og plan. Foreldet historikk vises som `stale` og
kan ikke overskrives. Lagringsgrensen på 8 MiB og 1000 revisjonshendelser fra
eksisterende adapter gjelder fortsatt; full kildehistorikk avkortes ikke stille.

## Publisering er fortsatt sperret

Planen er **ikke** en eksisterende rettingspakke eller offentlig historikk.
Den inneholder ingen konstruert legacy-`yearStats` eller oppdaterte cachefelt.
En intern, midlertidig modell brukes bare til navngitte deltakelsesberegninger.
Eksisterende publiseringsmotor avviser planen som rettingspakke.

Alle planer og lagrede utkast har `productionApplied: false` og
`publicationAuthorized: false`. Tjenesten har ingen godkjennings-, publiserings-
eller produksjonsskrivingsmetode. Disse feltene kan ikke erstattes av innsendte
godkjenningsflagg. `requires` beskriver nødvendige senere porter; det er ikke
en bekreftelse på at backup eller godkjenning allerede foreligger.

Neste avgrensede del må koble til eksisterende beskyttet prosessor/web-admin og
bruke en gjennomgått adapter for årsstatistikk, profilaggregater, rangeringer,
merker og diplomgrunnlag. Den må gjenbruke særskilt eiergodkjenning, kildebinding,
backup, reversering og faktisk publisert etterkontroll. Ingen nye år kan
publiseres før hele denne kjeden er testet og aktivering godkjent.

## Regresjonskontroll

`node --test tests/annual-result-import.cjs`: **12 bestått, 0 feil**.
Bare syntetiske personer, filer og midlertidige krypterte lagre brukes.

Samlet relevant kontroll: **190 bestått, 0 feil**, inkludert de 12 nye testene,
eksisterende resultat-/identitetslagring, autentisering, importparser, publisering,
backup og reversering. De to eksisterende beskyttede nettleserreisene dekker også
ny innlogging, reimport og arbeidslister på 1440, 768 og 390 px. Dette tester
bevaring av eksisterende webflyt; ny årsimport er ennå ikke koblet til brukerflaten.

Kommandoen er:

```sh
node --test --test-concurrency=2 \
  tests/annual-result-import.cjs \
  tests/admin-result-review.cjs tests/admin-identity-review.cjs \
  tests/admin-web-auth.cjs tests/admin-gateway.cjs \
  tests/serverless-admin.cjs tests/serverless-identity.cjs \
  tests/serverless-identity-publication.cjs tests/result-publication.cjs \
  tests/github-result-publisher.cjs tests/identity-publication.cjs \
  tests/public/quick/corrections.cjs tests/public/quick/results-dns.cjs \
  tests/public/quick/results-flexible.cjs \
  tests/public/quick/results-reconciliation.cjs \
  tests/public/quick/result-layouts.cjs \
  tests/serverless-admin-browser.cjs tests/serverless-identity-browser.cjs
```

Offentlig byggkontroll består: 59 filer, 43 synlige Heder-profiler, dataversjon 2,
byggversjon `1161be8f67469fef`. Alle 59 filer er byteidentiske med kontrollpakken
fra main. Ingen egne Heder-tester/gallerier er kjørt, og ingen produksjonsdata,
offentlige manifest, sikkerhetsregler, workflows eller avhengigheter er endret.

Eksisterende isolert PR-kildekontroll er også kjørt lokalt med betrodd godkjenning:
**19 bestått, 0 feil**. Offentlig datapolicy består uten ny maintainer-SHA-godkjenning.

Den nye testen oppdages automatisk av full kildekoderegresjon. Dagens avgrensede
PR-kildejobb kjører bare sin eksisterende liste med fire tester. En grønn PR er
derfor ikke bevis på at denne nye testen kjørte i Actions før merge; den eksplisitte
betrodde kjøringen over og main sin kildekodeport må rapporteres separat.
