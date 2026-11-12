# V3.6.1 – bekreftede løperkoblinger, profiler og grunnleggermerke

Utgangspunkt: `bcbb266c48da5370ffa1aea765872c6d388801da` på main, etter
brukerens merge av PR #22. V3.5.3/V3.6 og rettelsen av filovervåkingen beholdes.
Alle 14 forslag i koblingsrapporten er uttrykkelig bekreftet av arrangøren.
Se [koblingsrapportens bekreftelser](loperkoblinger-v36.md).

## Endringer

- De 14 koblingene lagres med egen kilde i `personDetails.runnerLink`.
  Det er fortsatt 44 personer; nå 26 bekreftede løperkoblinger og 18 uten treff.
  Kort og profiler bruker eksisterende dynamiske løpsberegning. Dugnad og løp
  forblir separate; ingen navn, resultater eller person-ID-er i historikken endres.
- Bare den sekundære grunnleggermarkøren på dugnads-/æresdiplomer flyttes:
  `right:33mm` blir `left:33mm`. Topplassering og størrelse er uendret.
  Hovedmedaljer, medaljesamling, dato og signatur flyttes ikke.
  Frittstående grunnleggerdiplomer har fortsatt grunnleggermedaljen i sentrum.
- Profilreglene er avgrenset til `#honorProfile`. På PC/nettbrett blir header,
  medaljer, historier og løpsstatistikk tettere. Oversiktskortene beholder sitt
  oppsett. På mobil beholdes lesbar tekst og store betjeningsflater.
- Den kontrollerte presentasjonssamlingen er eksplisitt regenerert for endret
  diplom-CSS: 44 personer × to varianter = 88 innholds-/asset-/CSS-kontrollsummer.
  Ingen godkjenningsregel eller layoutkontroll er deaktivert. Dette er ikke en
  formell tildeling eller registrering av utstedte diplomer.

## Gjenskap kontrollbildene

```sh
npm test
npm run build -- /tmp/morothon-v361-site
npm run diplomer:kontroll
node scripts/review-honors-v361.cjs /tmp/morothon-v361
```

Byggemappen må være tom. Åpne `index.html` i kontrollmappen. Skriptet bruker
CSS fra fast referansecommit for før-visningen, med dagens identiske persondata
og referanseversjonens gyldige utskriftskontrollsummer. Dermed sammenlignes
layout uten å blande inn nye løperkoblinger som en innholdsendring.

Kontrollomfang:

- Oscar Lohne med flere merker, Per Sangvik med løperhistorikk og Dag Morten
  Frantzen uten løperhistorikk, ved 1440, 1280, 768 og 390 px.
- Et uendret minnekort for Floke Bredland ved alle fire bredder.
- Samtlige profiltekster, også lukkede historier/kilder, samt medaljefiler
  sammenlignes. Asynkrone tekniske lastemeldinger sammenlignes separat via
  diplomkontrollen. Ingen innholdsfjerning brukes for å korte ned profilene.
- 28 faktiske liggende A4-PDF-er: før/etter for Oscar, Erling Askildsen, Einar,
  Arnfinn, Helge, Dag Morten og Per, hver med «Alle merker» og «Kun siste merke».
- Én A4-side, innebygd Caveat-font, gyldig layout, kontrollsummer og uendrede
  øvrige geometrier. PDF-format godtas innen 0,5 punkt fra A4, som dekker
  Chromiums eksisterende avrunding til hele utskriftspiksler (ca. 0,18 mm).
- Diplomer uten sekundært grunnleggermerke sammenlignes også piksel for piksel.
- Hele testpakken kontrollerer dessuten alle seks dugnadsnivåene, lange navn,
  ordinære løperdiplomer, reelle feil som skal sperre utskrift og historikkvern.

GitHub Actions lagrer galleri, PDF-er og målinger som
`morothon-v361-profiler-diplomer`. Forhåndsvisningene følger ikke produksjonsbygget
eller git-historikken. Tidligere V3.6- og V3.5.3-artefakter beholdes.

## Bevarte avgrensninger

Einar har 33 arrangørgodkjente dugnadsutgaver og utdelingsdato 7. november
2026; det opprettes ikke et ukjent oppnåelsesår. Erling Danielsen beholder
minnemerke, startår 1992 og ukjent sluttår uten automatisk opptelling til 2026.
Nye personlige ærestekster forblir forslag, ikke aktivt diplominnhold.
Hederssiden forblir utenfor hovednavigasjonen og har `noindex, nofollow`.
Godkjente medaljefiler, ordinære diplomer og løpshistorikken bevares.
Fysisk utskrift i bestemte skrivere/papirtyper vurderes fortsatt av arrangøren.
Ingen automatisk merge eller publisering inngår i denne leveransen.

## Målte resultater fra Chromium

| Profil | PC 1440/1280 px | Nettbrett 768 px | Mobil 390 px |
| --- | --- | --- | --- |
| Oscar Lohne | 19,2 % kortere | 17 % kortere | 9 % kortere |
| Per Sangvik | 21,6 % kortere | 20,5 % kortere | 8 % kortere |
| Dag Morten Frantzen | 18,8 % kortere | 16 % kortere | 8,4 % kortere |

Alle sammenlignede profiltekster og medaljer er bevart. Ingen horisontal
overflyt ble målt, heller ikke med åpen diplomforhåndsvisning. Alle 28 A4-PDF-er
bestod layoutkontrollen, hadde én liggende A4-side og innebygd Caveat-font.
Diplomer uten sekundær grunnleggermarkør er pikselidentiske før/etter.
V3.5.3-kontrollen ble også kjørt på nytt: 12 PDF-er, ingen feil.
Produksjonsbygget inneholder 58 filer; kontrollen av presentasjonsregisteret
består for 44 personer / 88 varianter uten omskriving av registeret.

## Endrede filer

- `data/honors.json`: 14 bekreftede koblinger, kilde og oppdaterte kontrollsummer.
- `css/honors.css`: kompakte, responsive detaljprofiler.
- `css/diplomas.css`: sekundært grunnleggermerke til venstre.
- `scripts/review-honors-v361.cjs`: gjenskapbart galleri, målinger og A4/PDF-kontroll.
- `scripts/review-honor-signoff-v353.cjs`: beholdt plasseringskontroll med presist unntak for det flyttede grunnleggermerket.
- `.github/workflows/pages.yml`: ekstra kontrollartefakt for V3.6.1.
- `tests/honors-v361.cjs`: koblinger, bevaring og faktisk før/etter-layout.
- `tests/runner-link-review.cjs`: 26 bekreftede koblinger i det oppdaterte registeret.
- `tests/honors-issue13.cjs`: kompakt kortkontroll tar bare høyde for ekstra løpslinje.
- `tests/honors-v36.cjs`: historikkvern med nøyaktig autorisert CSS-endring.
- `tests/honor-signoff-v353.cjs`: bevaringskontroll inkluderer den nye bekreftelseskilden.
- `docs/loperkoblinger-v36.md`: arrangørbekreftelsene med de 14 ID-ene.
- `docs/v361-sluttkontroll.md`: denne rapporten.

Avsluttende `npm test`: **204 av 204 bestått**, ingen feil, kanselleringer eller hoppede tester.
