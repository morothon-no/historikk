# C2.3b – Fleksibel resultatimport med øvelse som inngang

Normalflyten er **last opp fil → automatisk analyse → gjennomgå avvik**.
Dette viderefører C2.3as avstemming og C2.2s rettingskontrakt. Det er fortsatt
ingen produksjonsimport, automatisk personkobling eller publisering.

## Slik bruker arrangøren løsningen

1. Åpne **Årets arrangement → Endelige resultater** og velg år.
2. Velg en CSV- eller TSV-fil. Filnavn og antall leste rader vises.
   Et entydig arrangementsår i en gjenkjent årskolonne foreslås automatisk.
3. Systemet tolker sikre felt og starter sammenligningen. Ved tvil vises
   bare den nødvendige avklaringen, med kolonnenavn og eksempler.
4. **Øvelse** er det sentrale valget. Når filen bare inneholder øvelsesnavnet,
   foreslås dokumentert løypelengde for det valgte året. Bekreft én gang per
   øvelse. Mangler årsspesifikt grunnlag, vises raden som «Kan ikke vurderes».
5. Gjennomgå endrede resultater og usikre koblinger. Uendrede registreringer
   krever ingen behandling. Manglende registreringer slettes aldri.
6. Bekreft, avvis eller utsett avvik, og bruk eksisterende konsekvensvisning
   og overlevering til **Rettelser og personkontroll**.

Kolonnekoblinger, kildeområde for eksterne ID-er, tegnsett, filhash og manuell
ny analyse ligger under **Avanserte valg**. Disse kreves ikke ved entydig fil.
Et komplett utvalg må fortsatt bekreftes uttrykkelig; linjetall beviser ikke
fullstendighet. Uavklarte eller manglende registreringer hindrer komplettstatus.

## Fire forskjellige trinn

| Trinn | Hva som faktisk er kontrollert |
| --- | --- |
| Filen er lest | Tekst, skilletegn og rader kan leses innen eksisterende grenser |
| Resultater tolket | Navn, øvelse, løypelengde og gyldig tid/status kan forstås |
| Resultatpar kontrollert | Historiske registreringer har støttende identitets- og resultatsignaler; usikkerhet beholdes |
| Din gjennomgang | Arrangørens uttrykkelige vurderinger kan klargjøres som forslag |

At et resultatpar finnes er ingen permanent bekreftelse av personidentitet.
Ingen nye runnerId-er, aliaser eller sammenslåinger opprettes. Entydig fullt
navn/alias sammen med samme år, øvelse og distanse kan støtte et resultatpar;
like navn på flere kanoniske profiler krever fremdeles manuelt valg.
Svake navnelikheter overstyrer ikke et entydig eksakt navnetreff, og kan aldri
overstyre et motstridende startnummer eller en dokumentert ekstern ID.

Visningen samler avvik i Uendret, Endret resultat, Mulig personkonflikt,
Ny registrering, Mangler i ny kilde og Kan ikke vurderes. Stafett vises separat.
Kontrollrapporten beholder forskjellen mellom identitetsusikkerhet,
kildekonflikt og ugyldige/ufullstendige rader.

## Støttede og testede varianter

- CSV/TSV med komma, semikolon eller tabulator, sitering og eksisterende `sep=`.
- UTF-8, UTF-16 med BOM og eksisterende Windows-1252-fallback.
- Vilkårlig kolonnerekkefølge og norske/engelske overskrifter, eksempelvis
  Navn/Name, Firstname + Surname, Race/Event/Øvelse, Distance/Distanse,
  Time/Result/Finish/Tid/Sluttid. Mellomrom og tegn normaliseres i overskrifter.
- Separate øvelses-/distansefelt, eller uttrykkelig kombinasjon som
  `Kortmoro 10 km`. `Distance: 10 km` kan kobles til en entydig dokumentert
  øvelse for året. Ukjente øvelsesnavn med oppgitt løypelengde beholdes med
  et forbehold og krever kontroll før overlevering.
