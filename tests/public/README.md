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
Kildetester som trenger originalregistre forblir på toppnivå i `tests/` og kjøres
lokalt/fullt og på betrodd main, ikke med privat tilgang i offentlige PR-jobber.
