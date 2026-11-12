# 03 – Generell datamodell og import

Dette er en målmodell og en plan, ikke en migrering av Morothons filer. Dagens 6 914 resultater er arrays med ti posisjoner: år, person-ID, historisk konkurransenavn, distanse, status, tid, kildeplass, klasse, klubb og startnummer. `people` inneholder både identitet og kompakte, delvis avledede felter. `yearStats` er også posisjonsbasert. Det finnes ikke egne resultat-, arrangementsutgave-, sesong- eller løypeversjons-ID-er.

Ingen gjenbrukbar EQ Timing-importadapter, importjournal, transaksjonell revisjonsmodell eller redigeringsapp ble funnet i dette repositoryet. Dokumenterte korrigeringer finnes i data, testfixturer og dokumentasjon; dette er verdifulle spor, men ikke en generell importmotor.

## Funn

| ID / type / alvorlighet | Fil/modul og observasjon | Anbefalt løsning og effekt | Gjennomføringsrisiko | Omfang | Avhengigheter |
| --- | --- | --- | --- | --- | --- |
| I-01 · produktmangel · høy | `data/history.json` og `index.html:824` mangler stabile resultat-/utgave-ID-er og kildefilnøkler. Lik rad er ikke nødvendigvis samme resultat ved omimport. | Stabile interne ID-er og en versjonert importjournal. Sikker omimport og avgrenset diff. | Høy: identiteter og manuelle historiske tillegg må bevares. | 3–6 pd for kontrakt/prototype | R-03/R-04; rettighet til kildedata |
| I-02 · risiko · høy | Ingen feltvis, kildebundet overstyringsmodell for korrigeringer; en ny full fil kan overskrive redaksjonelt arbeid. | Råimport + godkjente korreksjoner med forventet førverdi og konfliktkontroll. Bevarer rettelser ved ny kildeversjon. | Høy ved feil prioritet eller «siste fil vinner». | 4–8 pd | I-01; redigerings-/godkjenningsrolle |
| I-03 · produktbegrensning · høy | År fungerer som utgave-ID i `history-data`, `loyalty`, `compare`, milepæler og Heder. Ingen generell sesongscore. | Generelle edition-/competition-/season-ID-er og en bakoverkompatibel Morothon-adapter. Støtter årlig løp, karusell og flerdagersløp uten nye kundespesifikke motorer. | Høy: dobbeltelling og nye løyperekorder på feil grunnlag | 8–15 pd for første modell/adapter | A-02; referansereglene i 02 |
| I-04 · produktmangel · høy | Oppdatering skjer gjennom filer/Git; identitetsrapporten er bare et kontrollverktøy. | Importstaging med eksplisitt godkjenning, låst grunnrevisjon og separat publisering. Arrangøren kan gjøre daglig arbeid selv. | Middels–høy: tapsfrie konflikter og tilgang må fungere | 10–20 pd for første brukerflyt, del av oppgave 5 | I-01/I-02, S-01/S-03 |
| I-05 · forbedring · middels | `scripts/lib/runner-link-review.cjs` har forsiktige aliasforslag og eksplisitt bekreftelse, men `MOR-...`-format og kundespesifikke kilder. | Gjenbruk match-/bekreftelsesprinsippet med arrangøravgrensede ID-er og dataminimering. Ingen automatisk personsammenslåing. | Middels: navn er ikke identitetsbevis | 2–4 pd, inngår i importløpet | Identitetspolicy og kundens bekreftelser |

## Entiteter og grenser

ID-er skal være ugjennomsiktige og stabile. Dato eller navn skal ikke være eneste nøkkel.

