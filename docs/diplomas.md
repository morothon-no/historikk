# Diplomer

Profilknappen «Lag diplom» tilbyr opptjente deltakelsesmerker, gjeldende rekorddiplom og debutantdiplom. Innholdet beregnes fra `history.json` med samme person-ID-er, aliaser, DNS/DNF-regler og årsopptelling som adelskalenderen. Flere starter samme år teller én gang. Rekorder krever fullførte individuelle resultater fra og med 2014 og eksakt konkurranse, distanse og kjønn.

Oppnåelsesåret er det n-te unike deltakelsesåret. Datoene for 2014–2026 kommer fra arrangørens bekreftede EQ Timing-liste i `data/event-dates.json`. 11. november 2018 beholdes. År uten bekreftet dato vises bare med årstall. Ingen dato eller personlig signatur er oppfunnet.

Malen følger Gunnar Kåsa v2: liggende A4, lys kremflate, doble rammer, petrolhjørner og sentrert navn/medalje/nøkkeltall. Den grove godkjente PNG-løperen er vannmerke. Alle merker kommer fra `data/badges.json`; se [biblioteket](badges.md).

Trykkgodkjenningen av konkrete filer er knyttet til SHA-256. Faktisk DPI beregnes og oppgis; dokumenterte, brukeraksepterte avvik gjør ikke en lavoppløselig kilde til en ny 300 DPI-original. Manglende godkjenning, endrede filbytes eller layoutfeil sperrer fortsatt utskrift. Hedersprofiler bruker samme dokumentbygger og merkeregister, men foreløpige dugnadsoppføringer kan ikke utstede diplomer. Bekreftede grunnleggere kan eksportere et tydelig merket, ikke utstedt A4-utkast; se [hedersprofiler](honors.md).

PDF bruker nettleserens utskriftsdialog, uten eksterne PDF-tjenester. Velg A4, 100 %, ingen marger, bakgrunnsgrafikk på og topp-/bunntekst av. Layout, native bildedimensjoner og PDF-format kontrolleres i regresjonstestene. Fysisk prøvetrykk er ikke simulert.

Lokale gjennomgangsfiler genereres utenfor kildekoden:

```sh
node scripts/review-diplomas.cjs /tmp/morothon-diplomas
node scripts/review-release.cjs /tmp/morothon-review
```

Generatoren endrer ikke historiske resultater, oppretter ikke tildelinger og har ingen offentlig administrasjons- eller masseutskriftsfunksjon.
