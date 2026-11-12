# Morothon V3.6.1 – samlet sluttkontroll

Denne rapporten erstatter den første V3.6.1-statusen ved `bcb6f52`. Arbeidet
fortsetter på `codex/morothon-v3-6-1-profiler-diplomer`. Ingen merge eller
publisering er utført. De 14 tidligere bekreftede koblingene, grunnleggermerket
til venstre og den kompakte profillayouten er bevart.

## Endelig personregister

- **44 unike personer, fem grunnleggere og 26 bekreftede løperkoblinger.**
  Ingen nye identiteter, navnesammenslåinger eller ugyldige koblinger.
- **Einar Danielsen** er avdød grunnlegger og far til Erling. Dødsåret er ukjent.
  Han beholder fremhevet plass blant grunnleggerne, 33 arrangørgodkjente
  dugnadsutgaver og planlagt Æresmerke som hovedheder. Grunnlegger- og
  minnemerket er tilleggsmerker, sammen med de fem kvalifiserte dugnadsmerkene.
  Kort og profil viser «Til minne». Den avtalte kortteksten og minneteksten
  ligger i `personDetails`; den eksisterende personlige diplomteksten er bevart.
- **Erling Danielsen** lever og er flyttet til den ordinære dugnadsgruppen.
  Identitet `erling-danielsen` og løperkobling `MOR-B82F8A3` er bevart. Fra 1992,
  33 arrangørgodkjente utgaver per 2026, ingen konstruerte enkeltår eller sluttår.
  Høyeste ordinære merke er 30-utgaversmerket. Han får verken grunnleggermerke,
  minnemerke eller automatisk Æresmerke. Erling Askildsens opplysninger er uendret.
- **Anne Lene Førland-Hansen og Laila Endresen Skjulestad** har bekreftet startår
  2016 og rollen Drikkestasjon. Gjeldende modell gir 11 beregnede utgaver til og
  med 2026, uten at disse gjøres om til `confirmedYears` eller formelle tildelinger.

Arrangørens endelige rettelser er registrert med egen intern kilde datert
12. november 2026. `revisionHistory` bevarer de tidligere Danielsen-postene,
persontekstene, de to dugnadsoppføringene, diplomgalleriets tidligere
minneeksempel og historiske forbehold. Tidligere kilder og notater slettes ikke.
Aktiv visning og beregning bruker de nye opplysningene. Det gamle minneeksemplet
for Erling er erstattet av Leif Wiig; Leifs ordinære personlige diplom er uendret.

## Brukergrensesnitt og design

Kildeseksjonene er fjernet fra HTML og JS, inkludert hovedsidens
`honorSources`, personprofilenes kildelister og interne notater, samt interne
opplysninger på korrigerte profiler. Ubrukte kilde-CSS-regler er fjernet.
Historier vises uten kildehenvisninger. Kildevalidering og identitetsbekreftelse
beholdes i datamodellen; en ukjent kilde blir fortsatt avvist.

Nødvendig informasjon om beregnet fartstid, forskjellen mellom løp og dugnad,
forhåndsvisninger og bildekvalitet er bevart. Pallplasseringer presenteres i
vanlig språk, med fortsatt skille mellom konkurranser og årganger. Hederssiden
beholder `noindex, nofollow` og finnes ikke i offentlig hovednavigasjon.

Einar har en diskret minnemarkering og en ryddig rekke med to sekundære
hedersmerker. De to gjenværende kortene i minneseksjonen deler tilgjengelig
bredde og har lik høyde. Alle merker hentes fra eksisterende asset-register;
ingen medaljemotiver eller originalfiler er endret.

## Diplomer og godkjenning

**80 tidligere kontrollerte varianter er uendret. Åtte endrede varianter venter
på særskilt godkjenning**, to hver for Einar, Erling, Anne Lene og Laila.
De er tatt ut av det aktive rene presentasjonssettet. Tidligere kontrollsummer
bevares i `presentationPrintSet.pendingReviews.previousEntries`. Nye
kontrollsummer eller utskriftsgodkjenninger er ikke registrert automatisk.

De åtte kan vises og kontrolleres som tydelig merkede forhåndsvisninger;
merkingen følger også med i PDF/utskrift. Forsøk på ukritisk regenerering med
`diplomer:klargjor` avvises mens det finnes ventende gjennomganger.
`diplomer:kontroll` kontrollerer både de 80 uendrede variantene og de åtte
merkede forhåndsvisningene, uten å skrive godkjenningsdata.