| Entitet | Viktige felt / binding |
| --- | --- |
| `Organizer` | `organizerId`, navn, språk, tidssone, publiserings- og eierskapsinnstillinger |
| `EventSeries` | `seriesId`, `organizerId`, navn og type: årlig, karusell eller sammensatt |
| `Season` | `seasonId`, `seriesId`, navn, fra/til, sammenlagtpolicy-ID; kan krysse kalenderår |
| `Edition` | `editionId`, `seriesId`, `seasonId`, faktisk dato/dato-intervall, `held/planned/cancelled`, eventuell rekkefølge |
| `Competition` | `competitionId`, `editionId`, konkurransetype, løypeversjon, distanse og klasseoppsett; flere per utgave |
| `CourseVersion` | stabil ID, faktisk distanse, gyldighetsomfang, eventuell dokumentasjon; lik kilometerlengde er ikke bevis på lik trasé |
| `Person` | `personId`, arrangøravgrensning, publisert navn og kontrollerte aliaser; kjønn/klasseopplysninger per resultat når historisk nødvendig |
| `Team` / `Entry` | `teamId` eller person-ID, konkurranse, startnummer og eventuell etappe; ikke en «person» med lagnavn |
| `Result` | `resultId`, `competitionId`, entry-ID, status, `elapsedMs` eller null, rå tid, kildeplass, klasse, klubb, provenance |
| `ImportBatch` | kildens navn/format, filhash, adapter-/mappingversjon, avgrensning, før-/etterrevisjon og godkjenning |
| `Correction` | mål-ID/felt, førverdi, ny verdi, grunnlag, aktør, status og tidspunkt |
| `Award` / `DiplomaIssue` | separate vedtak og dokumenter; kvalifikasjon alene oppretter ingen av dem |

Eksempel på en generell utgave og konkurranse:

```json
{
  "organizerId": "org-example",
  "seriesId": "series-autumn",
  "seasonId": "season-2027",
  "editionId": "edition-round-04",
  "status": "held",
  "date": "2027-09-15",
  "competitions": [{
    "competitionId": "competition-round04-5k",
    "kind": "individual",
    "distanceMeters": 5000,
    "courseVersionId": "course-lake-v2"
  }]
}
```

En annen runde kan ha samme år og en ny `editionId`; to konkurranser på samme dag kan tilhøre én utgave. Et flerdagersarrangement kan være én utgave med flere konkurranser eller flere utgaver i en serie. Arrangørens faktiske organisering avgjør dette, ikke en automatisk regel basert på dato.

Morothon-adapteren mapper én utgave per registrert arrangert år og beholder `MOR-...`-ID-er. Historiske konkurransekategorier, kildeplasser, manuelle tilleggsrader og distanser endres ikke. 2014-skillet legges i Morothons løype-/rekordpolicy. Adapteren må også bevare de 79 DNS-radene uten personobjekt som kildeoppføringer, uten å konstruere deltakere, samt de bevisst untimede fullføringene. Der eksakt dato mangler, lagres presisjon `year` eller bekreftet `month`; aldri en oppdiktet første dag i måneden.

## Separate statistikkenheter

`starts`, `participatedEditions`, `completedResults`, `participatedSeasons`, `participationYears` og `seriesScore` er ulike felt. UI skal si hvilken enhet som vises. En person kan ha to starter i samme utgave, delta i 15 runder i én sesong og fortsatt bare ha ett deltakelsesår.

Morothon bruker fortsatt **ett tellende deltakelsesår per person**, DNS utelatt og DNF medregnet. En karusell kan velge utgave som merketerskel. Lojalitetens nevner må være holdte, tellende utgaver i avtalt scope; planlagte og avlyste runder må ikke få samme effekt. Endringer av policy versjoneres, ikke legges på gamle resultater uten beslutning.

Sammenlagt konfigureres med en liten deklarativ policy: `all` eller `bestN`, poengtabell eller samlet tid, minimum antall starter, håndtering av DNS/DNF/DQ, delte plasseringer og tie-break. For samlet tid må det bestemmes hvilke sammenlignbare konkurranser som inngår, og hvordan manglende runder behandles. Ingen vilkårlige opplastede JS-formler i første versjon. Vis gjerne hvilke runder som teller og hvilke som er strøket. Årlige arrangementer får ingen sammenlagtinnstillinger med mindre modulen aktiveres.

## Importarkitektur og godkjenningsflyt

