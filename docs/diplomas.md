# Diplomer

Profilknappen «Lag diplom» tilbyr opptjente deltakelsesmerker, gjeldende rekorddiplom og debutantdiplom. Innholdet beregnes fra `history.json` med samme person-ID-er, aliaser, DNS/DNF-regler og årsopptelling som adelskalenderen. Flere starter samme år teller én gang. Rekorder krever fullførte individuelle resultater fra og med 2014 og eksakt konkurranse, distanse og kjønn.

Oppnåelsesåret er det n-te unike deltakelsesåret. Datoene for 2014–2026 kommer fra arrangørens bekreftede EQ Timing-liste i `data/event-dates.json`. 11. november 2018 beholdes. År uten bekreftet dato vises bare med årstall. Ingen dato eller personlig signatur er oppfunnet.

Historiske merkediplomer fryses ved oppnåelsesåret: hovedtallet er terskelen, og perioden går fra debutåret til året for den n-te deltakelsen. Eksempel: Inger Katherin Dahl Frantzens sølvdiplom viser 10 deltakelser, 2015–2024 og 9. november 2024, selv om dagens profil har 12 deltakelser. En eventuell «alle utgaver»-tekst vurderes mot utgavene som var arrangert da merket ble oppnådd. Nye årganger endrer ikke historiske diplomer. Rekorddiplomet bruker rekordprestasjonen og rekordåret; hedersdiplomer har egen rollebasert logikk.

Malen følger Gunnar Kåsa v2: liggende A4, lys kremflate, doble rammer, petrolhjørner og sentrert navn/medalje/nøkkeltall. Den grove godkjente PNG-løperen er vannmerke. Alle merker kommer fra `data/badges.json`; se [biblioteket](badges.md).

Hovedtittel og undertittel gjentar ikke hverandre. Debutdiplomet har «MIN FØRSTE MOROTHON» som hovedtittel og «Debutdiplom» under navnet. Datoen står på én linje i håndskriftstil. Alle diplomtyper har sted/dato og «Håkon Lohne» i samme håndskriftfont, størrelse og farge, rett over to like streker på samme høyde. Under høyre strek står «Løpsleder Morothon» i mindre Arial. Dette er typografisk navneangivelse, ikke en etterligning av en personlig signatur. Vannmerkets godkjente styrke er uendret.

Trykkgodkjenningen av konkrete filer er knyttet til SHA-256. Faktisk DPI beregnes og oppgis; dokumenterte, brukeraksepterte avvik gjør ikke en lavoppløselig kilde til en ny 300 DPI-original. Manglende godkjenning, endrede filbytes eller layoutfeil sperrer fortsatt utskrift. Hedersprofiler bruker samme dokumentbygger og merkeregister, men foreløpige dugnadsoppføringer kan ikke utstede diplomer. Hedersdiplomer er kun forhåndsvisninger, med utkaststatus utenfor det seremonielle diplomdesignet og uten utskrift/PDF på nettsiden; se [hedersprofiler](honors.md).

PDF bruker nettleserens utskriftsdialog, uten eksterne PDF-tjenester. Velg A4, 100 %, ingen marger, bakgrunnsgrafikk på og topp-/bunntekst av. Layout, native bildedimensjoner og PDF-format kontrolleres i regresjonstestene. Fysisk prøvetrykk er ikke simulert.

Lokale gjennomgangsfiler genereres utenfor kildekoden:

```sh
node scripts/review-diplomas.cjs /tmp/morothon-diplomas
node scripts/review-release.cjs /tmp/morothon-review
node scripts/review-polish.cjs /tmp/morothon-polish
node scripts/review-approved-medals.cjs /tmp/morothon-approved-medals
```

Generatoren endrer ikke historiske resultater, oppretter ikke tildelinger og har ingen offentlig administrasjons- eller masseutskriftsfunksjon.

V3-grunnleggerprofiler kan ha en kort `diplomaTribute` fra hedersdataene. Den
vises i det eksisterende sitatfeltet, med layoutkontroll for alle fem grunnleggere.
Ingen utgave, medalje eller løpsstatistikk utledes fra denne teksten. Roller uten
registrert hedersmerke har ikke et automatisk diplomvalg. Se [hedersdata](honors.md).

## Layoutkontroll og responsiv forhåndsvisning