- Kilometer og meter med enhet. Rene tall kan brukes når overskriften
  uttrykkelig angir km/m; ved enhetsløs `Distance` bes brukeren bekrefte
  enhet én gang. Motstridende/multiple løypelengder blir ikke gjettet.
- Gyldig sluttid eller status, blant annet DNS, DNF, DQ/Disket og eksplisitt
  fullført uten tid. Den eksisterende status- og tidsmotoren gjenbrukes.
  Ingen manglende tid/status konstrueres. Bare påmelding er ikke et resultat.
- Startnummer, klasse, kjønn, klubb, plassering, år og identifikatorer er
  valgfrie. Utelatte metadata bevarer eksisterende verdier.
- Eksplisitt historisk «Deltatt» med distanse «Ukjent» bevares uten å finne
  på en løypelengde. Likeverdige distanseformater gir ingen omskriving av
  historiske felt når et annet felt, for eksempel tiden, korrigeres.

Overskrifter undersøkes først, deretter verdiinnhold. Ukjent tekstkolonne
med plausible navn gir et forslag som må bekreftes; klubbtekst kan også
ligne navn. Ukjent kolonne med tider gir et bekreftelsesvalg, siden tallene
kan være annen tidtaking. Starttid, passering/split og plassering blir ikke
automatisk oppfattet som sluttid. Flere plausible kolonner krever valg.
Feil i enkeltceller blir synlige, sperrede avvik selv om filen kan leses.

**En reell EQtiming-resultateksport er fortsatt ikke formatverifisert.**
454-scenariet bruker bare dokumenterte overskriftsposisjoner fra skjermbildet:
Rank 1, Firstname 3, Surname 4, Gender 5, Club 7, Race 8 og Class 9.
Øvrige kolonner og alle navn, ID-er og verdier er uttrykkelig syntetiske.
Dette er ingen påstand om et faktisk EQ-filformat. Reell fil må kontrolleres
privat uten å legges i Git, Issues, logger eller offentlige kontrollbilder.

XLSX og resultat-XML støttes ikke i denne leveransen. Startliste-XML bruker
fortsatt den separate C2.1a-flyten. Spesielle millisekund-/resultatkonvensjoner
uten støtte i dagens tidsmotor må avklares, ikke tolkes som gyldige automatisk.

## Årsspesifikk øvelsesprofil og adaptergrense

`Results.parse()` velger en avgrenset leser. Dagens adapter er
`delimited-text-v1`, som gjenbruker den strenge CSV/TSV-parseren og dekoderen.
Den leverer overskrifter, rader med kilde-linjenummer og celler.
`detectFields()` og `inspect()` tolker dette tabellgrunnlaget før
`createSession()` og den eksisterende `review()` sammenligner resultatene.

Nye adaptere for XLSX/XML skal senere levere samme tabellgrense med egne
format-/størrelses-/sikkerhetskontroller. De skal ikke skrive direkte til
historikk eller omgå valideringen. Sammenligningsmotoren og C2.2-pakken kan
gjenbrukes; ingen ny backend eller avhengighet er innført nå.

Den dokumenterte årsprofilen avledes i denne leveransen fra **godkjent
historikk for det valgte året**, gjennom `annualCourses()`. Arrangementsprofilens
øvelsesnavn brukes som aliaser; moderne standardlengder brukes aldri til å
fylle historiske hull. Flere dokumenterte lengder for samme øvelse krever
eksplisitt valg. Ny årgang uten dokumentert løypelengde får ingen automatisk
lengde fra et tidligere år. En framtidig eksplisitt årsprofil må ha tilsvarende
kilde-/versjonskontroll før den kan erstatte dette grunnlaget.

En bekreftet gruppekobling registreres i normaliserte raders `inference` med
år, øvelse og distanse. Både mapping og radgrunnlag inngår i tolkningshashen,
sammen med filhash og godkjent historikk. Endret fil, år, mapping eller
gruppekobling krever ny vurdering. Allerede overførte forslag fra endret kilde
settes tilbake til kontroll, mens uavhengige manuelle saker beholdes.

