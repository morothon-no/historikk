# Morothon V3.5.3 – håndskrevet sted/dato og navnesignatur

Gren: `codex/morothon-v3-5-3-dato-signatur`, fra oppdatert main `3e45c8b`
(V3.5.2 / PR #21). Ingen merge eller publisering inngår i denne leveransen.

## Endring

Hedersdiplomets venstre felt viser hele «Søgne, …» i samme innebygde Caveat
Regular som «Håkon Lohne» til høyre: 6,7 mm, linjehøyde 8,4 mm og blekkfarge
`#233d69`. Den tidligere Arial-overstyringen er fjernet. Like gridrader gir
samme grunnlinje og like, tynnere streker. Rollen er «Løpsleder · Morothon».
Navnesignaturen er typografisk, ikke en etterligning av en ekte signatur.

Oppnåelsesdato bruker arrangementsregisteret. Før 2014 uten registrert dag
vises november og år, uten oppfunnet dag. Kjent nyere år uten registerdato
vises bare med år. Ukjent oppnåelsesår gir tomt felt uten etikett eller strek.
Einar beholder 33 godkjente utgaver, æresmerket og grunnleggermerket, uten dato.
Oppnåelsesdato blandes ikke med formell utdelings- eller utstedelsesdato.

Det er ingen endringer i hovedmedaljer, grunnleggermarkør, mindre medaljer,
medaljeoriginaler, personopplysninger, årsrekker, historiske resultatfiler,
tildelinger eller utstedelser. Bare de 88 presentasjonskontrollsummene er
regenerert i `data/honors.json`. Begge diplomvariantene beholdes.

## Font og kvalitetssperrer

Caveat er distribuert lokalt under SIL OFL 1.1; kilde, lisens og SHA-256 er
registrert i `assets/fonts/README.md`. Fonten har tillatt PDF-innbygging
(`fsType=0`), norske tegn og en statisk 400-vekt. Fontfilen verifiseres før
bruk og bygges inn i hedersdiplomets HTML. Ingen lokale systemfonter eller
eksterne fonttjenester er nødvendige. Fontbytene inngår i innholdskontrollsummen.

Mangler fonten, feiler nedlasting/filkontroll eller endres den kontrollerte
fontstilen, sperres utskrift. Reell avkutting/overflyt, bildekvalitet og
foreldede innholdskontrollsummer sperrer fortsatt. Ingen trykkgodkjenning av
merkeoriginaler er utvidet, og ingen formell tildeling opprettes automatisk.

## Faktiske forhåndsvisninger

`node scripts/review-honor-signoff-v353.cjs <utmappe> <bygget-V3.5.2>` lager
12 faktiske liggende A4-PDF-er og PNG-er: før/etter × begge varianter ×
Dag Morten Frantzen (2023), historisk kontrollprofil (2010) og Einar Danielsen.
Nærbilder, mobil 390 px og PC 1440 px inngår i HTML-galleriet.

2010-eksemplet er en tydelig syntetisk kontrollprofil med 15 testår fra
1996 til 2010, kun i nettleserens testfixture. Ingen persons historie endres,
og eksemplet arver ikke den faktiske personens rene utskriftsgodkjenning.

Alle 12 PDF-er er én liggende A4-side. De seks nye dokumentene inneholder
Caveat Regular som innebygd, Unicode-mappet font. Ingen dato brytes over flere
linjer. Ukjent dato har ingen tom datostrek. Alle medaljers mål og plassering
er målt identiske før/etter for begge varianter. Ingen konsoll-/layoutfeil.

PR-workflowen genererer `morothon-v353-dato-signatur` med galleri og målinger.
Store PDF-/PNG-kontrollfiler inngår ikke i produksjonsgrenen. Ordinære
løperdiplomers kode/stiler er bevart og deres visuelle regresjoner består.

## Sluttkontroll

- Nye målrettede tester: 4 av 4 bestått; produksjonskontroll: bestått.
- Kontroll av oppdaterte signatur- og layoutregresjoner: 14 av 14 bestått.
- `npm run diplomer:kontroll`: 44 personer, 88 gyldige valg, ingen skriving.
- Produksjonsbygg: 58 filer, versjon `7e7fedbdfbdae388`.
- Workflow-YAML og `git diff --check`: kontrollert.
- Samlet `npm test`: **187 av 187 bestått**, 0 feil, 0 hoppet over.
- Kontroll i ferdig produksjonspakke: 8 kombinasjoner (mobil/PC × Dag/Einar × begge diplomvalg), 0 feil.

Kontrollene er kjørt i Chromium med responsive mobil-/PC-bredder. PDF-fontene
og A4-formatet er målt med Poppler. Fysisk utskrift på papir er ikke prøvd her.
GitHub-API-et er nettverksblokkert (CONNECT 403); gren og direkte PR-lenke
leveres for manuell opprettelse. GitHub Actions kan først bekreftes når PR-en
finnes. Ingen reell merge eller publisering er utført.

## Endrede filer

- `.github/workflows/pages.yml`
- `assets/fonts/OFL-Caveat.txt`
- `assets/fonts/README.md`
- `assets/fonts/caveat-regular-latin.woff`
- `css/diplomas.css`
- `data/honors.json`
- `docs/diplomas.md`
- `docs/v353-sluttrapport.md`
- `js/diplomas.js`
- `scripts/build-site.cjs`
- `scripts/diploma-harness.cjs`
- `scripts/honor-signoff-cases.cjs`
- `scripts/review-honor-badges.cjs`
- `scripts/review-honor-signoff-v353.cjs`
- `tests/final-polish.cjs`
- `tests/helpers/honors.cjs`
- `tests/honor-draft-print.cjs`
- `tests/honor-signoff-v353.cjs`
- `tests/honors-dugnadsmilepaeler.cjs`
- `tests/honors-v34.cjs`
- `tests/pr16-final.cjs`
- `tests/release-v2.cjs`
- `tests/site-build.cjs`