Einars Æresdiplom beholder teksten, håndskriftfonten, signaturen og
**Søgne, 7. november 2026** som utdelingsdato. Oppnåelsesåret for de 33 utgavene
forblir ukjent. Grunnleggermerket står til venstre. Minnekonteksten bruker «For innsatsen du ga» i stedet for
«For at du stiller opp». Standardtekster uten personlig hederstekst bruker
også minneformuleringer. Minnemerket inngår som
et mindre tillegg i begge medaljevalg; Æresmerket er alltid størst.
«Kun siste merke» beholder særskilte hedersmarkører, mens tidligere
ordinære dugnadsmerker vises bare ved «Alle merker». I varianten med nytt
minnemerke brukes samlingsoppsettet; plassering av dato/signatur er bevart.

Erlings 30-utgaversmerke har ingen oppdiktet oppnåelsesdato, fordi samlet total
ikke dokumenterer de enkelte dugnadsårene. Anne Lene og Lailas 10-utgavers-
milepæl følger beregnet periode og det eksisterende arrangementsdatoregisteret.
Ingen person får automatisk oppføring i `awards` eller `issuedDiplomas`.
Ordinære løperdiplomer er uendret.

## Tester og faktiske forhåndsvisninger

```sh
npm run personer:kontroller
npm test
npm run diplomer:kontroll
npm run build -- /tmp/morothon-v361-final-site
node scripts/review-honors-final-v361.cjs /tmp/morothon-v361-final
```

Byggemappen må være tom. Åpne `index.html` i kontrollmappen. Det nye galleriet
viser grunnleggeroversikten, Einars og Erlings kort/profiler, Anne Lene og Laila,
samt sidens nederste del ved **390, 768, 1280 og 1440 px**. Alle åtte faktiske
liggende A4-PDF-er følger med. Ingen store skjermbilder eller PDF-er legges i git
eller produksjonspakken. GitHub Actions genererer `morothon-v361-sluttkontroll`,
i tillegg til de tidligere kontrollartefaktene.

De nye regresjonstestene kontrollerer de presise personrettelsene,
arkivopplysningene mot `bcb6f52`, samtlige profiler og historiske lenker uten
kilde-UI ved fire bredder, fortsatt avvisning av ugyldige kilder og begge
medaljevalg som merkede A4-forhåndsvisninger. Eldre testforventninger er oppdatert
for de uttrykkelig korrigerte faktaene. Den tidligere ukjente sluttdatoen for en
minneprofil testes fortsatt med et uttrykkelig historisk fixture; gjeldende
Erling-post testes separat som levende med 33 godkjente utgaver.

Kontrollerte delresultater:

- Personrapport: 44 personer, 26 bekreftede koblinger, 18 uten treff, null feil.
- Diplomregister: 80 uendrede kontrollerte varianter og åtte ventende, ingen
  omskriving eller automatisk godkjenning.
- Produksjonsbygg: 58 filer; historikk og medaljeoriginaler er uendret.
- Sluttgalleri: 16 profiler ved fire bredder, åtte A4-PDF-er, ingen konsollfeil.
- Dato-/signaturkontroll: 12 PDF-er. Innebygd Caveat-font beholdes.

## Endrede filer og begrensninger

Produktendringene ligger i `data/honors.json`, `data/volunteers.json`,
`heder.html`, `js/honors.js`, `js/honors-data.js`, `js/diplomas.js` og
`css/honors.css`. `css/diplomas.css` fra første V3.6.1-commit er uendret.
Kontrollskript, eksisterende regresjonstester, testhjelpere, denne rapporten og
GitHub Actions er oppdatert. Det nye skriptet er
`scripts/review-honors-final-v361.cjs`, med tilhørende nye regresjonstester i
`tests/honors-final-v361.cjs`.

`data/history.json`, løpernavn, aliaser, resultater, ordinære profiler og alle
godkjente medaljeoriginaler er bevart. Kildedata ligger fortsatt i de statiske
JSON-filene; UI-oppryddingen er ikke en tilgangsbegrensning. Faktisk papir,
skriver og fargegjengivelse vurderes ved arrangørens trykkgjennomgang.
De åtte endrede diplomvariantene skal godkjennes særskilt før rene kopier
klargjøres. GitHub Actions må kontrolleres på PR-en før publisering.

## Endelig teststatus

`npm test`: **208 av 208 bestått**, null feil, kanselleringer eller hoppede tester.
Den nye testen for minnekontekst dekker Einar, Floke og Leif i begge medaljevalg.
Produksjonsbygget er også kontrollert i Chromium ved 390 og 1440 px: riktig
minneformulering, avtalt dato og synlig forhåndsvisningsmerking, uten kilde-UI,
konsollfeil eller horisontal overflyt.
