# Menneskene bak Morothon – V3.4

`heder.html` er fortsatt en skjult, direkte tilgjengelig forhåndsvisning med
`noindex, nofollow`. Det er ikke tilgangsbeskyttelse. Ingen lenke er lagt til i
hovednavigasjon, mobilmeny eller ordinære løperprofiler. Kampanjeideen i issue #7
inngår ikke. Offentlig lansering og aktivering av diplomer krever egen godkjenning.

## Kilder og personer

Hele GitHub issue #11 og alle seks kommentarer er lest sammen med arrangørens
V3.4-bestilling. `organizer-v34` i `data/honors.json` viser til dette grunnlaget.
Artikkelopplysninger fra Fædrelandsvennen og N247 beholder sine opprinnelige
kildehenvisninger og forbehold; ingen nye artikkelopplysninger er lagt til.

34 kanoniske hederspersoner vises én gang hver i oversikten. Oscar Lohne og
Erling Askildsen har de to fremhevede kortene, og gjentas ikke som egne kort i
grunnleggergruppen. Den gruppen viser Arnfinn Håverstad, Helge Reisvoll og Einar
Danielsen; alle fem inngår fortsatt i grunnleggerkohorten og dens løpsberegninger.
Dag Morten Frantzen, Håkon Lohne og Bent Bakke vises under arrangørhistorien.
Øvrige dugnadsnavn vises kompakt, og Erling Danielsen/Floke Bredland har en egen,
diskret «Til minne om»-omtale.

- Karl Kimestad er et eksplisitt navnealias for Kalle Kimestad. Én oppføring,
  ett søketreff og én kanonisk profil. `#person/karl-kimestad` peker videre til
  den stabile profilen `#person/kalle-kimestad`. Løpernavn/-ID-er er ikke endret.
- Nils Henning Pedersen og Nils Martin Otterdal Nilsen er separate personer.
  Jenny Åmodt og Johannes Aamodt er separate oppføringer. Arnfinn G er ikke
  koblet til grunnlegger Arnfinn Håverstad.
- Aud O, Arnfinn G og Magne beholdes som ufullstendige navn. Ole J.Bueklev
  beholdes slik navnet er oppgitt. Ukjente år og oppgaver utelates i den
  vanlige presentasjonen og forklares under «Bakgrunn og kilder».
- Lars Aamodt er en egen person uten oppgitt startår/oppgave. Laila Endresen
  Skjulestad har bidratt på drikkestasjon sammen med Anne Lene Førland-Hansen.
  Laila har ingen oppgitt startdato; Annes 2014-år overføres ikke til henne.
  De to nye oppføringene har ingen automatisk medalje eller diplom.
- Håkons Svalbard-opphold er årfestet til 2016. Det utledes ikke konkrete
  oppgaver eller fravær fra løpet dette året.
- Erling Danielsen bidro fra 1992 til han gikk bort; dødsåret er ikke oppgitt.
  Floke gikk bort i 2024. Mulig sluttår 2017 og sprikende opplysninger om
  startåret beholdes som kildeforbehold, ikke som sikre offentlige datoer.
- 128 deltakere i 1992, datoen 11. november 2018 og alle historiske
  navnekorrigeringer er bevart. Ingen endring i `data/history.json`.

## Bakoverkompatibel modell og merkeforslag

`schemaVersion: 1`, `groups`, `members`, `memberRefs` og eksisterende profil-ID-er
beholdes. `contentVersion: "3.4"` aktiverer eksplisitte planer i stedet for å
arve gruppens dekorasjon som et personlig merkeforslag. Eldre navnelister uten
`contentVersion` kan fortsatt forhåndsvises fra `group.badgeId`.

Personpostene holder følgende opplysninger adskilt:

1. `roles` og `stories`: kildebelagte historiske opplysninger, med `confirmed`
   og `sourceIds`. `status` beholdes som legacy-status for oppføringen, ikke
   som bevis på at en formell medalje er utdelt.
2. `contribution`: bare eksplisitte, dokumenterte dugnadsår i `confirmedYears`.
   Et `fromYear` er ikke bevis på alle mellomliggende år. Oscar og Erling har
   eksplisitt innsats i de 35 utgavene 1992–2026; deres løpsstarter er et annet mål.
3. `badgeProposal`: `status: "proposed"`, liste over `badgeIds`, ett
   `primaryBadgeId` og kilder. Et tomt forslag gir verken medalje eller diplom.
4. `awards`: separate, formelle beslutninger med dato, kilde og godkjenning.
5. `issuedDiplomas`: egen utstedelsespost knyttet til en formell tildeling.

