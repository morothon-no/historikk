# V3.6 – redigering av persontekster og diplomer

Alle 44 har ett redigerbart tekstoppslag under `personDetails` i
`data/honors.json`, også de enkle navnene som opprinnelig er registrert i
`data/volunteers.json`. Ingen ny personidentitet eller dobbelt profil opprettes.

```json
"personDetails": {
  "per-sangvik": {
    "shortDescription": "",
    "stories": [],
    "runnerLink": {
      "runnerId": "MOR-EEA35C7",
      "confirmed": true,
      "sourceIds": ["organizer-v36-runner-links"]
    }
  }
}
```

- `shortDescription`: korttekst på personkortet og innledning i detaljprofilen,
  maksimalt 350 tegn. Tom tekst gir ingen generert ros. Kortet viser et kompakt
  utdrag, profilen hele teksten.
- `stories`: alle lengre historier, som `{title, text, source, sourceIds,
  confirmed}`. Bare kildebelagte historier med `confirmed: true` vises.
  Flere avsnitt kan skrives med linjeskift. Feltet fungerer likt for alle 44.
- `honorDiplomaText`: aktiv, personlig tekst bare for Morothons æresmerke.
  Anbefalt 2–4 setninger og maksimalt 350 tegn; layoutkontrollen avgjør om
  faktisk tekst får plass. Tomt/manglende felt bruker `diplomaTexts.honorDefault`.
- `runnerLink`: bare uttrykkelig bekreftede identitetskoblinger, med kilde og
  `confirmed: true`. Løpsstatistikk leses fra samme historikkregler som ellers.
- `diplomaDate`: arrangørbekreftet utdelingsdato for æresdiplomet, med dato
  og `sourceIds`. Den endrer ikke oppnåelsesår eller formelle tildelingsregistre.

Visningstekstene i `personDetails` har forrang. De opprinnelige `reason`,
`stories` og `diplomaTribute` i de eldre kildepostene er bevart som historisk
kildegrunnlag, ikke en ekstra redigeringskilde for nye visningstekster.
Navn, roller og dugnadsår beholdes i sine eksisterende kilderegistre. Nytt
kort-/historieinnhold trenger ikke endringer i HTML, CSS eller JavaScript.

## Diplomenes felles tekster

`diplomaTexts.dugnad` har én tekst per terskel: 5, 10, 15, 20, 30 og 40.
Både personlige dugnadsdiplomer og anonyme nivåeksempler bruker denne kilden.
Personlig ærestekst, eldre eksempeltekst og profilhistorie overstyrer aldri
vanlige dugnadsdiplomer. Navn, høyeste merke, tidligere merker og oppnåelsesdato
beregnes fortsatt dynamisk. Begge medaljevalg beholdes.

De eksisterende, allerede brukte ærestekstene for Oscar, Erling Askildsen og
Einar er flyttet til det nye aktive feltet uten ordendringer. Nye forslag
ligger separat i [v36-tekstforslag.json](v36-tekstforslag.json), med status
`awaiting-organizer-approval`. De inngår ikke i produksjonsdata, aktive
persontekster eller det rene utskriftssettet. Kontroll-PDF-er med forslagene
har tydelig «FORHÅNDSVISNING». Godkjenn teksten før den kopieres til aktivt felt.

## Einars dato

Arrangøren har særskilt bekreftet **7. november 2026**. Diplomet viser
«UTDELINGSDATO» og «Søgne, 7. november 2026». `achievementYear`, `eventDate`
(for oppnåelsen) og `achievementDateLabel` er fortsatt ukjente/tomme.
`presentationDate` holder den bekreftede utdelingsdatoen separat. De 33
arrangørgodkjente dugnadsutgavene gir ingen oppdiktet årsrekke. Det opprettes
ikke noe i `awards` eller `issuedDiplomas` ved datoregistrering eller utskrift.

## Fire bekreftede løperkoblinger

| Hedersnavn | Løper i Adelskalenderen | Person-ID | Deltakelsesår nå |
| --- | --- | --- | --- |
| Per Sangvik | Per Tommy Sangvik | MOR-EEA35C7 | 3 |
| Joar Lohne | Joar Nilsen Lohne | MOR-F582406 | 7 |
| Jenny Åmodt | Jenny Aamodt | MOR-D4EBCCF | 8 |
| Ole J.Bueklev | Ole Bueklev | MOR-F1FE757 | 4 |

Tallene vises dynamisk fra historikken, ikke fra tabellen. Hedersnavn og
løpernavn endres ikke. DNS telles ikke, DNF telles og et deltakelsesår telles
maksimalt én gang. Ingen andre identiteter utledes eller slås sammen.

## Kontrollert klargjøring

Dataendringer blir synlige i kort, profiler og relevante diplommodeller.
En endret diplomtekst/-dato gir en annen innholdskontrollsum. Den gamle rene
utskriftsgodkjenningen følger ikke automatisk med: visningen blir tydelig merket
«FORHÅNDSVISNING» inntil den nye versjonen er gjennomgått og eksplisitt klargjort.

```sh
npm test
npm run diplomer:kontroll
# Etter gjennomgang av endret tekst/dato:
npm run diplomer:klargjor
node scripts/review-honors-v36.cjs /tmp/morothon-v36
npm run build
```

Klargjøring skjer ikke automatisk ved bygg. De 88 presentasjonsvariantene er
separate fra formell tildeling, utstedelse og endelig grafikkgodkjenning.
Bildekvalitetsvarsler, fontkontroll, A4-/overlappkontroll og øvrige sperrer
beholdes. Ordinære løperdiplomer og medaljeoriginaler er uendret.