Adapteren returnerer et normalisert **stagingforslag**, aldri direkte produksjonsdata. Start med dokumenterte EQ Timing-filvarianter fra pilotene, eksempelvis CSV med mapping. Test encoding, separator, norske tegn, desimalkomma, ulike klokkeformater og forskjellige eksportkolonner. XLSX/XML legges til etter faktiske prøvefiler; et skjermbilde og en eksport er ikke samme format. Ikke anta en tilgjengelig eller lisensiert API-/skrapetilgang.

1. Lagre originalfil i privat importlager med filhash, leverandør og tidspunkt.
2. Gjenkjenn format eller la arrangøren velge adapter/mapping; avvis tvetydig identifikasjon.
3. Velg serie, sesong, utgave og konkurranse. Bekreft om filen er et fullstendig snapshot eller et tillegg.
4. Valider kolonner, statuser, distanser, klokkeverdier, klasse og interne referanser. Skill advarsler fra publiseringsstopp.
5. Foreslå kjente kilde-ID-er og kontrollerte aliaser. Vis entydige, usikre og konfliktende navnetreff separat. Nye permanente koblinger krever bekreftelse.
6. Vis diff mot siste aksepterte import i **samme konkurransescope**: lagt til, endret, fjernet og urørt; marker konflikter med manuelle rettelser.
7. Arrangøren godkjenner et bestemt forslag mot en bestemt grunnrevisjon. En nyere revisjon gir konflikt, ikke overskriving.
8. Beregn nytt avledet grunnlag og kjør datakritiske kontroller. Bygg separat offentlig forhåndsvisning.
9. Publiser en uforanderlig release etter egen godkjenning. Å godkjenne personkoblinger skal ikke samtidig publisere dem.
10. Behold forrige release som gjenopprettingspunkt og privat revisjonslogg.

### Idempotens og korreksjoner

En importnøkkel omfatter filhash, målscope, adapter- og mappingversjon. Identisk omimport skal gi null materielle endringer, ikke en ny kopi av resultatene. Bruk leverandørens stabile resultat-ID når den finnes. Startnummer er bare mulig nøkkel innen dokumentert konkurransescope; navn og tid er ikke en robust unik nøkkel. Uten kilde-ID avstemmes et komplett konkurransesnapshot, og uklare koblinger krever manuell kontroll. Interne `resultId`-er beholdes etter avstemming.

Godkjente rettelser ligger som kildebundne overstyringer med forventet førverdi. Ny kildeversjon som er enig med rettelsen kan markeres som avklart. En ny kildeverdi som motsier den, gir en konflikt; den skal ikke automatisk vinne eller bli ignorert. Manglende rad betyr bare sletting dersom filen eksplisitt er et fullstendig snapshot av samme scope og endringen godkjennes.

Angring gjøres som en ny kontrollert revisjon eller tilbakeføring av offentlig release, ikke ved å slette journalen. Personvernbegrensninger må fortsatt gjelde ved rollback; en tidligere fjernet offentlig opplysning må ikke dukke opp igjen bare fordi man publiserer en gammel pakke.

## Heder i den generelle modellen

Heder bruker eventuelle bekreftede løperkoblinger, men har egne roller, innsatsoppføringer, historier, merkeforslag og vedtak. Nye systemer kan bruke `confirmedEditionIds`; Morothons dokumenterte `confirmedYears` kan mappes når én utgave per år er entydig. En godkjent total uten enkeltår forblir en total med kilde og presisjon, ikke en konstruert årsrekke. Et registrert startår kan ikke brukes til å anta dugnad i alle 20 ukentlige runder.

Bevar oppnåelsesdato, beslutningsdato og faktisk utdelingsdato som ulike felt. Historiske rolleperioder eller styrelederverv skal ikke generere dugnadsutgaver automatisk.

## Akseptanse for første pilot

Morothon skal kunne leses gjennom adapteren med samme kanoniske personer, årssett, 2026-kontrolltall, rekorder og historiske diplomer. Samme fil importert to ganger gir ingen dubletter. En import i konkurranse A endrer ikke B. En ny kildefil mister ikke en godkjent korreksjon. Et usikkert navnetreff lagrer ingen `personId`-kobling. Manglende år rapporteres uten oppdiktede deltakelser. Et 20-runders syntetisk sesongsett viser separate starter, utgaver, sesonger og år.
