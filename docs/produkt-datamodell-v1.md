# Produktgrunnmur: felles datamodell uten GitHub-binding (steg 2)

Dette er en **lesende migrerings- og normaliseringsmodell**, ikke en endring av
`history.json`, ikke et nytt administrasjonssystem og ikke en godkjent
publiserings-/skrivevei. Morothon blir værende på GitHub Pages.

## Leveranse

`scripts/organizers/domain-model.cjs` introduserer kontrakten
`adelskalender-domain-snapshot-v1`, med egne:

- `organizerId` og låst `profileSha256`;
- `seriesId` – arrangementsserie;
- `editionId` – faktisk arrangement/utgave, slik at flere utgaver i samme
  kalenderår ikke blir slått sammen;
- `competitionId` – konkret konkurranse, knyttet til utgave, kildenavn,
  distanse og eventuell bekreftet løypeperiode;
- `personId` – arrangøravgrenset personprofil;
- `resultId` – **obligatorisk stabil ID for nye kunder**;
- `sourceRef` – importbatch og kilderad, atskilt fra deltakeridentiteten.

`emptyOrganizer(profile)` lager et tomt, versjonsbundet grunnlag for nye
arrangører. De må senere opprettes i en autentisert tjeneste, men har ikke behov
for egne kopier av Morothon-koden.

### Morothon som bakoverkompatibilitetstest

`projectMorothon({history,profile})` er en eksplisitt *read-only*
overgangsadapter. Den konstruerer utgaver/konkurranser fra kildeåret og
kombinasjonen av kildeøvelse og **opprinnelig distanse**, uten å endre noen
historiske rader.

- **Ingen fiktive datoer:** historisk dato lagres som `null` med presisjon
  `year`; dette er **ikke** en påstand om faktisk konkurransedato.
- **Ingen fiktive personprofiler:** de 79 ukoblede DNS-kildepostene følger med
  som `personLinked:false`, ikke som nyregistrerte løpere.
- **Ingen fiktive resultat-ID-er:** eldre rader får `resultId:null` og
  kildeordinal bare i denne *ikke-skrivbare* adapteren. En kildeordinal må aldri
  brukes som permanent ID ved en ekte migrering eller omimport.
- **DNF/DNS:** rå kildeplassering beholdes for revisjon, mens
  `displaySourcePlace` følger eksisterende statusregler og er `null` når
  plassering ikke skal vises.
- **Alle historiske verdier:** eksisterende personmetadata, uvanlige statuser,
  resultatfelter, alias, redirect, `yearStats` og fire stafettresultater
  beholdes. Ingen uautoriserte kildenormaliseringer.
- **Ingen antatt løypeekvivalens:** en kjent regelperiode blir en referanse,
  ikke bevis på at to ulike distanser er identiske.

`reconstructLegacy(snapshot)` er kun en intern, kontrollert
sammenligningsfunksjon: den nekter å rekonstruere hvis felt, antall,
rekkefølge eller kontrollsum avviker fra den opprinnelige historikken.

## Hva som fremdeles gjenstår

1. Stabile kildeuavhengige resultat-ID-er for en **ekte** migrering, med
   egen koblingstabell og separat godkjenning for ukoblede oppføringer.
2. En felles **skrivemodell og transaksjonell lagringsadapter** (PostgreSQL for
   administrert drift, eventuelt godkjente alternative adaptere ved selvdrift).
   Bare privat autorisert backend kan skrive; ingen klient- eller public
   Pages-kode får databasehemmeligheter.
3. Automatisk lagring av rettingsbeslutninger fra admin via signerte sesjoner,
   antiforfalskning/CSRF, revisjonskontroll og revisjonsspor.
4. Kontrollert publisering via et utskiftbart mål: GitHub Pages, vanlig
   objektlagring/statisk webhosting eller kundens egen server.
5. Datakontroll, versjonert backup/rollback og en **faktisk gjenopprettingstest**
   før løsningene kan drives for andre arrangører.

## Test og ytelse

`tests/organizer-domain.cjs` bruker offentlig Morothon-historikk som
**read-only referanse** og fiktive personer for andre arrangører. Den krever
nøyaktig round-trip av alle 6 914 resultatpostene, fire stafettresultater og
uavklarte DNS-oppføringer. To utgaver i samme år og to stabile resultat-ID-er
brukes som kontrast til Morothons historiske årsmodell.

Projeksjonstiden rapporteres i testen til videre ytelsesmåling, men testen
setter ingen vilkårlig tidsgrense på delt GitHub-runner. Separat skal vi måle
navigering, hovednavnvalg og samlet adminbehandling i nettleser før lansering.
