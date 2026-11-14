# C2.1 – Årets arrangement

Utgangspunkt: siste `main` etter PR #38 (`7b36b13`). Etter eiers gjennomgang,
merge og vanlig Pages-publisering brukes modulen direkte på:

**https://morothon-no.github.io/historikk/admin/#import**

Menynavnet er **Årets arrangement**. Den eksisterende ruten/modulnøkkelen
`import` beholdes av hensyn til lenker og C1.3-konfigurasjon. Ingen installasjon,
Node-server, GitHub eller JSON-redigering er nødvendig for arrangørens arbeid.

## Praktisk arbeidsflyt

1. Velg arrangementsår. Forslaget er året etter siste gjennomførte utgave i
   godkjent historikk, ikke et hardkodet år eller et antatt inneværende kalenderår.
2. Velg en CSV/XML-startliste. Format, tegnsett og kolonner gjenkjennes; listen
   analyseres straks når påkrevde kolonner finnes. Ved behov korrigerer du Navn
   eller Fornavn/Etternavn, Distanse og øvrige kolonner i nedtrekksmenyene.
3. Kontroller antall leste, avklarte, usikre, identisk dupliserte og avviste rader.
   Radnummer og konkret feil vises. Ukjent distanse kan kobles til en eksisterende,
   godkjent øvelse; dette oppretter ikke en ny distanse eller et resultat.
4. Åpne **Personkontroll**. Kandidatene har navn, kanonisk ID, tellende år,
   periode, siste registrerte løp og lenke til full løperhistorikk. Bekreft,
   avvis, velg en annen profil, marker en ny person eller utsett avgjørelsen.
   Samleknappen er en uttrykkelig arrangørbekreftelse av entydige, registrerte
   navn/aliaser; svake, tvetydige eller motstridende treff inngår ikke.
5. Under **Merkeprognoser** og **Bestillingsoversikt** ser du mulig merke,
   historisk/mulig antall og avklart/usikker identitet. Filtrer på merke eller
   distanse. Mottakerlisten per merke kan åpnes uten å forlate oversikten.
6. Last ned fire Excel-kompatible CSV-rapporter: importoversikt, personkontroll,
   merkeprognose og bestillingsoversikt. De to siste følger valgte filtre.

Prognosen er alltid **FORELØPIG PROGNOSE**. Påmelding blir aldri en historisk
deltakelse, en formell tildeling eller et utskrevet diplom.

## Støttede formater – presis avgrensning

Revisjonen og filkartleggingen fant **ingen faktiske CSV/XML/XLSX-prøvefiler fra
EQ Timing** i prosjektet. Dette er derfor et dokumentert minimum testet med
tydelig syntetiske filer, ikke sertifisering av alle EQ-varianter. Kontroller
alltid første innlesing av arrangørens virkelige eksport.

| Format | Støtte |
| --- | --- |
| CSV/TSV | Semikolon, komma og tabulator, valgfri BOM og Excel `sep=;`, siterte felt/linjeskift og `""`-escaping |
| Tegnsett | UTF-8, Windows-1252/vanlig nordisk ISO-8859-1 og UTF-16 med BOM |
| Kolonner | Norske/engelske navn og eksplisitt manuell kobling; dupliserte/tvetydige overskrifter gjettes ikke |
| IOF XML 3.0 | Avgrenset `StartList` med `ClassStart/PersonStart`, `Person/Name`, `Person/Id`, `Start/BibNumber`, `Course/Name`, `Organisation/Name` og valgfri dato |
| Rad-XML v1 | Det dokumenterte `StartList/Participant`-skjemaet nedenfor; uten namespace |
| XLSX, resultatimport, API/scraping | Ikke implementert. Eksporter CSV/XML. Ingen resultatavstemming eller permanente endringer i C2.1 |

Bare navn (eller for-/etternavn) og en distansekolonne kreves. ID, startnummer,
klasse, klubb, status og år er valgfrie felt. Manglende stabil ID flagges, men
er ikke alene en avvisning. Filens eget år må stemme med valgt arrangementsår.
Status mangler normalt i en startliste og tolkes da som **Påmeldt**. Resultattider
importeres ikke; dette er ikke C2.3s resultatadapter.

