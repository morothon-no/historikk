# Morothon V3.6.2 – historisk riktige dugnadsdiplomer

Utgangspunkt: main `09173da` (merge av PR #23). Arbeidsgren:
`codex/morothon-v3-6-2-dugnadsdiplomer`.

## Rettelse og avgrensning

Vanlige dugnadsdiplomer med kjent opptjeningsår viser merketerskelen som
hovedtall og perioden fra første dugnadsutgave til utgaven som utløste merket.
Datoen var allerede knyttet til riktig milepæl og er uendret. Standardteksten
hentes fortsatt fra det valgte merkenivået. Begge medaljevalg beholdes.

Jon Fjelds 10-utgaversdiplom viser nå **10**, **2014–2023** og
**Søgne, 11. november 2023**. Personkortet og hedersprofilen viser fortsatt
hans aktuelle total på 13 utgaver. Ingen registrerte dugnadsår er endret.

Arrangørgodkjente totaler uten enkeltår beholder bekreftet total og får ingen
oppdiktet periode, oppnåelsesår eller dato. Dette gjelder blant annet Erling
Danielsen med 33 utgaver. Æresmerker, grunnleggermerker, minnediplomer og
personlige takkediplomer følger sin eksisterende logikk. Einars Æresdiplom,
inkludert minneformulering, personlig tekst og utdelingsdato 7. november 2026,
er bevart og kontrollert som pikselidentisk i begge varianter.

Personregister, historikk, medaljefiler, CSS, hederssidens HTML/profilkode og
arrangementsdatoregister er byteidentiske med main. Ingen formelle tildelinger
eller utstedelser registreres. Endringen i produktkoden gjelder kun
`serviceContent()` i `js/diplomas.js`.

## Berørte ordinære diplomer

Beregnet ved sammenligning av alle 44 personer × to varianter med faktisk
før-/etter-kode fra main og arbeidsgrenen. 12 personer / 24 varianter endres;
øvrige 64 varianter har identisk innholdsfingeravtrykk.

| Person | Før: antall og periode | Etter: antall og periode | Dato (uendret) |
| --- | --- | --- | --- |
| Kalle Kimestad | 13 · 2014–2026 | 10 · 2014–2023 | Søgne, 11. november 2023 |
| Finn Lohne | 13 · 2014–2026 | 10 · 2014–2023 | Søgne, 11. november 2023 |
| Dag Morten Frantzen | 13 · 2014–2026 | 10 · 2014–2023 | Søgne, 11. november 2023 |
| Håkon Lohne | 12 · 2014–2026 | 10 · 2014–2024 | Søgne, 9. november 2024 |
| Jon Fjeld | 13 · 2014–2026 | 10 · 2014–2023 | Søgne, 11. november 2023 |
| Rune Bergjord | 12 · 2015–2026 | 10 · 2015–2024 | Søgne, 9. november 2024 |
| Per Sangvik | 8 · 2019–2026 | 5 · 2019–2023 | Søgne, 11. november 2023 |
| Tom Lohne | 6 · 2021–2026 | 5 · 2021–2025 | Søgne, 8. november 2025 |
| Anne Lene Førland-Hansen | 11 · 2016–2026 | 10 · 2016–2025 | Søgne, 8. november 2025 |
| Johannes Aamodt | 6 · 2021–2026 | 5 · 2021–2025 | Søgne, 8. november 2025 |
| Laila Endresen Skjulestad | 11 · 2016–2026 | 10 · 2016–2025 | Søgne, 8. november 2025 |
| Bent-Inge Bakke | 6 · 2014–2019 | 5 · 2014–2018 | Søgne, 11. november 2018 |

## Godkjenninger og kvalitetskontroll

Det eksisterende godkjenningsregisteret er ikke skrevet om. Endrede
innholdsfingeravtrykk gir automatisk **FORHÅNDSVISNING**, også i PDF/utskrift.
60 tidligere kontrollerte varianter forblir uendret og beholder sin godkjenning.
20 tidligere kontrollerte varianter krever ny gjennomgang. De åtte eksisterende
forhåndsvisningene beholdes; fire av disse (Anne Lene og Laila) påvirkes også
av tallrettelsen. Det er dermed 28 ventende varianter totalt, ikke 32.

`diplomer:kontroll` gjenkjenner bare denne konkrete overgangen: setter man
tilbake akkurat hovedtallet og perioden til tidligere totalsum, må det gamle
kontrollerte fingeravtrykket gjenskapes nøyaktig. Urelaterte endringer i tekst,
dato, grafikk, font eller stilark godtas ikke som denne migreringen. De gamle
kontrollsummene beholdes som revisjonsspor; ingen nye godkjenninger opprettes.
Skriving med `diplomer:klargjor` avvises så lenge gjennomganger gjenstår.
Regresjonstesten endrer en diplomtekst i en isolert prosjektkopi og kontrollerer
at denne avvises, samtidig som den virkelige registerfilen forblir uendret.

## Kjøring og visuell dokumentasjon

```sh
npm test
npm run diplomer:kontroll
npm run build -- /tmp/morothon-v362-site
node scripts/review-service-milestones-v362.cjs /tmp/morothon-v362
```

Byggemappen må være tom. Åpne `index.html` i kontrollmappen. Galleriet inneholder
faktiske før-/etter-bilder og liggende A4-PDF-er av Jon, begge medaljevalg,
samt kontroll av Einars uendrede Æresdiplom. Mobil- og PC-forhåndsvisningene
kontrolleres ved 390 og 1440 px, med uendret profiltotal og uten sideveis overflyt.
Alle 88 gjeldende varianter kontrolleres av diplominspektøren. Forhåndsvisnings-
filer ligger utenfor git og produksjonspakken. GitHub Actions genererer
`morothon-v362-dugnadsdiplomer` for PR-gjennomgangen.

Nye tester dekker Jon, alle seks merkenivåer, dokumenterte opphold/fraværsår,
2018-datoen, fremtidige år uten eksakt arrangementsdato, godkjente totaler uten
årsrekke, bevaring av særskilte diplomer og reelle godkjenningssperrer.
Eksisterende tester er oppdatert der de forventet dagens totalsum eller ren
utskrift av det nå endrede innholdet. Sikkerhetskontroller for godkjent innhold,
font, feil variant, overflyt og endret grafikk beholdes.

Utført kontroll:

- `npm test`: **212 av 212 bestått**, ingen feil, avbrutte eller hoppede tester.
- `npm run diplomer:kontroll`: bestått, 44 personer / 88 varianter, ingen skriving.
- `npm run build -- /workspace/review/morothon-v362-site`: bestått, 58 filer,
  innholdsversjon `df1532f38fef03ba`. Også den bygde siden viser Jon korrekt
  ved 390 og 1440 px.
- V3.6.2-galleri: åtte énsides liggende A4-PDF-er, begge medaljevalg,
  ingen layoutfeil. PDF-en har innebygd Caveat-font.
- Eksisterende V3.6.1-profil-/diplomsammenligning: 28 A4-PDF-er og profilene
  ved 390/768/1280/1440 px, ingen feil.
- Eksisterende V3.6.1-sluttkontroll: 16 profilvisninger og åtte A4-PDF-er,
  ingen feil.
- Eksisterende V3.5.3-dato-/signaturkontroll: seks A4-PDF-er, ingen feil.

Disse kontrollene er gjort i lokal Chromium. GitHub Actions-status kan først
bekreftes når PR-en er opprettet og kjøringen er fullført.

## Endrede filer

- `js/diplomas.js`: historiske antall/periode på ordinære dugnadsdiplomer.
- `scripts/prepare-honor-print-set.cjs`: skrivefri oversikt over nøyaktig disse ventende godkjenningene.
- `scripts/review-service-milestones-v362.cjs`: faktiske sammenligninger og PDF-er.
- `.github/workflows/pages.yml`: V3.6.2-kontrollartefakt, samme test- og publiseringstriggere.
- `tests/service-milestones-v362.cjs`: nye regresjonstester.
- Berørte eksisterende diplomtester og `tests/helpers/honors.cjs`: riktige historiske forventninger og godkjenningsstatus.
- `docs/v362-dugnadsdiplomer.md`: denne rapporten.

Ingen designendringer, personrettelser, ny medaljegrafikk, merge eller
publisering inngår. Nye rene diplomkopier må godkjennes av arrangøren.
