# Menneskene bak Morothon

`heder.html` er en offentlig side via direkte URL, skjult fra hovedmenyen og
mobilmenyen, med `noindex, nofollow`. Dette er ikke tilgangsbeskyttelse.
Siden viser 44 unike personer: 13 hedersprofiler og 31 oppføringer fra den
enkle `data/volunteers.json`. Eksisterende ID-er, aliaser og løperlenker bevares.

## Roller, innsats og heder

Historiske roller, registrerte dugnadsutgaver, kildeforbehold, merkeforslag,
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
minnemerke. Erling var med på dugnad fra 1992 og bidro gjennom mange år, uten
et oppgitt totalantall. Minneprofiler uten kjent sluttår telles ikke
frem til siste arrangement. Registrert startår bevares, men et sluttår blir
aldri gjettet. Dokumenterte enkeltår eller arrangørgodkjent samlet antall kan
fortsatt brukes. Einar Danielsen har 33 arrangørgodkjente
dugnadsutgaver, uten konstruerte enkeltår eller milepælsdatoer.
Leif har dødsår 2023. Ukjente perioder og dødsår fylles ikke inn.

Dugnadslisten sorteres etter startår, ellers tidligste dokumenterte år, og
norsk alfabetisk rekkefølge. Ukjent startår kommer sist. `toYear` og
`excludedYears` begrenser perioden; bare faktiske arrangerte utgaver teller.
Tersklene 5, 10, 15, 20, 30 og 40 hentes fra `awardPolicy`.

## Gjeldende beregningsmodell – V3.5.2

`serviceTenure()` i `js/honors-data.js` brukes av kort, profiler, diplomvalg,
PDF-er, rapport og beregnede merkeår. Prioritet:

1. `confirmedYears`, også en eksplisitt tom liste, er fasit.
2. `approvedTotal: {editions, approved:true, asOfYear, sourceIds}` er et
   arrangørgodkjent samlet antall, uten syntetiske enkeltår.
3. Registrert `contribution.fromYear`–`toYear`, eller siste arrangerte år fra
   løpshistorikken. Bare arrangerte utgaver telles; `excludedYears` trekkes fra.
   Minneprofiler uten sluttår unntas fra automatisk periodeopptelling.
4. Uten tilstrekkelig grunnlag vises ingen dugnadssum eller årsmerker.

Startår i en ekstern rolle gir ikke dugnadsutgaver. Kildehistorikk og tidligere
usikkerheter bevares internt; en registrert periode presenteres nå som gjeldende
beregningsgrunnlag. Manglende sluttår er ikke en bekreftet biografisk opplysning
om aktivitet i siste år. Endrede kilder må revideres av arrangøren.

Alle kvalifiserte terskler 5, 10, 15, 20, 30 og 40 beholdes kumulativt.
Æresmerke/minnemerke er hovedmotiv foran vanlige dugnadsmerker. Grunnlegger
presenteres separat for alle fem, uten å bli et dugnadsnivå. Hovedbildet
forekommer aldri også i medaljesamlingen. Alle bilder hentes fra felles register;
originaler og kvalitetsstatus er uendret.

## Rene presentasjonsdiplomer

Alle 44 har et personlig diplom med «Vis diplom», «Skriv ut diplom» og
«Lagre som PDF». Det er ingen fri tekstboks for å lage nye mottakere.
Standarddiplomet bruker personens samlede registrerte dugnadsutgaver. Dag har
13, Håkon 12; begge får Dugnadshelt som hovedmerke og Ivrig hjelper som mindre
merke. Hovedmerkets opptjeningsår beregnes separat: 2023 for Dag og 2024 for
Håkon. Det er ikke en kopi av reglene for historiske løperdiplomer, som er uendret.

Oscar og Erling Askildsen har 35 utgaver og Einar 33. Deres diplomer kombinerer
æresmerket (55 mm), en separat grunnleggermarkør (24 mm) og fem mindre
opptjente dugnadsmerker (20,5 mm). Einar får ikke oppdiktede milepælsdatoer.
Arnfinn og Helge har grunnleggermerket som hovedmotiv, uten dobbeltvisning og
uten oppfunnet dugnadsantall. Personer uten kjent fartstid får «Takk for innsatsen».

`presentationPrintSet` er et samlet, kildebelagt utskriftssett til V3.5.2-
gjennomgang. Det er **ikke** et tildelingsregister eller en godkjenning av
medaljene som formelt utstedte utmerkelser. Hvert av de 88 kontrollerte
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

`canPresent()` følger samme registrerte beregning som personkortene.
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
node scripts/review-honors-v352.cjs /tmp/morothon-v352
npm test
npm run build
```

Kontrollgalleriet inneholder mobil/PC-bilder, personregister, A4-PDF/PNG,
`pdfinfo`, `pdffonts`, `pdfimages` og layoutmålinger. Store kontrollfiler legges
ikke i produksjonsgrenen. Ordinære løperdiplomer, løpshistorikk og de godkjente
medaljeoriginalene er uendret. Se også [diplomteknikk](diplomas.md).

Gjeldende revisjonsgrunnlag: [alle 44 personer](v352-personregister.md).

## Diplomets medaljevisning

Personlige diplomer bruker alltid profilens høyeste hovedutmerkelse. Et lavere
merke kan ikke velges som hovedmotiv. «Alle merker» viser tidligere opptjente
dugnadsmerker i mindre størrelse; «Kun siste merke» skjuler denne rekken.
Æresmerket forblir størst, med separat grunnleggermarkør i begge varianter.
Profilens fulle merkesamling påvirkes ikke av diplomvalget.

De 88 kontrollerte oppsettene er 44 personer × to visninger. `medalDisplay`
er `all` eller `latest`, inngår i den kontrollerte HTML-en og har egen
kontrollsum og registeroppføring. Variantbytte kontrolleres på nytt før begge
utskriftsknappene aktiveres. Lavere personlige hovedmerker avvises også av API-et.

## Hele merkesamlingen på oversiktskortene

Kortene bruker `honorProfile()` fra samme beregningsgrunnlag som detaljprofilen.
Hovedutmerkelsen vises størst. Historisk/særskilt heder og øvrige opptjente
dugnadsmerker vises i en egen, mindre samling under kortets hovedfelt. Samme
merke vises aldri to ganger. Personer uten flere merker beholder det kompakte
formatet; navnelisten får ingen nye biografiske tekster.

CSS Grid tilpasser medaljerekken til kortbredden. Hovedmerke og historisk heder
beholder størrelseshierarkiet på mobil og PC. Diplomvalget påvirker bare
diplomet: kort og detaljprofil beholder alltid hele samlingen.

Kontrollgalleriet inneholder egne kortbilder på 390 og 1440 px for Oscar Lohne,
Erling Askildsen, Einar Danielsen, Dag Morten Frantzen og Finn Lohne, samt de tre
æresdiplomene. Testene kontrollerer alle 44 kort ved 320/390/768/1440 px.

## V3.6 – felles redigering av persontekster

Korttekst, lange historier, personlige ærestekster og uttrykkelig bekreftede
løperkoblinger vedlikeholdes nå for alle 44 i `data/honors.json.personDetails`.
Se [redigeringsveiledning og datoforklaring](personregister-v36.md). De gamle
kildepostene og deres identiteter beholdes. Nye personlige ærestekster må
fortsatt godkjennes; forslagene er foreløpig bare dokumentasjon/kontroll-PDF-er.
