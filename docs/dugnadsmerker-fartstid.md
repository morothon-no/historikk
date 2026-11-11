# Dugnadsheltene – sortering og foreløpige merker

Bygger på `main` etter PR #16 (`0d11b36`). Bare Dugnadsheltene sorteres:
tidligste registrerte `fromYear` først, norsk alfabetisk ved likt år, og
ukjent startår til slutt. Bekreftede roller kan gi registrert startår;
uten startår brukes tidligste dokumenterte dugnadsår. Rekkefølgen i
grunnlegger-, arrangør- og minneseksjonene er bevart. Kildelistene sorteres
ikke om og person-ID-er endres ikke.

## Datagrunnlag

Vanlige oppføringer i `data/volunteers.json` kan ha:

```json
{
  "id": "eksempel",
  "name": "Kun et dokumentasjonseksempel",
  "fromYear": 2014,
  "toYear": 2021,
  "excludedYears": [2016],
  "sourceIds": ["organizer-v34"]
}
```

`toYear`, `excludedYears` og `confirmedYears` er valgfrie. På fullstendige
hedersprofiler ligger de under `contribution`, sammen med `sourceIds`.
Sluttår og fravær tolkes aldri fra fritekst. Atle Aamodts eksisterende kilde
bekrefter fraværet i 2026; dette er nå registrert som `excludedYears:[2026]`.
Dette er den eneste endringen i persondataene.

Årsgrenser må være heltall, sluttår kan ikke være før startår, og årslister
må være unike heltall. Samme år kan ikke være både bekreftet og ekskludert.
Bekreftede år utenfor en eksplisitt oppgitt periode avvises som motstridende
opplysninger. Ugyldige lister gir en tydelig innlastingsfeil.

## Beregning og visning

`provisionalMilestone()` er en separat, ren visningsberegning:

- Anslag teller arrangerte utgaver fra startår til siste gjennomførte utgave,
  avgrenset av eventuelt sluttår og med eksplisitte fravær trukket fra.
- Arrangerte år hentes fra løpshistorikken, med fullførte resultater, DNF eller
  registrert deltakelse som grunnlag. Kalenderår, bare påmeldte eller bare DNS
  flytter ikke beregningen fremover. Manglende løpshistorikk gir ingen anslag.
- En eksplisitt, kildebelagt liste `confirmedYears` brukes som dokumentert
  grunnlag, uten å fylle hull med anslag. Fremtidige år teller ikke før utgaven
  er gjennomført. `contribution()` beholder sin eksisterende dokumenterte telling.
- Tersklene hentes fra `awardPolicy.milestones`; ingen faste merkenivåer i
  beregningsfunksjonen. Særskilte hedersmerker inngår ikke i beregningen.
- Eksisterende merkeforslag får beholde grafikk og betydning. Automatiske
  visningsforslag brukes på dugnadskort uten eksplisitt merkeforslag.
- Eksempel: «Mulig 10-årsmerke · basert på startår 2014». Seksjonsforklaringen
  presiserer at innsats i hvert mellomliggende år ikke er bekreftet.
- Bekreftet grunnlag merkes med antall **dokumenterte utgaver**. Anslag lagres
  ikke som dokumenterte år, merkeforslag, `awards` eller `issuedDiplomas`.

Kontrollgrunnlag til og med 2026:

| Person | Anslåtte utgaver | Mulig nivå |
| --- | ---: | --- |
| Jon Fjeld | 13 | 10 – Dugnadshelt |
| Rune Bergjord | 12 | 10 – Dugnadshelt |
| Per Sangvik | 8 | 5 – Ivrig hjelper |
| Tom Lohne | 6 | 5 – Ivrig hjelper |
| Birgitte Aamodt | 5 | 5 – Ivrig hjelper |
| Johannes Aamodt | 6 | 5 – Ivrig hjelper |
| Atle Aamodt | 5 | 5 – Ivrig hjelper |

## Tester og skjermbilder

```sh
node --test tests/volunteer-tenure.cjs
node scripts/review-volunteer-tenure.cjs /tmp/morothon-dugnadsmerker
npm test
npm run build
```

Bygg krever en tom `_site/`; flytt et gammelt generert bygg før nytt bygg.
Visningsskriptet lager faktiske før/etter-skjermbilder fra koden på `main`
og arbeidsgrenen ved 390 og 1440 px, samt nærbilder av Jon og Atle,
beregninger og en lokal `index.html`. Filene skal ikke committes.
GitHub Actions legger dem ved PR-kontrollen som nedlastbart artefakt
**morothon-dugnadsmerker-forhaandsvisning**, beholdt i 14 dager.
De inngår ikke i Pages-pakken.

Regresjonene dekker de sju personene, alle terskler, norske Æ/Ø/Å, manglende
startår, dokumentert start uten egen `fromYear`, sluttår, fravær, ugyldige og
motstridende opplysninger, sparsomme bekreftede år og fremtidige utgaver.
Kort testes ved 320/390/768/1440 px med konsoll- og overflytkontroll.

Historikk, resultater, medaljefiler, merkeregister, person-ID-er, eksisterende
forslag og ordinære diplomer er bevart. Hedersdiplomer er fortsatt utkast
uten aktiv offentlig PDF/utskrift. Ingen automatisk tildeling; alle aktuelle
merker har fortsatt `design-draft` og `printReady:false`. Hederssiden er skjult
fra menyen med `noindex, nofollow`.

Kontrollert 11. november 2026: **145/145 tester består** med `npm test`, ingen
feil eller hoppede tester. Målrettet pakke: 23/23. `npm run build` består med
55 runtime-filer, versjon `1b183c29940cd061`. Actionlint, JavaScript-syntaks
og whitespace-kontroll består. Før/etter-bildene er generert uten konsollfeil.