## Kvalitetskontroll og bevaring

Testene bruker bare syntetiske navn og filer under `tests/public/`.
De dekker 454 rader, manglende resultat, historiske 8/9/9,5 km kontra moderne
10 km, samlede øvelsesvalg, eksplisitt enhet, ulike tegnsett/skilletegn,
tvillingnavn, aliaser/redirects, DNS/DNF/DQ, nøyaktig gjenimport og de to
forvekslede tids-/øvelsesregistreringene fra C2.3a. Sistnevnte gir fortsatt
to resultatpar og fire endrede felt, uten nye personer eller duplikatrader.

Nettlesertestene bruker statisk `/historikk/admin/` på 1440, 768 og 390 px.
De kontrollerer automatisk analyse, nødvendige avklaringer, manglende data,
beslutninger, faktisk konsekvensanalyse, nedlasting, C2.2-overlevering og
startlisteflyten. Kun lokale filvalg og GET mot testorigin tillates.

Kontrollbilder genereres under eksisterende artefakt
`morothon-c1-diplomverksted`, undermappe `results-c23a/`:
`c23b-automatisk-{1440,768,390}.png`, `c23b-ovelser-{1440,768,390}.png`,
og eksisterende sammenlignings-/konsekvensbilder. De inneholder syntetiske data
og sjekkes ikke inn som store binærfiler.

Historikk, administrative kilder, offentlige datapakker, godkjente medaljer,
Heder, diplomdesign, workflows og publiseringssperrer endres ikke.
Grensene 4 MB / 5 000 rader / 80 kolonner, 200 tegn per resultatfelt,
500 saker / 2 MB i rettingspakken og 8 MB i kontrollrapporten beholdes.
Ingen automatisk sletting, formell tildeling eller diplomgodkjenning innføres.

### Utført leveransekontroll

| Kontroll | Resultat |
| --- | --- |
| Hele offentlige hurtignivået i isolert kopi | 96/96 bestått |
| C2.1/a, C2.2/a, C2.3a/b og C1 nettleser-/PDF-regresjon i isolert kopi | 27/27 bestått |
| Offentlige funksjonsregresjoner: datakvalitet, rekorder, stafett, milepæler og tidligere navneretting | 9/9 bestått |
| Ny dekning | 11 modelltester og to nye nettleserflyter; tidligere assertions beholdt/tilpasset automatisk analyse |
| Produksjonsbygg og separat offentlig pakkekontroll | 74 filer / 15 adminfiler, 43 synlige Heder-profiler, datarevisjon 2 |
| Administrative kilder mot godkjent eksport | `matches-approved`, uendret |
| Mobil/nettbrett/PC | 390/768/1440 px; kontrollbilder gjennomgått, ingen nye konsollfeil eller horisontal overflow |
| Eksisterende diplommotor | Samlet PDF med seks A4-sider for fem syntetiske mottakere, begge merkevisninger, innebygde fonter og stopp ved siste-sidefeil |

Dette er **132 forskjellige tester**. Gjentatte delkjøringer er ikke lagt til
tallet. Hurtignivået og de 27 admin-/PDF-testene ble kjørt på nytt etter siste
rettelse for historisk ukjent distanse og likeverdige råformater. De ni offentlige
funksjonsregresjonene bruker uendrede offentlige moduler/data og ble kjørt før
den siste avgrensede parserrettelsen.

Ingen administrativ originalfil er tilgjengelig i den isolerte testkopien.
Ingen data, medaljer, designfiler, workflows eller sikkerhetspolicyer er endret.
Full lokal `npm test` og historiske diplomgallerier er ikke kjørt på nytt;
obligatorisk ekstern CI må fortsatt bestå før merge. GitHub Actions-status og
artefaktlenker må bekreftes eksternt dersom GitHub-API-et fortsatt blokkeres.
Lokale grønne tester er ingen bekreftelse på ekstern CI eller ekte EQ-format.
