# C2.5 – Samlet gjennomgang av årsresultater (første leveranse)

Dette er en **lokal godkjenning av rettingsforslag**, ikke en erstatning for en sikker
publiserings- eller lagringsprosess. GitHub Pages er fremdeles skrivebeskyttet.

## Arrangørens arbeidsflyt

1. Last opp endelig årsresultat i *Endelige resultater* og kontroller år, kolonner
   og kildeomfang. Merk av «Eksporten omfatter alle individuelle øvelser» **bare
   dersom dette faktisk er bekreftet**.
2. Når filen bare har sikre endringer i sluttid og/eller kildeplassering, viser
   kontrollen én samlet oversikt over **endrede sluttider**, **rene
   plasseringsendringer** og **antall berørte resultater**.
3. Trykk «Godkjenn X sikre endringer samlet» og bekreft den viste summeringen.
   Beslutningene blir journalført enkeltvis med samme kildehash og tolkning,
   men krever ikke ett klikk per resultat.
4. Last ned resultatkontroll/arbeidsgrunnlag, eller overfør rettingspakken til
   kontrollsentralen for videre konsekvensvurdering. **Ingen resultatdata
   skrives til `history.json` eller publiseres.**

## Vilkår for samlet godkjenning

- Eksporten må være eksplisitt merket komplett og inneholde sluttid og
  kildeplassering fra riktig løp.
- Ingen manglende historiske rader, nye personer, identitetskonflikter,
  motstridende kildedata eller uavklarte resultatregistreringer.
- Alle berørte resultater må være entydig koblet til samme registrerte
  startnummer og person, i samme arrangementsår.
- Alle endringer som bekreftes samlet må **kun** gjelde sluttid eller
  kildeplassering. Distanse, konkurranse, klasse, status, klubb,
  personkobling og nye starter behandles fortsatt enkeltvis.
- For hver fullførte individuelle start med tid kontrolleres
  kildeplassering mot beregnet **kjønn + øvelse + distanse**, ikke
  aldersklasse. Delt plassering beregnes med konkurranserang (1, 2, 2, 4).
  Dette fanger feilaktig kobling til EQtimings `Rank Class`.
- DNS/DNF gir ikke plassering og teller ikke inn i denne kontrollen. Stafett
  blir fortsatt holdt adskilt fra individuelle resultater.

Selv om et resultatark virker komplett, utgjør brukerens avkrysning ikke
en attestasjon fra leverandøren. Derfor lagres bare beslutninger som lokalt
arbeidsgrunnlag. Neste C2.5-leveranse må gi én **aggregert** konsekvensanalyse
og effektiv, sikker publisering/PR-overlevering etter godkjent autentisering,
backup og ekstern kildekontroll. Et hundretalls rettinger skal ikke kreve
hundretalls kostbare helsideanalyser.

## Avgrensning og tester

Testene bruker bare oppdiktede deltakernavn. De verifiserer to korrigerte
tider som forskyver andre plasseringer, opptelling, kildebinding og at
historikken er uendret; de prøver også ufullstendig eksport, klassebasert
rangering, motstridende kjønn og andre kildeavvik.

Ingen nye produksjonsnøkler, API-endepunkter, `history.json`-endringer,
automatiske merges eller publiseringsrettigheter inngår.
