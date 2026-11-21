# Videreutvikling av Morothon-admin

## Faktisk status 21. november 2026

Kontrollert offentlig main: `db730825ee37f8342a5ac4ee7f4d3a0b41c95443`, etter
merge av #154. #148 er integrert gjennom #153; både tellerrettelsen og
identitetspubliseringen finnes i main. Ingen av disse PR-ene skal gjenskapes.
Siste ferdige, grønne [Pages-kjøring ved kartleggingen](https://github.com/morothon-no/historikk/actions/runs/44895040342)
gjelder `cff1ee637342767d31f38b289b751b09de5bfb6e` (#153), inkludert
kildekoderegresjon, uavhengig artifact-gate og publisering.
[Ny main-kjøring etter #154](https://github.com/morothon-no/historikk/actions/runs/44901033647)
må kontrolleres separat på `db73082`; den var pågående da kartleggingen ble oppdatert.

Den opprinnelige [Worker-kontrollen #42](https://github.com/morothon-no/historikk/actions/runs/44895040258)
feilet på den offentlige Pages-ruten. #154 forbedrer sikker diagnostikk og endrer
ikke kriteriet eller rutingen. [Oppfølging #43](https://github.com/morothon-no/historikk/actions/runs/44901033821)
er også rød. Den detaljerte HTTP-responsen er fortsatt ikke tilgjengelig fra dette
miljøet. Les [undersøkelsen](worker-protection-42.md). Verken grønn Pages-CI eller
merge av diagnostikken er bevis på at aktiv Worker/Pages-etterkontroll er rettet.

Privat main i `historikk-admin` er fortsatt
`7200efff68d3a5883abdf8610f887da67a0667b7`. Den private workflowen og offentlig
Wrangler-konfigurasjon peker begge på prosessorkode
`ff7f99c1e60a951ba5ca6762edb95bff62c0f4d2`, før #151/#152. Bare Git-referansen og
workflowfilen er lest; private personregistre, driftssessionsdata og secrets er
ikke hentet. Ingen pins eller utrulling er endret.

GitHub-API-et avviser tilgang med `Forbidden`. Offentlige PR-/Actions-sider kan
leses; detaljerte logger og private PR-/CI-tilstander er ikke fjernverifisert.
Anonyme GET-kontroller mot Worker og adminadressen ble også avvist av dette
miljøets nettverksproxy (`Tunnel connection failed: 403 Forbidden`). Dette er
**ikke en bekreftet produksjonsfeil** og heller ikke en bestått live-kontroll.
Ekte eierinnlogging, aktiv Worker-versjon og virkelig privat lagring må fortsatt
verifiseres ved separat godkjent aktivering.

| Område | Implementert og testet i kode | Ikke aktivert / gjenstår |
| --- | --- | --- |
| Innlogging | Beskyttet gateway, PKCE, HttpOnly-cookie, kontroll av eier og skjult admin før oppstart er ferdig. Forsinket oppstart testes med den ekte beskyttede HTML-en og uendret kritisk CSS. | Virkelig innlogging og aktiv Worker-versjon er ikke verifisert fra dette miljøet. |
| Personkontroll | Hurtigvalg, hovednavn, detaljsammenligning, atomisk privat batch og varig «Undersøk senere» fra #151. [Fase 3](identitetspublisering.md) implementerer serverkontroll, særskilt godkjenning, publisering og reversering. | Identitetspublisering er deaktivert. Ingen virkelig personavgjørelse utføres i denne leveransen. |
| Tellere | #148 er merget gjennom #153: ubehandlede, øktens ulagrede utsettelser og serverlagret oppfølging skilles. Angre, innsending og ny innlogging kontrolleres. | Ingen ny overlappende tellerrettelse. |
| Navigasjon | De seks oppgavekortene fra #150 gjenbrukes. Samme beskyttede økt brukes på tvers av Personkontroll og Årets arrangement. | Ingen ny adminflate eller designombygging. |
| Resultater | #152 gir [privat lagring og reimport](privat-resultatreimport.md), konfliktvalg og gjenåpning. Første [årsimportkontrakt](arsimport-kontrakt.md) beregner nye år/personer/resultater og lagrer dem som kryptert privat utkast. | Den nye kontrakten er ennå ikke koblet til web-admin eller publiseringsmotor. Eksisterende flyt og dens grenser er uendret. |
| Publisering | Resultatrettelser har serverberegnet før/etter, særskilt godkjenning, kilde-/versjonskontroll, backup, etterkontroll og reversering. | Aktiv drift krever gjennomgått Worker-/prosessorkombinasjon og separat godkjenning. |

## Integrert oppfølging: stabil eksisterende brukerreise fra PR #148

Tellerfeilen ble reprodusert på main med syntetiske personer: etter utsettelse
viste arbeidslisten én ubehandlet sak, mens telleren fortsatt viste to. Det ble
ikke skrevet til privat lager. Rettelsen fra #148 er integrert med hele #151/#152,
inkludert den nye varige oppfølgingen. Gamle testforutsetninger om at en utsettelse
aldri kan lagres, videreføres ikke.

Den samlede nettlesertesten avdekket også at oppstart av Personkontroll overskrev
sidehodets bekreftede innloggingsstatus. Moduloppstarten skal ikke skrive den
felles sesjonsstatusen; denne eies av eksisterende autentiserte sesjonsvisning.

En gammel testomskriving av `data-admin-mode="protected"` ble fjernet fra
resultatnettlesertesten. Den traff første CSS-selektor i den innebygde kritiske
stilen og gjorde testen mindre representativ. Testen bruker nå faktisk
beskyttet HTML, holder oppstartsskriptet igjen og kontrollerer at admin er skjult
før bekreftet oppstart. Ingen tidsavbrudd er økt og ingen autentisering omgås.

Den samme syntetiske nettleserreisen dekker:

1. Anonym inngang, ekte gateway/PKCE/cookie og direkte beskyttet oversikt.
2. Hurtigknapp til Personkontroll, sammenligning, valgt hovednavn og to avgjørelser.
3. Utsett/angre og riktige tellere; én samlet privat innsending.
4. Ut-/innlogging og gjenåpning av samme behandlede og avviste par.
5. Manuell resultatretting og CSV-import i samme økt, privat lagring og reimport.
6. Identisk fil uten duplikater og en endret fil med uttrykkelig konfliktvalg.
7. Ny innlogging, godkjenning, publisering, offentlig profilkontroll og reversering
   i isolert testrepository. Identitetslageret endres ikke av resultatpublisering.
8. PC, nettbrett og mobil: 1440, 768 og 390 px, uten horisontal rulling.

OAuth-/GitHub-nettverket simuleres. Gateway, autentisering, broker, privat kryptert
lager, prosessor, beregningsmotor, bygg og profilkontroll kjøres som faktisk kode.
Ingen ekte løperdata brukes i de nye testene eller publiseres.

## Teststrategi og leveranseporter

Under utviklingen kjøres berørte identitets-/nettlesertester. Når rettelsen er
klar, kjøres én samlet, målrettet regresjon for gateway, autentisering,
Personkontroll, resultater og publisering. Kommando og eksakt head-SHA oppgis i
leveranserapporten. Ingen egne Heder-gallerier eller historiske diplomrapporter
kjøres lokalt når disse modulene ikke er endret.

Produksjonsbygget sammenlignes mot godkjent main-pakke. Historikk, Heder,
originalregistre, merker, diplomer, manifest, avhengigheter og sikkerhetsregler
skal være uendret. De obligatoriske CI-testene beholdes, også når de inkluderer
Heder. Påkrevde jobber må kontrolleres på siste PR-head før merge.

PR-jobben **Transitional trusted source regression** er main-only. At den er
hoppet over på en PR, betyr ikke at kildekodetestene er bestått. Lokal målrettet
kontroll og den obligatoriske kildekodekontrollen på main må rapporteres hver for
seg; ingen rød eller ikke-verifisert jobb omtales som grønn.

## Årsimport: første testbare del og neste prioritet

Den nye [serverkontrakten og private utkasttjenesten](arsimport-kontrakt.md) er
første avgrensede del av neste hovedleveranse. Den bygger på eksisterende parser,
personforslag, resultatregler og kryptert CAS-lager. Ingen offentlig fil, eksisterende
lagringsstruktur, Worker-rute eller visuell komponent endres.

Før årsimport kan bli operativ i web-admin, gjenstår beskyttet transport til
privat prosessor, overføring av uavklarte personvalg til eksisterende Personkontroll
og en gjennomgått publiseringsadapter for nye personer/år/resultatlinjer. Denne må
beregne alle offentlige aggregater, bruke dagens backup/reversering og verifisere
faktisk publisert resultat. Ingen slik publisering aktiveres av denne kontrakten.

1. Gjennomgå den implementerte [identitetspubliseringen](identitetspublisering.md):
   serverberegnet før/etter, eksakt godkjenning, backup, versjonsbinding,
   etterkontroll og reversering. Kjeden er koblet til eksisterende outbox, men
   `ENABLED=false` og ingen nye publiseringsknapper er tilgjengelige i drift.
   Eksisterende privat statuskontrakt beholdes; verifisert publiseringsstatus
   ligger separat i jobbvisningen. Aktivering krever egen godkjenning.
2. Koble årsimportkontrakten til den eksisterende beskyttede arbeidsflyten og
   gjennomfør serverberegnet konsekvens-/publiseringsadapter i en egen avgrenset PR.
   Årsimporten beholder kildefil og tidligere private filversjoner; manglende rader
   slettes aldri. Full erstatning av årsdata er ikke aktivert.

Dette er ikke en aktivering av funksjonene eller en ny arkitekturplan.

## Aktivering og tilbakeføring krever separat godkjenning

En kode-merge er ikke en Worker-utrulling. Før aktivering må ferdig gjennomgått
kode, CI og rollbackversjon kontrolleres på eksakt SHA. Privat prosessorpin og
Workerens kode-/workflowbinding oppdateres samlet gjennom eksisterende beskyttede
prosess. Følg [manuell utrulling](manuell-worker-utrulling.md); CORE-/OIDC-sperrene
skal ikke løsnes.

Registrer aktiv Worker-versjon og bindings, avklar aktive jobber og behold
krypteringsnøkler. Rollback skal gjeninnføre sist gjennomgåtte Worker-/prosessorkombinasjon
uten å slette private saker eller revisjonslogger. Ingen ekte personavgjørelse,
resultatretting, deploy eller endring av secrets er godkjent av denne oppgaven.
