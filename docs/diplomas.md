# Diplomer

Profilknappen «Lag diplom» tilbyr opptjente deltakelsesmerker, gjeldende rekorddiplom og debutantdiplom. Innholdet beregnes fra `history.json` med samme person-ID-er, aliaser, DNS/DNF-regler og årsopptelling som adelskalenderen. Flere starter samme år teller én gang. Rekorder krever fullførte individuelle resultater fra og med 2014 og eksakt konkurranse, distanse og kjønn.

Oppnåelsesåret er det n-te unike deltakelsesåret. Datoene for 2014–2026 kommer fra arrangørens bekreftede EQ Timing-liste i `data/event-dates.json`. 11. november 2018 beholdes. År uten bekreftet dato vises bare med årstall. Ingen dato eller personlig signatur er oppfunnet.

Historiske merkediplomer fryses ved oppnåelsesåret: hovedtallet er terskelen, og perioden går fra debutåret til året for den n-te deltakelsen. Eksempel: Inger Katherin Dahl Frantzens sølvdiplom viser 10 deltakelser, 2015–2024 og 9. november 2024, selv om dagens profil har 12 deltakelser. En eventuell «alle utgaver»-tekst vurderes mot utgavene som var arrangert da merket ble oppnådd. Nye årganger endrer ikke historiske diplomer. Rekorddiplomet bruker rekordprestasjonen og rekordåret; hedersdiplomer har egen rollebasert logikk.

Malen følger Gunnar Kåsa v2: liggende A4, lys kremflate, doble rammer, petrolhjørner og sentrert navn/medalje/nøkkeltall. Den grove godkjente PNG-løperen er vannmerke. Alle merker kommer fra `data/badges.json`; se [biblioteket](badges.md).

Hovedtittel og undertittel gjentar ikke hverandre. Debutdiplomet har «MIN FØRSTE MOROTHON» som hovedtittel og «Debutdiplom» under navnet. Datoen står på én linje i håndskriftstil. Alle diplomtyper har «Håkon Lohne» og «Løpsleder Søgne Morothon» i samme håndskriftpregede skriftfamilie som datoen, med blank plass til ekte signatur. Dette er typografisk navneangivelse, ikke en etterligning av en personlig signatur. Vannmerkets godkjente styrke er uendret.

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
