# Erling Danielsen – fjernet fra Heder-visningen

Utgangspunkt: main `ce1c434` (PR #24). Gren: `codex/skjul-erling-danielsen`.

`data/honors.json` har én ny visningsinnstilling:
`hiddenProfileIds: ["erling-danielsen"]`. Selve personregistreringen, historiske
kilder, løperkoblingen `MOR-B82F8A3`, merkeforslag, tidligere diplomkontroller
og revisjonshistorikken er bevart uendret. Registeret inneholder fortsatt 44
personer; Heder-siden viser 43.

Visningsfilteret i `js/honors-data.js` og `js/honors.js` brukes for personkort,
eventuelle gruppereferanser, fremheving og navngitte diplomeksempler. Søk går
bare gjennom de renderte kortene. Direkte profillenker og eventuelle aliaslenker
til den skjulte registreringen erstattes med `#oversikt`; ingen tom hedersprofil,
feilmelding, personlige merker eller diplomkontroller vises.

Ingen andre registerfelt er endret. Det gjelder også Einar Danielsen, hans
personlige æresdiplom og datoen 7. november 2026. Alle 88 interne diplomgrunnlag
har identiske kontrollsummer og samme godkjenningsstatus som main.
Løpshistorikk, ordinære løperprofiler, medaljeoriginaler og design er uendret.
Hederssiden beholder `noindex` og er fortsatt uten offentlig navigasjonslenke.

Regresjonstestene skiller nå mellom 44 bevarte registreringer og 43 synlige
personer. Tidligere historiske testfixturer beholder sin daværende visning.
Aktive kontrollgallerier følger dagens synlighetsfilter slik at de ikke
forsøker å åpne eller ta skjermbilder av et fjernet personkort.

Nye tester i `tests/honors-visibility.cjs` kontrollerer:

- Kun den nye visningsinnstillingen skiller personregisteret fra main.
- Historiske resultater, løperdiplomer, medaljer og alle andre personer er bevart.
- Ingen kort, søkeresultat, aktiv lenke eller navngitt diplomeksempel for Erling.
- Direkte og kodede lenker, aliaser og gjentatte gruppereferanser.
- Mobil/PC ved 390 og 1440 px, uten sideveis overflyt eller konsollfeil.
- Einars uendrede profil/diplomer og Erlings fungerende løperprofil.

Kontrollbilder og produksjonsbygg ligger utenfor git, under
`/workspace/review/morothon-hide-erling*`. Ingen merge eller publisering inngår.

## Sluttkontroll

- `npm test`: 215 av 215 bestått, ingen feil, avbrutte eller hoppede tester.
- Produksjonsbygg: bestått, 58 filer, versjon `a58062f7c89c96df`.
- Bygget side kontrollert ved 390 og 1440 px; Erling har ingen hedersprofil,
  mens løperprofilen fortsatt åpnes korrekt.
- Aktive kontrollgallerier: 34 gjeldende A4-PDF-er, seks tekstforslag,
  12 profilvisninger og seks ytterligere A4-kontroller, uten feil.
