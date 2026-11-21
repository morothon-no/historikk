# Videreutvikling av Morothon-admin

## Faktisk status 21. november 2026

Kontrollert offentlig main: `2c79691819d4aba05f5213e55ed171837ea6a4d1`, etter
merge av #151 og #152. [Pages-kjøringen](https://github.com/morothon-no/historikk/actions/runs/44881598802)
er grønn, inkludert kildekoderegresjon, uavhengig artifact-gate og publisering.
[Worker-kontrollen](https://github.com/morothon-no/historikk/actions/runs/44881598801)
er også grønn. Dette er ulike kontroller; grønn Pages-CI beviser ikke at ny
Worker-kode er aktivert eller at en virkelig eiersesjon er testet.

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
| Tellere | #148 tilpasses main: ubehandlede, øktens ulagrede utsettelser og serverlagret oppfølging skilles. Angre, innsending og ny innlogging kontrolleres. | #148 var eneste åpne offentlige PR ved kartleggingen og er fortsatt Draft. Den oppdateres i stedet for å lage en overlappende PR. |
| Navigasjon | De seks oppgavekortene fra #150 gjenbrukes. Samme beskyttede økt brukes på tvers av Personkontroll og Årets arrangement. | Ingen ny adminflate eller designombygging. |
| Resultater | #152 gir [privat lagring og reimport](privat-resultatreimport.md), konfliktvalg og gjenåpning. DNS/DNF-reglene og eksisterende publiseringsmotor beholdes. | Nye årganger, nye resultatlinjer og nye personer krever senere publiseringskontrakt. Grensene på 20 saker og 64 KiB er uendret. |
| Publisering | Resultatrettelser har serverberegnet før/etter, særskilt godkjenning, kilde-/versjonskontroll, backup, etterkontroll og reversering. | Aktiv drift krever gjennomgått Worker-/prosessorkombinasjon og separat godkjenning. |

## Denne oppfølgingen: stabil eksisterende brukerreise i PR #148

Tellerfeilen ble reprodusert på main med syntetiske personer: etter utsettelse
viste arbeidslisten én ubehandlet sak, mens telleren fortsatt viste to. Det ble
ikke skrevet til privat lager. Rettelsen fra #148 integreres med hele #151/#152,
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

## Neste prioritet etter grønn eksisterende flyt

1. Gjennomgå den implementerte [identitetspubliseringen](identitetspublisering.md):
   serverberegnet før/etter, eksakt godkjenning, backup, versjonsbinding,
   etterkontroll og reversering. Kjeden er koblet til eksisterende outbox, men
   `ENABLED=false` og ingen nye publiseringsknapper er tilgjengelige i drift.
   Eksisterende privat statuskontrakt beholdes; verifisert publiseringsstatus
   ligger separat i jobbvisningen. Aktivering krever egen godkjenning.
2. Deretter planlegges nye resultatår, nye løpere og nye registreringer, med
   kildebevaring, tydelig usikker identitet og ingen blind sletting av manglende rader.

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
