# Heder fase B – lesende visning i lokal arrangørportal

Denne fasen kobler den godkjente Heder-projeksjonen (#76) til **lokal C1-admin**.
Den legger til Heder i sidemenyen når den lokale loopback-serveren brukes.
**Ingen lagring, redigering, tildeling eller produksjonsoppdatering** skjer.

## Dette kan nå testes lokalt

1. Åpne lokal arrangørportal og velg «Heder» i menyen.
2. Se 43 gjeldende Heder-personer. Feilregistrert, tidligere skjult
   historisk oppføring er utelatt. «Til minne om» vises separat.
3. Søk personer/roller og filtrer «Fortsatt aktive» eller «Til minne om».
4. Åpne personkort for registrerte roller, historier, kvalifiserte merker,
   dokumenterte dugnadsår, registrerte perioder, fraværsår og formelle skiller.
5. Finn mulige løpere i eksisterende deltakerhistorikk. Liknende navn er
   **forslag, aldri bekreftet identitet**. Søket kobler ingenting automatisk.

Årvelger er foreløpig **lesende**. Brukeren skal i en senere fase kunne
krysse av reelle gjennomførte utgaver, fjerne fravær, markere fortsatt aktiv
og redigere omtaler. Publisering krever en separat godkjennings- og
lagringsflyt.

## Tilgang og sikkerhet

- Den eksisterende lokale serveren lytter bare på 127.0.0.1 og krever
  sesjonstoken. **Dette er ikke flerbrukerautentisering**.
- Nye GET-ruter `/api/honors` og `/api/honors/runner-candidates` er
  *kun* registrert i lokal server. De finnes ikke på GitHub Pages.
- Opplysningene kommer fra det **allerede godkjente offentlige
  datagrunnlaget** i lokal byggemappe, ikke fra private kildefiler.
- `scripts/admin/honor-admin-view.cjs` hvitelister hvilke felter som kan
  sendes til UI. `sourceMember`, `sourceDetails`, `sourceIds`,
  `internalNotes` og kildehistorikk er ikke i API-responsen.
- Når modulen kjøres med `startAdmin({honorEnabled:false})`, skal
  begge API-rutene avvise oppslag. Dette er en lokal pilotinnstilling;
  endelig arrangørspesifikk modulstyring og offentlig deaktivering kommer
  senere.
- Ingen privat Heder-kilde eller admingrensesnitt blir synlig på Pages.
  Portalskriptet kan være offentlig tilgjengelig som kildetekst, men
  det oppretter ikke Heder-meny eller kobler til Heder-API på Pages.
- Både rollen som løper og som dugnadsbidragsyter kan tilhøre samme person,
  men deltakelser teller aldri automatisk som dugnadsår.

## Ny arrangør: alltid blanke ark

Dette endrer **ikke** flyten for nye arrangører. Fase B viser
Morothons eksisterende 43 godkjente profiler i Morothons lokale pilot.
En helt ny arrangør skal få 0 deltakere, 0 resultater, 0 Heder-personer
og egne regler, utgave-ID-er, design, adgangskontroll og lagring,
som beskrevet i #72. `tests/honor-admin-view.cjs` inneholder en
syntetisk kontroll av at en tom Heder-modell for en ny arrangør
ikke inneholder Morothon-personer.

## Testkrav før merge

```sh
node --test tests/honor-admin-roster.cjs tests/honor-runner-search.cjs tests/honor-admin-view.cjs
node --test tests/public/visual/admin-portal.cjs
npm test
```

Kjør på nøyaktig PR-head i betrodd miljø. De kildeavhengige/visuelle
testene kjører **ikke nødvendigvis i offentlig PR-CI**.
Kontroller også at bygg, publiseringspakke og GitHub Pages fortsatt
oppfyller gjeldende policy. Ingen automatisk merge ved bare grønn
offentlig PR-test.