Alle `awards` og `issuedDiplomas` er tomme i denne leveransen. Ingen nye formelle
utmerkelser er tildelt. Modellen validerer kilder, aliaser, unike person-ID-er og
koblingen mellom tildeling og utstedt diplom. Fem dokumenterte dugnadsutgaver
kan gi et kvalifikasjonsgrunnlag; det oppretter aldri tildeling/diplom automatisk.
En særskilt beslutning kan gi unntak, men må ha egen bekreftelse og kilde.

De fem grunnleggerne har forslag om Grunnlegger og Dugnadshelt. Oscar/Erling har
Hedersildsjel som foreslått hovedmerke og de to andre som sekundære merker.
Kalle, Finn, Dag Morten og Håkon beholder tidligere merkeforslag. De nyere
navnene og Bent får ingen automatisk utmerkelse fra medlemskap eller startår.
Alle nevnes og takkes uavhengig av antall dugnadsår.

## Løpshistorikk og stabile lenker

Eksisterende eksplisitte `runnerId`-koblinger er uendret. Ingen nye koblinger
utledes fra navn, slekt eller liknende stavemåte. Uten sikker kobling skjules
hele løpsseksjonen. Bekreftede koblinger bruker samme lesende modell som før:
DNS/DNF, unike år, godkjente ID-omdirigeringer og separate grupper for
konkurranse, eksakt distanse og løypeperiode. Kildeplasseringer skilles fra
beregnede kjønn-/aldersklasseplasseringer. Løpsstarter er aldri dugnadsår.

De eksisterende åtte koblingene er Erling, Oscar, Arnfinn Håverstad, Helge
Reisvoll, Einar Danielsen, Kalle Kimestad, Finn Lohne og Håkon Lohne. Den gamle
ruten `helge-andersen` gir fortsatt en korrigeringsforklaring, uten automatisk
ny identitetskobling eller grunnleggermerke.

## Diplomutkast og trykksperre

`MorothonDiplomas.serviceDraft(personId, optionalBadgeId)` henter personens
merkeforslag og bruker ett hovedmerke og eventuelle mindre sekundærmerker.
`serviceExample(exampleId)` lager de fire representative modellene fra
`diplomaExamples`: fem dugnadsår, grunnlegger med flere merker, Oscar 35 og
Erling 35. De to siste er samme 35-utgaver-type med hver sin personlige tekst.

Femårseksemplet har ingen person-ID og er tydelig illustrativt. Det finnes ikke
et dokumentert nøyaktig femårsgrunnlag for en navngitt mottaker i bestillingen.
Ingen virkelig person er derfor gitt fem dugnadsår ved gjetting.

Alle service-modeller beholder `previewOnly: true` og `imageReady: false`, også
ved en formell tildelingspost i en testfixture. Ingen utskrifts-/PDF-knapper
finnes. Iframes har bare `allow-same-origin`, uten `allow-modals`; forhåndsvisningene
skjules ved vanlig sideutskrift. Dato fastsettes først ved en eventuell
utstedelse, ikke fra løpsdatoen. Håkon Lohnes navn er typografisk satt og skal
ikke omtales som en ekte håndskrevet signatur.

Den eksisterende liggende A4-malen, originalmedaljene, rammene, vannmerket og
signaturprinsippet beholdes. Bare service-malen får tilpassede rader og mindre
sekundærmerker. Vanlige merke-, rekord- og debutdiplomer er uendret, kontrollert
med eksisterende regresjonstester og identisk raster av Ingers sølvdiplom.
Layout- og kilde-/DPI-kontroller er beholdt; bestått A4-layout er ikke en
trykkgodkjenning av service-merkene, som fortsatt har registerstatus `design-draft`.

## Vedlikehold og kontroll

Nye navn legges til én gang i `groups[].members`, med stabil ID og kilde.
Bruk `memberRefs` ved flere roller, og bare eksplisitte `aliases`/`aliasIds`
ved bekreftet identitet. La `badgeProposal.badgeIds` være tom ved ukjent
merkefordeling. Utelat ukjente år/oppgaver; ikke bruk løpsresultater som bevis.

```sh
node --test tests/honors-v34.cjs
npm test
node scripts/review-honors-v34.cjs /tmp/morothon-v34 a7d03f7
```

QA-bilder og PDF-er er lokale, merket som ikke utdelt, og ligger utenfor den
publiserbare runtime-pakken. Reelle tildelinger, mottaker for femårsutkastet,
navneavklaringer og eventuelle senere utstedelsesdatoer må godkjennes særskilt.
