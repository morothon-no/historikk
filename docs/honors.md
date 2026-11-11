# Menneskene bak Morothon – V3.5

Hederssiden er en skjult forhåndsvisning med `noindex, nofollow`, uten lenker i
hovedmeny, mobilmeny eller ordinære løperprofiler. Direkte URL er offentlig,
ikke tilgangsbeskyttet. Ingen automatisk tildeling eller offentlig diplomutstedelse.

## Ett hovedmerke

`MorothonHonorsData.mainBadge(data, member, editionYears)` brukes på kort,
profiler, diplomvalg og i personrapporten. Prioriteten er:

1. Et eksplisitt kildebelagt minneforslag: For alltid en del av Morothon.
2. Et eksplisitt forslag om Morothons æresmerke.
3. Grunnlegger for øvrige bekreftede historiske grunnleggere.
4. Høyeste kvalifiserte dugnadsnivå basert på dokumenterte år eller et tydelig anslag.

Kort og profiler viser høyst ett medaljebilde. Tidligere milepæler og rollen
som grunnlegger omtales som tekst, ikke en sekundær medaljesamling.
Ukjent eller utilstrekkelig grunnlag gir ingen medalje; personen beholdes.

Ni merketyper er aktive: Ivrig hjelper (5), Dugnadshelt (10), Trofast ildsjel
(15), Bærebjelke (20), Fredet inventar (30), Morothon-legende (40), Grunnlegger,
Morothons æresmerke og minnemerket. Alle er `design-draft` og `printReady:false`.

Hedersildsjel (`service-hedersildsjel`) og det gamle generelle Dugnadshelt-merket
(`service-dugnadshelt`) er **utgått fra aktiv bruk**, galleri og nye diplomvalg.
Originalfilene og register-ID-ene er beholdt for historisk kompatibilitet.
Gamle forslag ligger uendret i `previousBadgeProposals`; eksisterende `awards`
og `issuedDiplomas` slettes aldri. Ingen nye tildelinger er registrert.

## Kilder, roller og fartstid

`data/honors.json` inneholder de omfattende profilene. Vanlige dugnadsnavn
vedlikeholdes i `data/volunteers.json`. Én kanonisk ID beholdes per person;
`profileId` viser til en eksisterende profil og lager ikke en ny oppføring.
Det er 44 unike personer: 13 i hedersmodellen og 31 i navnelisten.

Fem grunnleggere er samlet: Erling Askildsen, Oscar Lohne, Arnfinn Håverstad,
Helge Reisvoll og Einar Danielsen. Oscar og Erling Askildsen har 35 dokumenterte
utgaver (1992–2026) og æresmerket som forslag. De tre øvrige har Grunnlegger,
uten å få anslått 35 dugnadsutgaver på grunnlag av grunnleggerrollen.

Dag Morten Frantzen, Håkon Lohne, Finn Lohne og Kalle Kimestad har registrert
start i 2014 og foreløpig 10-årsnivå ut fra 13 mulige utgaver til og med 2026.
Finn og Kalle er bekreftet fra minst 2014; mellomliggende enkeltår er ikke bevist.
Håkon vises som «Løpsleder Morothon», uten et oppfunnet startår for akkurat
løpslederrollen. Hans arrangørhistorie fra 2014 og Svalbard-oppholdet i 2016 bevares.

Bent-Inge Bakke beholder sin rolle ved overtakelsen i 2014. Beregningen avgrenses
til 2014–2019, seks mulige utgaver og foreløpig 5-årsnivå. `toYearStatus:provisional`
gjør det tydelig at sluttåret er foreløpig. Ingen årsrekke konstrueres.

Nils Martin Otterdal Nilsens rolle som styreleder i Søgne Skiklubb er registrert
som ekstern rolle (`roleType:external`, normalisert til `countsForTenure:false`).
Den gir verken dugnadsår eller automatisk medalje.

Atle Aamodt har start 2021 og `excludedYears:[2026]`. Birgitte Aamodt har start
2022, Johannes Aamodt 2021. Anne Lene Førland-Hansen og Laila Endresen Skjulestad
har fortsatt ukjent startår. Ukjente oppgaver, år og løper-ID-er gjettes ikke.
Kalle/Karl Kimestad er fortsatt én person med stabile profillenker. Erling
Danielsen og grunnlegger Einar Danielsen er forskjellige personer.

## Minneseksjon

Erling Danielsen, Floke Bredland og Leif Wiig har samme minnemerke som eneste
hovedmerke, etter eksplisitt forslag i V3.5. Seksjonen ligger etter grunnleggerne,
og Erling Danielsen har en større boks øverst. Han er ikke registrert som grunnlegger.

Erling Danielsens start i 1992 bevares; om lag 33 utgaver er et arrangøranslag,
ikke 33 bekreftede år eller et beregnet sluttår. Floke og Leif har anslag om
minst 25 **års innsats**, uten konstruerte start-/sluttår. Floke døde i 2024,
Leif i 2023; Erling Danielsens dødsår er ikke oppgitt og fylles ikke inn.
`serviceEstimate` lagrer verdi, enhet (`editions` eller `years`), forbehold og kilde.
Det holdes adskilt fra `contribution.confirmedYears`.

## Beregning og vedlikehold

Se [fartstid og foreløpige dugnadsmerker](dugnadsmerker-fartstid.md).
`contribution()` teller bare dokumenterte dugnadsår; `provisionalMilestone()`
beregner visningsanslag separat. `arrangedYears()` finner gjennomførte utgaver
fra resultater og teller ikke bare kalenderoppføringer, påmeldte eller DNS.
Startår, valgfritt sluttår og eksplisitte fravær påvirker anslaget. `confirmedYears`
fylles aldri med antatte mellomår. `diplomaChoices()` tilbyr bare aktive nivåer
med tilstrekkelig grunnlag, uten å endre tildelingsregisteret.

Dugnadsheltene sorteres etter eldste registrerte startår og norsk alfabet;
ukjente startår ligger sist. Minneseksjon og grunnleggerrekkefølge sorteres ikke om.
Eksisterende kildehenvisninger, historiske forbehold, navnekorrigeringer og
koblinger til løperprofiler beholdes. Løpsstarter blir aldri dugnadsutgaver.

## Diplomer og kontrollartefakter

Alle hedersdiplomer er forhåndsvisninger med `previewOnly:true`, `imageReady:false`,
uten utskrifts-/PDF-knapper og uten `allow-modals` i iframe. Minnediplomet sier
«TIL MINNE OM», aldri at diplomet er overlevert mottakeren. Historiske milepæler
bruker dokumentert oppnåelsesår; anslag og minneomtaler får ingen oppdiktet dato.
Vanlige løperdiplomer, 2018-datoen 11. november og alle løpsresultater er uendret.

```sh
node scripts/review-honors-v35.cjs /tmp/morothon-v35
npm test
npm run build
```

Skriptet lager faktiske PC-/mobilbilder, seksjonsbilder, minnemerke, A4-prøver,
målinger og en tabell over alle 44 personer. QA-filer legges utenfor repositoryet.
GitHub Actions legger dem i PR-artefaktet `morothon-v35-forhaandsvisning`, beholdt
14 dager. De inngår ikke i Pages-bygget. Merkegodkjenning, fysisk prøvetrykk og
formell utdeling er separate vurderinger; ingen godkjenning utledes fra grønne tester.
