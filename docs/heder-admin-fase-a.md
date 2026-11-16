# Heder i administrasjonen – fase A: lesende grunnmodell

Denne endringen er **read-only og server-only**, uten offentlig API, nettmeny,
innlogging, database, skriving, resultatendringer eller publisering. Dette er
første utviklingstrinn av #73; det er **ikke** en ferdig redigerbar Heder-side.

## 43 gjeldende personer – ikke 44

- `data/honors.json` har 13 historiske gruppeoppføringer, hvorav den tidligere
  feilregistrerte `erling-danielsen` er i `hiddenProfileIds`.
- `data/volunteers.json` legger til 31 egne personer samt to referanser til
  profiler som allerede finnes.
- Dermed er **43 personer** gjeldende i Heder; historisk kildeoppføring for den
  feilaktige personen endres ikke og kan ikke bli gjeninnført via adminmodellen.
  `suppressedLegacyIds` er et internt revisjonsspor, aldri et personvalg.
- Eksisterende `personDetails`, historier, roller, årsgrunnlag, kilder, eksplisitt
  bekreftede løperkoblinger, særheder, utdelinger og minneprofiler beholdes.
- Nåværende `hiddenProfileIds` brukes i fase A for å utelate den **bekreftet
  ugyldige** oppføringen. Når løsningen senere støtter å skjule en *gyldig*
  person offentlig, må vi skille mellom arkivering/feilidentitet og bare
  offentlig synlighet: en gyldig, privat skjult profil bør fortsatt finnes i
  admin. Ikke bruk denne legacy-flaggen som en generell slettefunksjon.

## Administrative funksjoner for neste fase

- Vis alle 43 gjeldende personer med navn, roller, kort-/langomtaler,
  medvirkning, badge-kvalifisering og egen **«Til minne om»**.
- Minneprofiler viderefører aldri automatisk dugnadsår. Ukjent sluttår er
  fortsatt ukjent.
- Vis *dokumenterte enkeltår*, *registrert aktiv periode med fraværsår* og
  *godkjent samlet antall* som ulike typer bevisgrunnlag. Ingen automatiske
  endringer i historiske fakta.
- Bruk `MorothonHonorsData` som eneste motor for dugnadsår og merketrapper.
  Kvalifisering er aldri det samme som formell tildeling.
- En arrangør kan ha Heder aktivert/deaktivert, uten datatap. Deaktivering
  må i senere leveranse også sperre offentlige Heder-ruter, API-er og diplomer,
  ikke bare gjemme menypunktet. Fase A håndterer kun intern status, ikke ruting.
- For en *fortsatt aktiv* registrert periode: vis år fra start til siste
  **faktisk gjennomførte** utgave som foreslåtte avkrysninger. Fraværsår kan
  fjernes, og sluttår kan settes. Nye, gjennomførte utgaver kan tas med så lenge
  aktiv status består. Dette må skilles fra eksplisitt kildebekreftede år.
- Dagens legacy-register teller **maks én utgave per kalenderår**. Når en
  ny arrangør kan ha flere utgaver samme år, må ID-baserte utgaver fra
  domenemodellen (#67) brukes før dette tas i produksjon for andre kunder.

## Kobling til deltakerhistorikken

`findHonorRunnerCandidates({roster,history,personId,query,limit})` tilbyr
**lesende søk** i deltakerlisten, inkludert registrerte navnealias og
forskjellige kandidater med helt like navn. Resultatet inkluderer ID,
deltakelsesantall, eksisterende koblingsstatus og indikator når løperen
allerede er knyttet til en annen Heder-person.

Søk kan også brukes **før en ny Heder-person registreres**, med fritekst og
uten eksisterende Heder-ID. Ved registrering bør eksisterende Heder-profiler
sjekkes for duplikater før en ny profil får egen ID.

Dette er **kun forslag**. Administrator må bevisst bekrefte riktig person;
søk treffer aldri automatisk. Løpsstarter og løpsmerker skal aldri telle som
dugnadsår eller dugnadsmerker. Eksisterende, bekreftede `runnerLink`
beholdes. Ingen person- eller resultatkilde endres av søket. Ingen rute
eksponerer søket før en framtidig autentisert arrangørspesifikk API er klar.

## Testing og sikkerhet

`tests/honor-admin-roster.cjs` verifiserer 43 personer, bevart feilregistrering
uten gjeninnføring, eksisterende omtale, memorial, rangering, år, unntak og
deaktivering. `tests/honor-runner-search.cjs` bruker **utelukkende syntetiske
løpere** i søketester og kontrollerer navnelikhet, aliaser, duplikater,
kobling til annen Heder-person og at det ikke skjer automatisk sammenkobling.

Kjør i betrodd miljø:

```bash
node --test tests/honor-admin-roster.cjs tests/honor-runner-search.cjs
```

Etter #74 er merget og sikkerhets-/testpolicy er på plass, skal tilsvarende
nye syntetiske tester vurderes for offentlig PR-kjøring. Inntil da er disse
testene **ikke automatisk verifisert av PR-CI** og må kjøres eksplisitt før merge.
Alle nødvendige historiske regresjons- og diplomtester må også være grønne før
kodeendringer kan publiseres. Morothons eksisterende godkjente sider,
`data/honors.json`, `data/volunteers.json` og `public-data` må forbli urørt.
