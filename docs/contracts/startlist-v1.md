# C2.1 – midlertidig startliste, personkontroll og prognose v1

Normativ implementering: [intake-model.js](../../tools/diploma-admin/intake-model.js).
Dette er en staging-/analysekontrakt, ikke et nytt offentlig dataformat eller
en API-tillatelse. Alle objekter holdes i arbeidsøktens minne. Ingen av dem kan
kopieres direkte til `history.json`, `awards`, personregister eller diplomutstedelse.

## Grenser og versjoner

Filgrense 4 MB, maksimalt 5000 deltakerrader, 80 kolonner og 1000 tegn per felt.
Header har maks. 100 tegn; navn maks. 200. CSV sitering og radantall valideres.
XML med DTD/entiteter avvises før DOM-parsing; røtter, namespace og støttet
IOF-versjon kontrolleres. Ingen HTML, XSLT eller importert kode kjøres.

Stagingobjekt:

```text
schemaVersion: 1
kind: startlist-staging
format: csv-columns-v1 | xml-participant-v1 | iof-startlist-3.0
delimiter: semikolon | komma | tab | null
headers: overskrifter/normaliserte XML-felt
mapping: felt -> kolonneindeks, eller -1 (ikke brukt)
records: [{line, cells}]
```

CSV-`line` er faktisk fysisk startlinje, også ved siterte linjeskift og `sep=`.
XML-`line` er **deltakerens rekkefølge**, ikke et oppdiktet fysisk linjenummer.
Påkrevde bindinger er `name` eller `firstName`+`lastName`, og `event`.
Valgfrie felt: athleteId, entryId, runnerId, bib, className, club, birthYear,
gender, year og status. Full fødselsdato minimeres til år ved normalisering.
Ukjente ekstrakolonner sendes ikke videre til rapporter eller historikk.

Normalisert registrering:

```text
id: lokal row-N, ingen global resultat- eller person-ID
line, sourceScope, name, athleteId, entryId, runnerId, bib
event, className, club, birthYear|null, gender, year, status
errors[], warnings[], identityKey, signature
```

`status=Påmeldt` er en **påmelding**, aldri en ny `Fullført`-rad i historikken.
I den betingede prognosen prøves om årets eventuelle deltakelse ville telle
under gjeldende policy. DNS, DNF, DQ og stafett avgjøres av eksisterende
`MorothonHistoryData`, uten endring av gamle resultater.

## Kildescope og identitet

`sourceScope` binder kilde-ID-er til dokumentert importformat. Lik tall-ID i
IOF XML og en CSV er ikke bevis på samme utøver. Et framtidig, betrodd register
kan gi `externalLinks: [{sourceScope, athleteId, runnerId, confirmed: true,
evidence}]` til motoren. Dagens offentlige UI leser **ikke** slike bekreftelser
fra opplastede filer og oppretter ikke permanente koblinger. En MOR-ID oppgitt
i fila er også bare en kildepåstand frem til kontroll.

Personvurdering:

```text
match.status:
  proposed | confirmed | unknown | conflict | new | deferred | team
match.reason
match.candidates: [{id, name, gender, names, years, reason}]
match.candidateCount?, match.forecastBlocked?
```

Kandidater kommer bare fra kanoniske, godkjente historiske personer/aliaser og
godkjente Heder-løperkoblinger. Statistikk beregnes fra faktiske tellende år,
ikke gamle kompakte totalfelt. Samme navn på flere personer gir konflikt.
Navnelikhet, klasse, klubb eller importert fødselsår kan ikke alene bekrefte en
historisk identitet. Mer enn tolv kandidater sperrer prognosen for raden til
manuelt valg, i stedet for å beregne en ufullstendig mottakerliste.

Midlertidig beslutning:

```text
action: confirm | different | new | defer
runnerId?           bare ved valg av en eksisterende person
confirmedAt        tidspunkt for arrangørens klikk, ingen autentisert aktørsignatur
sourceSha256       hvilken fil avgjørelsen gjaldt
carried?           videreført etter ny fil og ny kontroll av kompatibilitet
```

`identityKey`/`signature` er interne, eksakte sammenligningsverdier og kan
inneholde personopplysninger. De havner ikke i URL, logger eller CSV. Nye personer
bruker bare en ugjennomsiktig lokal `new-N` i prognosen; dette er ikke en permanent
person-ID. Ved ny konflikt gjelder ikke en tidligere bekreftelse/avvisning.

## Analyse, kontrollsaker og revisjoner

```text
schemaVersion: 1
kind: startlist-analysis
status: FORELØPIG PROGNOSE
year, policy: morothon-annual-v1
meta: profileId, manifestSha256, historySha256, registrySha256,
      sourceSha256, importedAt, format, encoding, completeSnapshot
rows[], summary, reviewCases[], forecast[], orders[], comparison|null
```

En kontrollsak har lokal ID, `code`, `rowIds`, radreferanse, alvorlighet og en
forklaring. Analysens kildesnapshot gir referansen for framtidig C2.2. Koder
inkluderer identitetskonflikt, manglende/ugyldig ID, motstridende kilde-ID,
gjenbrukt påmeldings-ID/startnummer, ukjent distanse, identisk rad og flere
registreringer for samme person/år. Dette er ikke et permanent saksregister.

`comparison` pares bare på entydige nøkler innen samme år og returnerer nye,
endrede, manglende, uendrede, forrige filhash og endret prognose. Ved bytte av
år er scope endret, ikke en liste av avmeldte. `completeSnapshot` er arrangørens
opplysning; den autoriserer ingen sletting, DNS eller historisk endring.

## Prognose og klargjøringsplan

```text
forecast[]:
  candidateId, name, badgeId, badgeName, threshold
  historicalCount, possibleCount, confirmed, ambiguous
  rowIds[], distances[], bibs[], reason, caveats[]
orders[]:
  badgeId, badgeName, threshold, confirmed, uncertain,
  prepareMax, ambiguous, recipients[]
```

Utregningen bruker bare årssett til og med valgt år. Allerede registrert år
gir ikke et nytt år, og flere registreringer gir høyst ett nytt tellende år.
Terskler hentes dynamisk fra aktivt merkeregister. Usikre kandidater merkes og
dedupliseres per kandidat/merke, men kan representere alternative identiteter.
Øvre behov gjelder bare vurderte kandidater per merke; det er ingen garanti
for et fullstendig lagerbehov før ukjente/sperrede rader er avklart.

Rapporter er semikolon-CSV med BOM, CRLF, sitering og formelnøytralisering.
`Radtype=Data` er en datarad; `Rapportmetadata – ingen datarader` bevarer
snapshot-/FORELØPIG-informasjon for tomt utvalg. Første metadatafelt inneholder
ikke en fiktiv mottaker. Fødselsår, rå ekstrakolonner og interne identitetsnøkler
eksporteres ikke. Eksport er ingen tildeling eller godkjenning.

## Senere trinn

C2.2 må legge til autorisert, kildebundet og reverserbar feilretting med
konsekvensanalyse. C2.3 må avstemme startlisten mot ekte resultater og håndtere
etteranmeldte/statusendringer før faktiske merkemottakere og diplomjobber
foreslås. Innlogging, varig lagring og formell utdeling er egne autoriserte
prosesser. Ingen CSV fra C2.1 kan alene utløse disse handlingene.
