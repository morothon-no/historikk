# Dokumenterte resultatkorrigeringer

## Arrangørgodkjente historiske rettelser – november 2026

Grunnlag: arrangørens fire uttrykkelig godkjente korrigeringer i oppdraget
«Korriger historiske resultater og dokumenter avklarte kontrollsaker».
Utgangspunkt er `main` etter PR #42 (`6a7b90a`). Ingen nye kildeplasseringer,
identiteter eller sluttider utledes av andre opplysninger.

| Person-ID | År, øvelse og distanse | Før | Etter | Uendret |
| --- | --- | --- | --- | --- |
| Leif Wiig, `MOR-88334F0` | 1994, Morothon 18 km | `02:09.52` | `02:09:52` | Fullført, kildeplass 45, alle øvrige felt |
| Torstein Koveland, `MOR-98692D6` | 1998, Kortmoro 13 km | `01:06.14` | `01:06:14` | Fullført, kildeplass 127, alle øvrige felt |
| Gunnar Kåsa, `MOR-15AF3A3` | 2012 | Historisk tillegg, Ukjent | Kortmoro, 13 km | Deltatt, blank tid og blank plassering |
| Gunnar Kåsa, `MOR-15AF3A3` | 2013 | Historisk tillegg, Ukjent | Kortmoro, 13 km | Deltatt, blank tid og blank plassering |

Dette er **fire resultatrader og seks endrede felt**: to tidsfelt og to par
øvelse/distanse. 13 km i begge årene erstatter den tidligere opplysningen om
14 km. Andre resultater i 2012 og 2013 bekrefter Kortmoro 13 km. De to
personspesifikke validatorunntakene for ugyldige tidsstrenger er fjernet;
gjeninnføring av de gamle strengene stopper nå valideringen. Tidsparseren og
status-/deltakelsesreglene er uendret.

### Konsekvenser kontrollert mot tidligere main

- **2 643 personposter og 6 914 resultatrader før og etter.** Samme person-ID-er,
  navn, aliaser, redirects, årsstatistikkens kildeverdier og fire stafettlag.
  En reversering av bare de seks godkjente feltene gjenskaper hele forrige
  historikkfil med SHA-256
  `dcf4518e6e20f5f2919cb501cd7ef02123329ce418be228eba8b36170c57fce7`.
- Samtlige kanoniske deltakelsesårssett og deltakelsesmerker er uendret.
  Gunnar har fortsatt **35 deltakelsesår**. Registrerte, tellende starter er
  fortsatt **6 698** og forsidens ubrutte deltakelse fortsatt **33**.
- Årsarkivet beregner nå **64 Kortmoro-deltakere i 2012** (før 63) og
  **66 i 2013** (før 65). Én «Historisk tillegg»-rad forsvinner fra hver av
  disse to årsvisningene. Totaltallet er fortsatt henholdsvis **120 og 146**.
  Kildens gamle sammendragsfelt beholdes; offentlig visning beregnes fra rader.
- Ingen nye fullføringer konstrueres. Gunnar beholder status `Deltatt`, uten
  tidsplassering. Alle løperes beregnede fullføringer, fullførte kilometer og
  høydemeter er uendret; kjent distanse på en `Deltatt`-rad blir ikke fullført
  distanse.
- De to rettede tidene inngår nå i historiske tidslister. Leifs 18 km i 1994
  får **beregnet plass 35**, mens **kildeplass 45 beholdes**. Torsteins 13 km i
  1998 får **beregnet plass 2**, mens **kildeplass 127 beholdes**. Forskjellen
  mellom kildeplass og dagens kjønn-/distanseberegning rettes ikke uten grunnlag.
- **76 beregnede plasseringer** endres: 7 i Morothon 18 km i 1994 og 69 i
  Kortmoro 13 km i 1998, inkludert de to tidligere utimede radene. Alle andre
  løpsgruppers plasseringer er uendret. Dette endrer beregnet besteplass/palltall
  for 17 løpere. Torstein får to beregnede pallresultater mot tidligere ett;
  hans beste Kortmoro-tid er fortsatt 1:04:10. Leif får et eget historisk
  18 km-resultat i oversikten over beste tider; hans 21 km-tid er uendret.
- Dagens fire løyperekorder fra og med 2014 er uendret. Alle korrigerte rader
  er eldre enn løypeperioden. Det er ingen endring av design, medaljeoriginaler,
  Heder-/dugnadsregistre, formelle tildelinger eller diplomgodkjenninger.

### Avklarte kontrollsaker – ingen rådataendring

