# Offentlige tester uten workflow-endringer

Legg nye `.cjs`-tester under `quick/`, `functional/`, `visual/` eller `full/`.
Beskyttet testkjører oppdager dem automatisk. Endringer i tester utløser full
kontroll av PR-en; ingen ny SHA-variabel eller workflow-endring trengs.

- `quick`: Node og Git, uten npm-pakker/nettleser/PDF/Python.
- `functional`: i tillegg Playwright/Chromium.
- `visual`: i tillegg Poppler for PDF-kontroll.
- `full`: tunge offentlige kontroller som bare inngår i fullnivået.

Bruk bare syntetiske eller godkjente data fra `public-data/`, aldri originale
administrative registre. Støttefiler kan ha `.js`/`.json`; `.cjs` kjøres som tester.
Delte syntetiske hjelpefiler legges for eksempel under `quick/fixtures/`, slik at
de inngår i eksisterende sparse checkout av `tests/public/`. Den isolerte
testpakkehjelperen kopierer hele denne offentlige testmappen, inkludert
støttefiler; private kildemapper oppdages eller kopieres ikke. Symlenker avvises
før kopiering. `quick/public-fixtures.cjs` prøver den faktiske sparse-listen og
kontrollerer at hjelperne overlever både første og neste isolerte testpakke.
Kildetester som trenger originalregistre forblir på toppnivå i `tests/` og kjøres
lokalt/fullt og på betrodd main, ikke med privat tilgang i offentlige PR-jobber.
