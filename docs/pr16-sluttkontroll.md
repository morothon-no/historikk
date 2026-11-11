# PR #16 – avsluttende kvalitetssikring

Kontrollert 11. november 2026 på `codex/morothon-aeresmerke-utkast`, med
`e8e64a70c30b4b37c86171d153f8cf45459b4fba` som innkommende versjon.
Dette er testrettelser, dokumentasjon og opprydding. Ingen ny designrunde.

## Testfeil og rettelser

Siste innkommende [Actions-kjøring](https://github.com/morothon-no/historikk/actions/runs/42998512800)
feilet i regresjonssteget. Alle de fire oppgitte feilene ble gjenskapt lokalt
(20 av 24 tester besto før rettelsen):

- Historietesten forventet Bent Bakke; riktig navn er **Bent-Inge Bakke**.
- CI-testen forventet gamle doble triggere. Den krever nå én `pull_request`-kjøring
  per PR-oppdatering, `push` bare til `main`, og fortsatt testet Pages-publisering
  bare fra `main`. Den kontrollerer også at feil ikke ignoreres.
- Frivillig-fixturen erstattet `sources` og mistet kildene til ekte oppføringer.
  Den utvider nå eksisterende kilder. Testen bekrefter at alle tidligere kilder
  og de to opprinnelige dataobjektene er bevart.
- Feilet lasting skal vise en tydelig feil og **ingen delvis personoversikt**.
  Testen krever null kort under feil, fortsatt avvist datalasting, vellykket nytt
  forsøk og alle 44 kort etter ny sidelasting.

Ingen runtime-kode, datafil, medaljefil eller godkjenning er endret i sluttkontrollen.
En ny bevaringstest sammenligner hele `data/`, `assets/`, `js/`, `css/`,
`index.html` og `heder.html` byte for byte med den innkommende versjonen.

## Personregister

**44 unike personer:** 13 i hedersmodellen og 31 i den enkle dugnadslisten.
De to profilreferansene i dugnadslisten oppretter ingen ekstra personer.

- Alle fem grunnleggere er samlet: Oscar Lohne, Erling Askildsen,
  Arnfinn Håverstad, Helge Reisvoll og Einar Danielsen. Oscar og Erling
  fremheves for 35 utgaver i samme seksjon, uten duplikater.
- Leif Wiig står under «Til minne om», med 2023, tidtaking og organisering.
- Bent-Inge Bakke, Magne Lia, Arnfinn Grimestad, Lars Vassbotn Aamodt og
  Aud Ovesen har korrekte navn og beholder sine tidligere profil-ID-er.
- Atle Aamodt: start 2021, eksplisitt kilde om fravær fra dugnaden i 2026.
  Birgitte Aamodt: start 2022. Johannes Aamodt: start 2021. Startår blir aldri
  automatisk til mellomliggende årsrekker, antall utgaver eller merker.
- Anne Lene Førland-Hansen og Laila Endresen Skjulestad har fortsatt ukjent startår.
- Alle `awards` og `issuedDiplomas` er tomme. Bekreftede kilder og aliaser er bevart.

## Diplomer og visuell kontroll

Ti nye faktiske Chromium-prøver: seks anonyme dugnadsnivåer, Oscar/Erling ved
30 og deres to 35-utgaversutkast. Alle har én liggende A4-side, ingen rapportert
overlapp eller avkutting og innebygde fonter. Laveste kontrollerte tekstkontrast
er 4,90:1. De ni SVG-ene er også kontrollert i to fontmiljøer.

- Oscar/Erling ved 30: **30 utgaver, 1992–2021, MILEPÆL OPPNÅDD I 2021**.
  Modellen beholder løpsdatoen 13. november 2021.
- Deres æresutkast: **35 utgaver, 1992–2026, 35 DUGNADSUTGAVER I 2026**.
  Modellen beholder 7. november 2026. Dette er ikke en formell tildeling.
- Anonyme eksempler har ingen datotekst, plassholder eller datostrek.
  Håkon Lohne og «Løpsleder Morothon» beholdes til høyre.
- Regresjonstesten kontrollerer også de tidligere milepælene 5/10/15/20 ved
  1996/2001/2006/2011 i en isolert forslagsfixture, uten å endre faktiske tildelinger.
- Ingers ordinære sølvdiplom er kontrollert ved 320/390/768/1440 px og som A4-PDF:
  10 deltakelser, 2015–2024 og 9. november 2024. Begge utskriftsknappene virker.
  Eksisterende rasterregresjon mot publisert løperdiplom består.

Kilde- og bygget hedersside er kontrollert ved 390/1440 px: 44 unike kort,
fem grunnleggere samlet, ingen horisontal rulling og ingen konsoll-/JavaScript-feil.
`noindex, nofollow` og fravær av offentlige menylenker er bevart.
Alle hedersdiplomer er fortsatt merkede forhåndsvisninger med `previewOnly:true`,
`imageReady:false`, uten offentlig PDF/utskrift og uten automatisk tildeling.

## Opprydding og reproduksjon

37 gamle gjennomgangsfiler er fjernet fra grenen, inkludert 22 PNG-er
og 10 PDF-er. Ingen offisielle originaler eller historiske filer er slettet.
Tidligere commits er bevart; ingen historikk er omskrevet.

Generatoren legger nå nye prøver utenfor repositoryet som standard:

```sh
node scripts/review-honor-badges.cjs /tmp/morothon-heder-pr16
npm test
npm run build
```

`npm run build` krever en tom målmappe. Behold eller flytt et gammelt generert
`_site/` før nytt bygg. Genererte PNG/PDF-er, galleri og målinger skal ikke committes.
Den tidligere `review/heder-pr16/`-stien er også ignorert som vern mot nye QA-filer.
Generatoren bruker ekte SVG-er, kontrollerer A4/geometri/år/signatur/kontrast og
lager mobil-/PC-bilder. Standalone SVG-visningens implisitte favicon-forespørsel
betjenes med nettstedets ekte ikon i den lokale QA-serveren; øvrige konsollfeil
gir fortsatt feil i kontrollen.

## Resultater og gjenstående punkt

- **`npm test`: 137 av 137 bestått, 0 feil, 0 hoppet over** (295 sekunder).
- **`npm run build`: bestått**, 55 runtime-filer, versjon `ef2247ca772609c8`.
- Offisiell actionlint, JavaScript-syntaks og `git diff --check`: bestått.
- Historikk, Enny-Karin, Jon Grindland, stafett, milepæler, løyperekorder,
  Adelskalender og vanlige løpermerker/-diplomer er bevart.
- GitHub-resultatet for den nye committen finnes under [PR #16](https://github.com/morothon-no/historikk/pull/16/checks).

**PR-status må avklares før merge:** GitHub viste PR #16 som åpen, ikke Draft.
`gh pr ready 16 --undo --repo morothon-no/historikk` ble forsøkt, men API-et svarte
`Post https://api.github.com/graphql: Forbidden`. Utkaststatus kunne derfor ikke
settes automatisk. Den må settes i GitHub-grensesnittet. Ingen ny PR er opprettet.

Teknisk kvalitetssikring er bestått. Samlet konklusjon er **IKKE KLAR FOR MERGE**
inntil den avtalte GitHub-utkaststatusen er avklart og arrangøren har gitt sin
endelige godkjenning. Fysisk prøvetrykk og en egen Windows/iPhone-kontroll er ikke
utført; de godkjenningslåste hedersmerkene er fortsatt designutkast. Ingenting er
merget, aktivert for utdeling eller publisert.
