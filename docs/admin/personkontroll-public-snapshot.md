# Privat Personkontroll stopper i public-snapshot

Etter Worker-utrulling #25 rapporterte den private prosessoren:

```text
Privat prosessorfase: public-snapshot
Privat kontroll feilet før fullføring. Ingen vellykket publisering er meldt.
```

Jobben har dermed passert OIDC/lease, tokenutstedelse og kontroll av lease-svaret.
Loggen dokumenterer ikke privat lagring. Det tidligere tokenavslaget er ikke
påvist på nytt i denne kjøringen.

## Hva som er undersøkt

Offentlig main er `266aa5b6fd6746c70bde0b111b22b9438b6ed9bb`, privat workflow er
`986f4e022819b30187c7cf99772cec621d08f91a`, og prosessorpinnen er
`1b3aa698af21392eddf7bb1fd182e5f263fdf7df`. Arbeidstreet for offentlig main og
denne prosessorpinnen er identiske.

Bygg med det eksakte sparse-utvalget fra den private workflowen består lokalt:
59 offentlige filer, byggversjon `1161be8f67469fef`. Originalregistre er ikke
til stede i denne utsjekkingen. Dette avkrefter ikke andre runtimefeil i Actions.
GitHub API returnerer fortsatt `Forbidden` i utviklingsmiljøet, også ved forsøk
på lesing av main-grenens beskyttelsesmetadata. Ingen branch protection eller
apprettigheter er endret.

Den gamle fasen `public-snapshot` dekket også bygg, runtimevalidering og
Chromium-start/sandbox. Siden toppnivåets feilbehandler forkastet hele feilen,
kan den viste loggen ikke identifisere hvilken kontroll som faktisk stoppet.
**Produksjonsårsaken er fortsatt uavklart. Denne rettelsen gjelder diagnostikken.**

## Avgrenset diagnostikk

Snapshot-adapteren rapporterer faste trinn: `main-ref`, `source-version`,
`main-protection`, `main-ci`, `approved-files` og `approval-variables`.
Prosessoren skiller deretter filskriving i den midlertidige pakken, offentlig
bygg, runtimevalidering, nettleserstart og sandbox-kontroll.

Feilbehandleren skriver bare forhåndsdefinerte kontrollkoder, tillatte numeriske
GitHub-statuskoder og faste filsystemkoder. Den skriver ikke rå feilmeldinger,
API-svar, stier, tokens, nonce, personopplysninger eller registerinnhold.
Sandbox-feilen gjenkjennes bare ved den eksakte, faste meldingen i kildekoden.

Eksempler:

```text
Privat prosessorkontroll: PROTECTION_ADMINS
Privat prosessorfase: public-snapshot/main-protection
```

```text
Privat prosessorkontroll: GITHUB_HTTP_403
Privat prosessorfase: public-snapshot/approval-variables
```

Alle eksisterende avslag beholdes: strict/up-to-date, håndheving for admin,
PR-review, alle fire påkrevde tester, fravær av app-bypass, kildeversjon og grønn
main. Diagnostikken har ingen alternativ kjørevei og foretar ingen skriving.
Nettlesersandbox, godkjenningsregler og publiseringssperrer beholdes.

## Tester og aktivering

Syntetiske tester avviser hver utilstrekkelig beskyttelsesregel og kontrollerer
at bare GET brukes i snapshot. Den faktiske prosessorens `main()` testes gjennom
syntetisk lease frem til et beskyttelsesavslag og et GitHub HTTP 403. Loggen må
vise riktig trinn uten rå feilinnhold. Dette tester diagnostikken, ikke den
uavklarte produksjonsårsaken.

Ingen ekte avgjørelse gjentas automatisk, og ingen jobb eller privat revisjon
nullstilles. Eksisterende krypterte data og offentlige bygg skal være uendret.
Aktivering krever separat godkjent, samordnet prosessor-/workflow-/Worker-sett
og et ferskt tilbakeføringspunkt etter
[aktiveringsveiledningen](koordinert-personkontroll-aktivering.md).
