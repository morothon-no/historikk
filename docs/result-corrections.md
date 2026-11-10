# Dokumenterte resultatkorrigeringer

## Jon Grindland – Junior 3 km, 2026

Grunnlag: arrangørens bekreftelse og skjermbilde av EQ Timings korrigerte klassevise resultatliste, delt i samtalen 10. november 2026. Nettverkspolicyen i arbeidsmiljøet tillater ikke direkte oppslag mot EQ Timing; skjermbildet er den kontrollerte kilden.

- Person-ID: `MOR-638C1F4`.
- Navn, tid **16:10**, klubb **FRAMSTEG IL**, startnummer **120** og deltakelsesår er uendret.
- Intern kjønnsverdi: `Dame` → `Herre`.
- Klasse: `K10-12` → `M10-12`.
- Korrekt plass: **7 i M10-12**, slik skjermbildet viser. Plass 12 i denne listen tilhører Olav Espeland.

Juniorplasseringer beregnes innen registrert aldersklasse, separat per år, konkurranse, distanse og kjønn. Vanlige løp beholder kjønn-/distanserangeringen. Arkivets klasseoverskrifter, profilens plassering, kildeplassering og plasseringsbaserte prestasjoner bruker samme inndeling.

K10-12 har nå 1, 2, 3, 4, 4, 6. M10-12 har 1, 2, 3, 4, 4, 6, 7, 8, 9, 10, 11, 12. Disse to klassene er kontrollert direkte mot skjermbildet. M13-14 har 1, 2, 3, beregnet etter samme regel fra klassens tre uendrede tider. Tjue kildeplasseringer i 2026 Junior 3 km er normalisert til klasseplassering; ingen tider eller andre resultatfelt er endret utenom Jons klasse.

Juniorfeltet har fortsatt 21 deltakere: 15 gutter og 6 jenter. Hele 2026 har fortsatt 398 individuelle deltakere: 248 herrer og 150 damer. Globale profilantall blir 1691 herrer og 952 damer. Lagresultater, deltakelsesmerker, løyperekorder, aliaser og årsstatistikkens deltakelsestall er uendret.

Jon har fortsatt én deltakelse, men får ingen uriktig klasseseier eller pallplass. De øvrige juniorenes plasseringsbaserte prestasjoner følger de korrigerte aldersklasseplasseringene. `tests/jon-grindland.cjs` kontrollerer begge klasselister, M13-14, delte plasseringer, DNS/DNF, mobil/PC, profil/arkiv og kjønnsfiltre. Testen gjenoppretter bare de dokumentert endrede feltene i minnet og kontrollerer at hele den tidligere historikkfilens SHA-256 stemmer; øvrig historikk er dermed bevart.