- **Bjørn Håland, `MOR-B1AC0FD`, 2007 Kortmoro 14 km:** `Fullført` i status,
  `Disket` i tid og kildeplassering beholdes. Arrangøren har uttrykkelig bestemt
  at dette fortsatt regnes som fullført. Eksisterende, avgrenset DQ-behandling
  er uendret; resultatet får ingen oppdiktet numerisk tid eller tidsplassering.
- **Sju resultater i 2014:** Rå status `Fullført` og tid `DNF` beholdes.
  Tidsmarkøren gir effektiv status DNF. Brutt løp teller som deltakelse, men
  ikke fullføring, fullført distanse eller tidsplassering. DNS teller ikke.
- **Lise Lunde:** `MOR-51D2451` og `MOR-669609C` er forskjellige personer.
  Ingen automatisk sammenslåing skal foretas.
- **Siren Pettersen:** `MOR-36949C3` og `MOR-7D386DB` er forskjellige personer.
  Ingen automatisk sammenslåing skal foretas.

Det finnes lokal saksstatus «avvist» og eksport/import av slike rettingspakker,
men ingen felles, permanent sperreliste i historikk-/personregisteret som
automatisk følger alle brukere. Det opprettes ingen ny mekanisme her. De to
navneparene kan derfor fortsatt vises som kontrollforslag. Denne dokumenterte
avklaringen skal legges til grunn ved behandling. Eventuell sentral lagring av
slike beslutninger er en separat videreutvikling, uten automatisk sammenslåing.

### Offentlig datapakke og separat godkjenning

Originalen `data/history.json` er rettet først. Eksport er deretter produsert
med eksisterende `scripts/export-public-data.cjs`, datarevisjon **2**. Bare
offentlig `history.json`, manifestet og den foreslåtte godkjenningsreferansen
endres; de fire andre offentlige JSON-filene og alle assets er byte-uendret.

- Ny historikk-SHA-256:
  `9c62621abeb3eb05a186b3618b8ba74c86b3d67b6a83539ccc2c1b1df33c4a9e`.
- Foreslått manifest-SHA-256:
  `6d93cf6d75e356ca0534eb05f4052ca3efb201e905c345f87f973dd0bee35fff`.

Den oppdaterte `.github/public-data-approval.json` er **en foreslått referanse,
ikke eierens eksterne publiseringsgodkjenning**. Etter gjennomgang må repo-eier
sette `MOROTHON_PUBLIC_DATA_SHA256` til manifesthashen over og, siden den
beskyttede referansefilen endres, `MOROTHON_REVIEWED_POLICY_HEAD` til den eksakte
endelige PR-commit-SHA-en. Verdiene finnes under GitHub **Settings → Secrets
and variables → Actions → Variables**. Deretter kjøres PR-kontrollen på nytt.
Ingen repo-variabler settes av denne endringen. Uten riktig separat godkjenning
skal A1C-porten og den uavhengige artefaktkontrollen stoppe publisering.

Lokale byggtester viser integritet, beregninger og eksport-samsvar; de utgjør
ikke en selvstendig godkjenning av ny offentlig historikk. Se også
[A1C-flyten](a1c-separat-eksport-og-bygg.md).

### Regresjonskontroller

`tests/public/quick/historical-corrections.cjs` låser alle fire rader, tidligere
hele filhash, de seks feltene, uendrede identiteter/årssett/merketerskler,
endrede beregnede plasseringer og bevarte DNS/DNF/DQ-avklaringer.
`tests/data-quality-browser.cjs` kontrollerer profil og årsarkiv på mobil/PC.
De eksisterende Enny-, Jon- og V3.2-bevaringstestene gjenoppretter bare disse seks dokumenterte
feltene i minnet før kontroll mot sine **uendrede** tidligere referansehasher.
Versjonstestene bruker nå neste revisjon relativt til gjeldende pakke, med
samme negative tester for manglende ekstern godkjenning og rollback.

Historisk A2-dokumentasjon beskriver situasjonen før disse rettelsene. Gjeldende
varsler er 7 statusnormaliseringer, 1 bevart DQ-avvik og 79 DNS-referanser uten
personpost: **87 varsler og 0 feil**. De tidligere to tids- og to distansevarslene
er borte etter godkjent kildekorrigering.

### Utført sluttkontroll – 15. november 2026