Dato-/årsfelt støtter fire sifre, `YYYY-MM-DD` og norsk dag/måned/år med punktum,
skråstrek eller bindestrek. IOF-tidsfelt brukes bare til å lese arrangementsåret.
Fødselsdato minimeres til år og brukes bare til å oppdage motstridende opplysninger
og til trygg gjenbruk av manuelle valg. Den offentlige historikken har ikke
tilsvarende fødselsår; derfor kan dette ikke automatisk avgjøre en historisk
identitet. Fødselsår/dato inngår ikke i CSV-rapportene.

CSV-eksempel – alle navn/ID-er er syntetiske:

```csv
Navn;EQID;EntryID;Startnr;Distanse;Klasse;Klubb;År
Testløper Eksempel;EQ-TEST-1;ENTRY-TEST-1;001;Kortmoro;M;Syntetisk klubb;2027
```

Året i eksemplet er bare eksempeldata. UI foreslår neste år dynamisk.
`EQID` er utøveridentifikator, `EntryID` gjelder én påmelding, `Startnr` er tekst
innen en øvelse. Disse er ulike nøkler. Et tilfeldig `ID`-felt gjettes ikke til
en bestemt identitetstype; bruk kolonnekoblingen.

Rad-XML v1 – syntetisk minimum, ikke en påstand om leverandørens generiske XML:

```xml
<StartList>
  <Participant>
    <Name>Testløper Eksempel</Name>
    <AthleteId>EQ-TEST-1</AthleteId>
    <EntryId>ENTRY-TEST-1</EntryId>
    <Bib>001</Bib>
    <Distance>Kortmoro</Distance>
    <Club>Syntetisk klubb</Club>
    <Year>2027</Year>
  </Participant>
</StartList>
```

IOF-skjemaet identifiseres av namespace
`http://www.orienteering.org/datastandard/3.0` og `iofVersion="3.0"`.
Bare det dokumenterte delsettet er implementert. At en IOF-fil fungerer, betyr
ikke at en bestemt EQ-eksport er verifisert. Ukjente XML-røtter, versjoner,
ødelagt XML, DTD og entitetsdeklarasjoner avvises.
En eksplisitt status på person/start leses når den finnes. IOF `TeamStart`
avvises med konkret beskjed om å bruke stafettmarkert CSV; lag ignoreres ikke
stille i en blandet fil. Rad-XML v1 krever Participant direkte under roten.

## Identitet og trygg omimport

Motoren bruker `MorothonHistoryData.create`, kanoniske ID-er, redirects, godkjente
historiske aliaser og eksplisitte, allerede godkjente Heder→løperkoblinger.
Heder-navn brukes bare som navneforslag; de lager aldri deltakelsesår.

**Navnelikhet er ikke en identitetsbekreftelse.** Det gjelder også et eksakt,
entydig navn og en MOR-ID som bare står i den nye filen. En ekstern ID kan først
gi en bekreftet match dersom den har en dokumentert, kildeavgrenset kobling.
Det finnes ingen slik permanent EQ-ID-tabell i dagens publiserte historikk;
UI oppretter heller ingen. Vanligvis er bekreftede matcher derfor uttrykkelige
arrangørvalg i denne arbeidsøkten, eller trygt videreførte valg fra forrige fil.

Saker omfatter identiske rader, gjenbrukte påmeldings-ID-er/startnumre,
motstridende navn/fødselsår/kjønn for samme kilde-ID, ulike EQ-ID-er for samme
navn, ugyldige identifikatorer, ukjente distanser og tvetydig historikk. Ingen
av disse rettes i hovedregisteret. Svake navneforslag holdes adskilt fra eksakte
navn/aliaser. Svært mange kandidater sperrer prognosen for raden til manuell
avklaring, i stedet for å beregne fra et skjult, avkuttet kandidatutvalg.

