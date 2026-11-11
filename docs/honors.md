# Menneskene bak Morothon

`heder.html` er en offentlig side via direkte URL, skjult fra hovedmenyen og
mobilmenyen, med `noindex, nofollow`. Dette er ikke tilgangsbeskyttelse.
Siden viser 44 unike personer: 13 hedersprofiler og 31 oppføringer fra den
enkle `data/volunteers.json`. Eksisterende ID-er, aliaser og løperlenker bevares.

## Roller, innsats og heder

Historiske roller, dokumenterte dugnadsutgaver, anslått fartstid, merkeforslag,
planlagt heder, gjennomført utdeling og utstedte diplomer er forskjellige ting.
Løpsdeltakelser dokumenterer aldri dugnadsinnsats. Hvert dokumentert dugnadsår
teller én gang. `confirmedYears` fylles ikke ut fra et startår.

- Fem grunnleggere er samlet: Oscar Lohne, Erling Askildsen, Einar Danielsen,
  Arnfinn Håverstad og Helge Reisvoll.
- Oscar og Erling har 35 dokumenterte utgaver (1992–2026), de to største kortene
  og æresmerket som hovedmerke. Faktisk utdeling er ikke registrert.
- Einar skal ifølge arrangørens beslutning få æresmerket i 2026. `plannedHonors`
  registrerer år og kilde, uten utdelingsdato. Grunnleggerrollen bevares; ingen
  dugnadsutgaver konstrueres. `founderSpotlightIds` gir et mellomstort kort,
  uavhengig av `featuredIds`, som fortsatt krever 35 dokumenterte utgaver.
- Dag har 13 dokumenterte dugnadsutgaver (2014–2026). Håkon har 12 (2014, 2015,
  2017–2026), med `excludedYears:[2016]`. Tidligere merknad om uavklart fravær
  er arkivert i `historicalNotes`; gjeldende opplysning er korrigert.
- Finn og Kalle er med fra minst 2014. Mellomliggende enkeltår er ikke bevist.
  Bent-Inge var med da arrangøransvaret ble overtatt i 2014; sluttåret 2019 er
  fortsatt et foreløpig beregningsgrunnlag, ikke en bekreftet årsrekke.
- Styreledervervene til Dag, Erling Askildsen og Nils Martin Otterdal Nilsen
  teller ikke som dugnadsår (`countsForTenure:false`). Ingen periode er lagt
  til de udaterte tilleggsrollene.
- Atle har bekreftet fravær i 2026. Birgitte har start 2022, Johannes 2021.
  Anne Lene og Laila har ukjent startår. Christan har bare oppgitt navn.
- Aud Ovesen, Arnfinn Grimestad og Magne Lia er registrert med fullstendige navn.

Rekkefølgen er grunnleggere, arrangører, dugnadshelter og til slutt minneomtalen.
Erling Danielsen, Floke Bredland og Leif Wiig har like store kort og samme
minnemerke. Erlings anslag på om lag 33 dugnadsutgaver er bevart som anslag.
Leif har dødsår 2023. Ukjente perioder og dødsår fylles ikke inn.

Dugnadslisten sorteres etter startår, ellers tidligste dokumenterte år, og
norsk alfabetisk rekkefølge. Ukjent startår kommer sist. `toYear` og
`excludedYears` begrenser anslag; bare faktiske arrangerte utgaver teller.
Tersklene 5, 10, 15, 20, 30 og 40 hentes fra `awardPolicy`.

Hovedpresentasjonen bruker korte beskrivelser. Anslag og kilder finnes under
«Bakgrunn og kilder». Et anslått merkenivå vises ikke som et bekreftet antall.
Ni aktive merketyper bruker det felles asset-registeret. Originalene og deres
kvalitetsstatus er uendret; eldre merkeforslag er bevart i historikken.

## Rene presentasjonsdiplomer

Alle 44 har et personlig diplom med «Vis diplom», «Skriv ut diplom» og
«Lagre som PDF». Det er ingen fri tekstboks for å lage nye mottakere.
For anslått fartstid er standarden «Takk for innsatsen», uten oppdiktede tall,
årsmerker eller datoer. Dokumenterte milepæler bruker terskelens historiske år,
ikke dagens samlede antall. Dag ved 10 viser 2023; Håkon ved 10 viser 2024.
Einar får æresdiplom uten et oppfunnet dugnadsantall eller utdelingsdato.

`presentationPrintSet` er et samlet, kildebelagt utskriftssett til V3.5.1-
gjennomgang. Det er **ikke** et tildelingsregister eller en godkjenning av
medaljene som formelt utstedte utmerkelser. Hvert av de 56 kontrollerte
person-/diplomvalgene er bundet til navn, innhold, faktiske bildefiler, vannmerke
og CSS med SHA-256. Disse presentasjonskopiene skrives ut uten «UTKAST».
Anonyme eksempler merkes «EKSEMPEL». Uten samsvarende kontrollsum brukes
«FORHÅNDSVISNING» på både skjerm og PDF. Et endret åpnet dokument sperres.

Kontrollsettet gjennomgås sammen med kodeendringen, uten individuell teknisk
administrasjon i nettleseren. Oppdatering er eksplisitt, aldri del av bygg:

```sh
npm run diplomer:kontroll
# Bare etter at endringene er gjennomgått: forbered et nytt kontrollsett.
npm run diplomer:klargjor
```

`canPresent()` avviser rene årsmerkediplomer basert bare på anslag.
`checkServiceDraft()` kontrollerer fortsatt fonter, A4, avkutting, overlapp,
faktisk raster-DPI, transparente kanter, SVG-innhold og endrede/manglende filer.
Disse sperrene gjelder også rene presentasjonskopier. Kvalitetsvarsler beholdes
under «Bildekvalitet». `printReady`, `awards` og `issuedDiplomas` endres ikke.
`diplomaApprovals` for særskilt godkjent endelig bruk er fortsatt separat og tomt.

Siden har foreløpig ingen innlogging. Alle som kjenner URL-en kan skrive ut de
registrerte presentasjonskopiene. Arrangøren har utsatt videre tilgangskontroll;
kontrollen nå ligger i det avgrensede, versjonerte utskriftssettet. Dette er
ikke en innlogget eller beskyttet tjeneste for formell diplomutstedelse.

## Regenerering og visuell kontroll

```sh
node scripts/review-honors-v35.cjs /tmp/morothon-v351
npm test
npm run build
```

Kontrollgalleriet inneholder mobil/PC-bilder, personregister, A4-PDF/PNG,
`pdfinfo`, `pdffonts`, `pdfimages` og layoutmålinger. Store kontrollfiler legges
ikke i produksjonsgrenen. Ordinære løperdiplomer, løpshistorikk og de godkjente
medaljeoriginalene er uendret. Se også [diplomteknikk](diplomas.md).