| Kontroll | Resultat |
| --- | --- |
| Isolert `npm run test:public`, uten administrative originalregistre | **133/133 bestått**, ingen hoppet over |
| Utvalgte kilderegresjoner: Jon, A1D-kandidatvalidering, offentlig eksport, V3.2-bevaring og Heder V3 | **44/44 bestått**, ingen hoppet over |
| `npm run data:check-sources` | Originalkilde og foreslått offentlig eksport samsvarer, datarevisjon 2 |
| `npm run data:check-history` | 0 feil, 87 bevarte varsler |
| `npm run build` og separat `npm run public:kontroll` | Gyldig pakke, 74 filer, 43 synlige Heder-profiler |
| Offentlig Heder-/PDF-regresjon | Alle 86 synlige diplomgrunnlag bevarer innholdshash og utskriftsmodus; gjeldende A4-/fontkontroller består |
| `npm run diplomer:kontroll` | Uendret intern kontroll: 44 bevarte personer, 60 gyldige og 28 ventende varianter, `written:false` |
| Faktisk kandidat mot kontrollkode fra main | Avvist uten head-godkjenning; også avvist uten ekstern manifestgodkjenning etter simulert head-review |
| Direkte Chromium-sammenligning mot tidligere main | Alle årssett, deltakelsesmerker, fullførte kilometer/høydemeter og dagens rekorder uendret |
| Dokumentlenker og `git diff --check` | Bestått |

En innledende kildetestkjøring hadde én feil: V3.2-testen frøs hele den gamle
historikkfilen. Den er tilpasset med den samme, eksakte tilbakeføringen av seks
godkjente felt som Enny-/Jon-testene. Den opprinnelige byte-referansen og alle
andre assertions er beholdt. Hele utvalget på 44 tester besto deretter på nytt.
De tidligere målrettede kjøringene overlapper de 177 testene i tabellen og
summeres ikke inn i dette tallet. Den komplette private kildetestpakken og
historiske diplomgallerier er ikke regenerert for denne avgrensede rettelsen.

Ingen heders-/personregistre utover den autoritative løpshistorikken er endret.
Det er ingen endring av workflows, sikkerhetsregler, avhengigheter, design eller
beregningsregler. Den foreslåtte datapakkereferansen og fjerningen av to gamle
radunntak er de nødvendige valideringsendringene. GitHub-variabler er ikke satt,
og lokal teststatus er ikke en bekreftelse på godkjent ekstern Actions-kjøring.

## Jon Grindland – Junior 3 km, 2026

Grunnlag: arrangørens bekreftelse og skjermbilde av EQ Timings korrigerte klassevise resultatliste, delt i samtalen 10. november 2026. Nettverkspolicyen i arbeidsmiljøet tillater ikke direkte oppslag mot EQ Timing; skjermbildet er den kontrollerte kilden.

- Person-ID: `MOR-638C1F4`.
- Navn, tid **16:10**, klubb **FRAMSTEG IL**, startnummer **120** og deltakelsesår er uendret.
- Intern kjønnsverdi: `Dame` → `Herre`.
- Klasse: `K10-12` → `M10-12`.
- Korrekt plass: **7 i M10-12**, slik skjermbildet viser. Plass 12 i denne listen tilhører Olav Espeland.

Juniorplasseringer beregnes innen registrert aldersklasse, separat per år, konkurranse, distanse og kjønn. Vanlige løp beholder kjønn-/distanserangeringen. Arkivets klasseoverskrifter, profilens plassering, kildeplassering og plasseringsbaserte prestasjoner bruker samme inndeling.

K10-12 har nå 1, 2, 3, 4, 4, 6. M10-12 har 1, 2, 3, 4, 4, 6, 7, 8, 9, 10, 11, 12. Disse to klassene er kontrollert direkte mot skjermbildet. M13-14 har 1, 2, 3, beregnet etter samme regel fra klassens tre uendrede tider. Tjue kildeplasseringer i 2026 Junior 3 km er normalisert til klasseplassering; ingen tider eller andre resultatfelt er endret utenom Jons klasse.

Juniorfeltet har fortsatt 21 deltakere: 15 gutter og 6 jenter. Hele 2026 har fortsatt 398 individuelle deltakere: 248 herrer og 150 damer. Globale profilantall blir 1691 herrer og 952 damer. Lagresultater, deltakelsesmerker, løyperekorder, aliaser og årsstatistikkens deltakelsestall er uendret.

Jon har fortsatt én deltakelse, men får ingen uriktig klasseseier eller pallplass. De øvrige juniorenes plasseringsbaserte prestasjoner følger de korrigerte aldersklasseplasseringene. `tests/jon-grindland.cjs` kontrollerer begge klasselister, M13-14, delte plasseringer, DNS/DNF, mobil/PC, profil/arkiv og kjønnsfiltre. Testen gjenoppretter bare de dokumentert endrede feltene i minnet og kontrollerer at hele den tidligere historikkfilens SHA-256 stemmer; øvrig historikk er dermed bevart.