`checkLayout()` venter på fonter og bilder og kontrollerer både faktisk A4-størrelse
(297 × 210 mm) og plasseringen av tekstfragmenter, medaljen og synlige elementer.
Innholdet må holde seg innenfor sitt avsatte felt og arket. Klippet innhold og
overlapping mellom navnefelt og hovedfelt avvises fortsatt. `measurements` gir
pikselmål, overflyt per side, eventuell klipping og rå scrollavvik for feilsøking.

Toleransen er **1 CSS-piksel** (ca. 0,265 mm ved 96 DPI). Målinger normaliseres til
arkets koordinater også ved skalering. `scrollWidth`/`scrollHeight` og deres
client-mål er heltall; de brukes derfor som diagnostikk, ikke alene som bevis på
avkutting. Et tekst-/fontlinjefelt kan ha overheng uten at noe går utenfor det
avsatte feltet. Usynlige, transparente linjebokser regnes ikke som synlig
innhold; ekte tekst, bilder, rammer og faktisk klipping kontrolleres.

De store 17 mm-tallene beholder størrelsen, med linjehøyde 1,3. Signaturraden er
18,5 mm og beholder plassen fra forrige layoutrettelse. Ett felles HTML-oppsett
brukes i ordinære diplomer og hedersutkast. To like brede CSS Grid-kolonner har
identiske rader for håndskrift, strek og rolle. Dato og navn er 6 mm, med
linjehøyde 1,4 og samme håndskriftfont/farge. Begge strekene er 0,2 mm.
«Løpsleder Morothon» står under høyre strek i diskret 2,7 mm Arial. Venstre
kolonne reserverer samme plass under streken, slik at grunnlinjene er like uten
manuelle forskyvninger. Ingen ramme, medalje, vannmerke eller øvrig A4-felt endres.

Vanlige diplomer og hedersutkast bruker samme `fitPreview()`. Native A4-innhold
skaleres kun i forhåndsvisningen. Rammens kantlinjer tas med i høyden, og høyden
avrundes opp til nettleserens 1/64-piksel-grid slik at nederkanten beholdes.
Medaljenes faktiske DPI, kildefiler og trykkgodkjenning endres ikke av dette.

`tests/diploma-layout.cjs` kontrollerer Ingers historiske sølvdiplom, alle ti
merkenivåer (40–50 i en isolert fremtidstest), alle fire rekorddiplomer og debut,
korte/lange navn, fontvariasjon, A4-PDF, små avrundingsavvik og ekte feil som skal
sperre utskrift. Kildekontroll og forhåndsvisningssperren for hedersdiplomer
beholdes. Nye lokale kontrollbilder kan lages med:

```sh
node scripts/review-diploma-layout.cjs /tmp/morothon-diploma-layout
```

`tests/final-polish.cjs` måler også like håndskriftfonter, grunnlinjer, strekhøyder,
strektykkelser og plassering av maskinskrevet rolle på alle 15 diplomvariantene.
Seks egne PDF-kontroller kombinerer korte/lange navn med årstall, ordinær dato
og en lang datotekst som kun brukes som typografisk testdata.

## V3.1 – Windows-feilen i tallfeltene

Arrangørens målinger fra Chrome 157 på Windows, DPR 1, viser fire identiske
feil: `diploma-metric diploma-left`, `diploma-achievement`,
`diploma-metric diploma-right` og `strong`. Alle har
`outsideField.top = 4.000015589983434`, `outsidePage = 0` og `clipped = false`.
Tallboksen er 83,52 px høy, mens `Range.getClientRects()` gir en 91 px høy
fontboks. En ekstra måling i samme Windows-nettleser viser at de synlige tallene
har topp 466,8125 px i et felt som begynner på 446,8125 px: 20 px klaring.

Range-tekstbokser inkluderer ubrukte ascender-/descenderområder i fonten; de er
ikke pikselgrenser for de malte tegnene. `checkLayout()` måler derfor nå det
**vertikale tegnavtrykket til enkle, enlinjede numeriske nøkkeltall** med Canvas
`actualBoundingBoxAscent`/`Descent` ved tekstens faktiske DOM-grunnlinje. En
nullbredde-markør måler grunnlinjen og fjernes umiddelbart. Kontrollen bekrefter
at markøren ikke endret elementets geometri. Range-bredden beholdes konservativt.

