# historikk
Adelskalender for terrengløpet Søgne Morothon 

## Lokal utvikling og tester

Start nettsiden fra prosjektmappen med `python3 -m http.server 8000`.
Ingen bygging eller pakkeinstallasjon kreves for selve nettsiden.

Kjør regresjonstestene med `node --test tests/regression.cjs`. Testene krever
Playwright for Node.js og Chromium (`/usr/bin/chromium`, eller angi
`CHROMIUM_PATH`). De starter og stopper sin egen lokale testserver og kontrollerer
mobilgraf, PC-graf, resultatarkiv og at stafettlag ikke påvirker individuell statistikk.

Individuelle historiske data ligger i `people`, `results` og `yearStats` i
`data/history.json`. Lagresultater ligger separat i `teamResults` og skal aldri
legges inn som personer eller individuelle resultatlinjer. `place` og `time` er
`null` ved DNS. `legs` angir antall etapper, ikke en lik distanse per etappe.

Forsidens løyperekorder beregnes ved innlasting fra fullførte individuelle
resultater fra og med 2014, separat for damer og herrer i nøyaktig
`Morothon` / `20 km` og `Kortmoro` / `10 km`. Forsiden, profilens rekordfelt,
rekordmerker og delingskort bruker samme beregnede liste med løper-ID som nøkkel.
Ved delt rekord vises alle rekordholderne; ved gjentatt rekordtid for samme løper
brukes det første året tiden ble satt. Ingen tider eller rekordholdere er hardkodet.

«Årets milepæler» beregnes fra unike deltakelsesår per kanonisk person-ID.
Godkjente ID-omdirigeringer samler eldre resultat-ID-er før opptelling; navnealiaser
brukes til søk, og personer slås ikke sammen bare fordi navnene ligner.
DNS utelates, DNF teller, og separate lagresultater inngår ikke. Årets merke vises
når årets deltakelse når en av tersklene i `PARTICIPATION_BADGES` (5–50, steg 5).
Historiske år beregnes uten å ta med senere deltakelser. Forsiden bruker siste
arrangerte år i historikkfilen; resultatarkivet viser milepælene for valgt år.
Regresjonstestene dekker også kontrolltallene for 2026, alle merketerskler,
sammenslåtte ID-er, DNS/DNF og fremtidige årganger.