Ny fil sammenlignes med forrige analyse i samme år. Oppføringer pares bare når
en nøkkel er entydig: påmeldings-ID, utøver-ID, startnummer eller full rad som
siste utvei. **Dette er revisjonsavstemming, ikke personidentitetsbevis.**
Bekreftelser beholdes bare ved samme identitetsgrunnlag og kompatible kandidater.
Endret navn, fødselsår, kildeformat/-namespace, år eller ny konflikt krever ny
kontroll. Startnummer alene gir aldri en permanent personkobling.

Visningen viser nye, endrede, uendrede og manglende oppføringer, samt endret
prognose. Importoversikten tar også med manglende oppføringer som egne,
tydelig merkede sammenligningsrader. Manglende rad er **ikke automatisk avmelding**,
heller ikke når arrangøren har krysset av for komplett eksport. Ingen DNS,
strykning eller sletting registreres.

## Prognose og bestillingsgrunnlag

- Tersklene leses fra det aktive, godkjente merkeregisteret; ingen universell
  5/10/15-liste er hardkodet i prognosen. En alternativ terskel på 3 testes.
- C1.3s designutkast er fortsatt utkast. De aktiveres ikke som nye beregningsregler.
  I C2.1 er gjeldende aktive policy `morothon-annual-v1`.
- Historiske tellende år til og med valgt år kommer fra felles statusregler:
  DNS teller ikke, DNF teller, og den eksisterende DQ-regelen beholdes. Lag/stafett
  holdes separat. Nye konkurranser/distanser gjettes ikke fra et tilfeldig tall.
- Høyst ett mulig nytt år per kanonisk person. Flere distanser eller doble
  registreringer gir ikke flere merker. Allerede registrert tellende år gir
  ingen ekstra deltakelse eller ny bestilling av et eksisterende merke.
- Uavklarte kandidater gir **usikre muligheter**, ikke sikre mottakere. En ukjent
  person uten brukbart historikktreff får ikke automatisk null år/debutantstatus.
  Arrangøren kan uttrykkelig markere en ny person for denne analysen.
- Samme kandidat telles bare én gang per merke, også når vedkommende finnes på
  flere rader eller som et alternativ i flere navnesaker.
- Øvre klargjøringsbehov gjelder **vurderte kandidater per merke**. Alternative
  identiteter kan representere samme startlisterad på ulike nivåer. Ukjente,
  sperrede eller ukoblede rader kan øke behovet. Det er ingen sikker totalsum
  for hele startlisten før kontrollen er ferdig.

Historiske merker/opptjeningsår, formelle tildelinger og diplomer er urørt.
Det utføres ingen bestilling, tildeling, PDF-produksjon eller publisering.

## Personvern og rapporter

Filbehandlingen bruker bare nettleseren. Ingen startlistedata, navn, personvalg
eller fødselsopplysninger sendes i URL, POST, API-kall, logger, Git eller
offentlige artefakter. Det brukes ikke localStorage, database eller en åpen
lagringstjeneste. Nettleseren varsler før en analysefane lukkes. Ved lukking/
omlasting må filen lastes inn og personvalg bekreftes på nytt.

Offentlig grunnlag leses gjennom eksplisitte, hashkontrollerte filer. Analysen
er et snapshot; ved endret publisert historikk må portalen lastes på nytt.
Rapportene er brukerens egne, lokale nedlastinger og kan inneholde navn,
klubb, startnummer og kilde-ID. Oppbevar og del dem deretter. Fødselsopplysninger
og ukjente ekstra kolonner blir ikke eksportert.

CSV har UTF-8 BOM, semikolon, CRLF og sitering av alle felt. Formler som starter
med `=`, `+`, `-` eller `@` (også etter whitespace/kontrolltegn) nøytraliseres
med apostrof. Alle rapporter har FORELØPIG-status, arrangementsår, regelmodell,
profil, offentlig manifest-/historikk-/merkeregister-/filhash, forrige filhash,
importtid og valgte filtre. Tom rapport beholder metadata i en særskilt
`Radtype=Rapportmetadata`-rad; den er ikke en mottaker.

## Teknisk struktur og levering