Denne metoden gjelder bare vanlige tall, tid og prosent i `.diploma-metric
strong`, uten transformasjon, skygge, tekststrek eller andre ukjente
fontinnstillinger. Ved flere tekstfragmenter, manglende tegnmålinger eller
endret geometri brukes den tidligere Range-kontrollen. Øvrige tekstfelt,
bilder, feltgrenser, sidegrenser, overlapp og faktisk klipping kontrolleres som
før. Toleransen er fortsatt 1 CSS-piksel. Ingen CSS, diplomdata, bildefil eller
signaturutforming er endret i V3.1.

Målerapporten gir nå også `rawContentBounds`, `rawOutsideField`, `failedChecks`
og `textFragments` med rå Range-boks, synlig tegnboks, grunnlinje og fontmåling.
Dermed kan et eventuelt nytt avvik spores til konkret betingelse og mål.

`tests/diploma-windows.cjs` bruker en OFL-lisensiert Noto Sans-testfont med
ascender-/descenderinnstillinger som gjenskaper Windows-målingens fire avvik.
Den gjengir faktiske tegn i nettleseren uten å mocke DOM-rektangler. Testfonten
og Windows-observasjonen ligger i `tests/fixtures/diploma-font/` og inngår ikke i
nettsidepakken. Dette er et tilsvarende målt fontmiljø, ikke en Windows-VM.
Testene kontrollerer også faktiske rasterpiksler, piksel-/DOM-uendret måling,
A4-PDF, begge utskriftsknapper, ulike bredder/DPR og negative kontrolltilfeller.

Fonten bygges til Canvas fra eksplisitt `fontStyle`, `fontWeight`, `fontSize`
og `fontFamily`. `getComputedStyle(element).font` kan være tomt når
fontvariantinnstillinger ikke kan serialiseres til én shorthand, og brukes
ikke som målefont.

## V3.2 – kort kvalitetsstatus og cache

Godkjente bildefiler med dokumenterte avvik viser «Godkjent for utskrift –
dokumenterte bildekvalitetsbegrensninger». Native oppløsning og alle faktiske
DPI-/kildevarsler ligger under «Vis bildekvalitet». Detaljene er tilgjengelige
med tastatur; manglende godkjenning eller reelle layoutfeil vises fortsatt
direkte og sperrer begge utskriftshandlinger. «Lagre som PDF» åpner
nettleserens utskriftsdialog som før.

Byggeren versjonerer også stilark-URL-en inne i det isolerte diplomdokumentet.
Lokal kildevisning bruker uversjonerte relative adresser. Dato, signatur og
tegnmålingen fra V3.1 er bevart. Lukking avslutter den pågående gjengivelsen synkront. En forsinket close-hendelse fra en tidligere
dialog ignoreres hvis dialogen allerede er åpnet igjen, og flytter ikke fokus
fra en annen kontroll/dialog. Rask Escape/Enter avbryter dermed ikke en ny forhåndsvisning.

## V3.4 – hedersutkast med flere merker

Service-malen bruker nå én primærmedalje og mindre sekundærmerker fra samme
fellesregister. Bare service-komposisjonen er justert; vanlige opptjente
merke-/rekord-/debutdiplomer er uendret. Se [hedersmodellen](honors.md) for
forskjellen mellom roller, dugnadsår, merkeforslag, tildeling og utstedelse.

Oscar og Erling har et kildebelagt 35-utgavergrunnlag. Femårsutkastet er et
anonymt typeeksempel, ikke en påstand om en virkelig person. Arrangementsdato
brukes ikke som en automatisk tildelingsdato. Typografisk signaturnavn er ikke
en ekte håndskrevet signatur. Alle service-utkast har fortsatt låst utskrift/PDF,
uten aktive knapper og uten `allow-modals` i iframe. A4-kontroll og faktisk
bildekvalitet må bestå uavhengig av eventuell senere formell tildeling.

## Fjerde hedersmerke – Morothons æresmerke (utkast)

`service-aeresmerke` er foreslått som det høyeste nivået, uten automatisk
opptjening. Oscar Lohne og Erling Askildsen har æresmerket som foreslått
hovedmerke, og Hedersildsjel/Grunnlegger/Dugnadshelt som sekundære.
Den liggende A4-malen viser **ÆRESDIPLOM** og markerer deres 35 utgaver.
Siden det kan bli tre sekundærmerker, bruker bare service-utkastet en tettere
3-kolonne-rad; ordinære merkediplomer er ikke berørt.
Medaljen er et uferdig SVG-motiv og ikke trykkgodkjent. Service-utkast beholder
`imageReady: false`, `previewOnly: true` og ingen utskrifts- eller PDF-knapper.