```text
tools/diploma-admin/intake-model.js   Parsing, staging, identitet, prognose, diff, CSV
tools/diploma-admin/intake.js         Nettleserfilvalg, personkontroll og rapporter
tools/diploma-admin/intake.css        Avgrenset, responsiv arbeidsflate
```

Tre klientfiler legges eksplisitt til byggekontrakten: **74 filer**, derav
**15 godkjente adminfiler**. Ingen generell mappekopiering. Server, API,
arbeidslister, tester, originalregistre og dokumentasjon inngår ikke i Pages.
Ingen nye avhengigheter eller Actions-endringer. Utvidelsen av filkontrakten
beholder eksisterende ekstern SHA-godkjenning for siste gjennomgåtte commit;
Codex endrer ikke denne variabelen eller godkjent datamanifest.

[Datakontrakter og videre C2.2/C2.3](contracts/startlist-v1.md).
Innlogging, autorisert lagring, varige kilde-ID-koblinger, reelle EQ-pilotfiler,
resultatavstemming, lager/bestilling og formell utdeling gjenstår i senere trinn.

Kontrollbilder bruker **bare syntetisk startliste og syntetiske historiske
testpersoner**. De regenereres i eksisterende CI-artefakt
`morothon-c1-diplomverksted`, undermappe `intake-c21/`, som
`startliste/personkontroll/bestilling-{1440,768,390}.png`. Ingen virkelige
opplastede filer eller personrapporter inngår i slike artefakter.

## Sluttkontroll 14. november 2026

- `npm run test:public`: **89/89 bestått**, ingen hoppede tester. Omfatter de
  eksisterende C1–C1.3-modulene, privat/offentlig datagrense og isolert offentlig
  bygg, samt **12 nye C2.1-tester**.
- `node --test tests/quality-v32.cjs tests/public-export.cjs`: **13/13 bestått**,
  inkludert deterministisk bygg/versjonering, kildekartlegging, bevarte originale
  medaljer/resultater og 43 synlige Heder-profiler/86 uendrede diplomgrunnlag.
- Reell statisk filserver med `/historikk/` og Chromium på **1440, 768 og 390 px**:
  filvalg, automatisk/manuell mapping, personforslag og uttrykkelige bekreftelser,
  duplikathåndtering, usikre prognoser, revidert fil og fire CSV-nedlastinger.
  Ingen utilsiktet siderulling eller browserfeil i kontrollene.
- CSV med norske tegn, ulike skilletegn, UTF-8/Windows-1252/UTF-16, sitering,
  linjeskift og radnummer; IOF-/Participant-XML; ugyldige/store/binære filer,
  DTD, kjørbar markup og formelinjisering er prøvd. Eksterne ID-scoper blandes
  ikke; nye konflikter gjenåpner tidligere avgjørelser.
- Syntetiske tester bekrefter 9 → mulig 10, 4 → mulig 5, alternativ terskel 3,
  DNS/DNF/stafett, allerede registrert år, identisk omimport og uendret historikk.
- Nettverksregistreringen etter filvalg viser bare GET mot samme offentlige
  filserver: ingen opplastings-/API-/POST-kall eller importdata i URL. Ingen
  localStorage eller eksterne tjenester brukes.
- De 12 nye testene er kjørt igjen etter siste UI-/formatkontroll: alle består,
  inkludert XML-DNS, bevart side i personkontrollen og sperret massebekreftelse
  av avviste rader. `npm run build`, separat `npm run public:kontroll` og
  `npm run data:check-sources` består: 74 tillatte filer, 43 profiler og
  uendret godkjent dataversjon 1.
- `.github/`, `data/`, `public-data/`, `assets/`, `js/`, `css/`, offentlige
  `index.html`/`heder.html`, npm-pakker og låsefil er uendret fra siste main.
  Ingen nye avhengigheter, administrative originaler eller reelle importfiler
  er lagt til. Dokumentlenker og diff-kontroll består.

Dokumentasjonens resultat gjelder lokale tester. GitHub Actions og faktisk
publisert C2.1-adresse må bekreftes etter PR-opprettelse, nødvendig
kontraktgodkjenning og senere eiers merge. Ingen merge eller publisering er utført.
