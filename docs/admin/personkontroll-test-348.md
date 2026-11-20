# Test #348: bekreftet feil i den private testmappens rettigheter

## CI-feil og reproduksjon

Etter PR #118 feilet main `c692970702f84f8f2676f104862dc3361fbde9c4` med
`page.waitForFunction: Timeout 30000ms exceeded` på linje 71, før første POST.
[Opprinnelig jobb](https://github.com/morothon-no/historikk/actions/runs/44626163859/job/135920579326).

Etter PR #119 viste diagnostikken på main
`e141f8ba04d697098d12854860028365855ab08e` den egentlige feilen:

```text
Initial private identity read must pass the real read/authentication gate
502 !== 200
/session 200
/review 200
/identity 502
```

[Jobben etter PR #119](https://github.com/morothon-no/historikk/actions/runs/44634830100/job/135950768324)
kjørte 378 tester: 377 bestått, én feil. Feilstakken og HTTP-diagnostikken er levert
av vedlikeholderen; GitHub-API-et svarer Forbidden i arbeidsmiljøet.

Begge feilene er gjenskapt lokalt med den respektive uendrede testen og vanlig
CI-umask `0022`, **uten feilinjeksjon eller endring av HTTP-headere**:

```sh
# På hver av de to ovennevnte versjonene, med avhengighetene installert:
(umask 0022; node --test tests/serverless-identity-browser.cjs)
```

Den eldre testen får samme timeout og stack på linje 71. PR #119-testen feiler
umiddelbart med samme GET 502 og UI-status som CI. Den lokale shellens `0077`
skjulte problemet tidligere. Den tidligere kontrollerte 403-reproduksjonen var
ikke dokumentasjon på CI-årsaken; nettmetadata er ikke årsaken til denne 502-feilen.

## Rotårsak

`tests/helpers/identity-serverless.cjs` gir testen `f.directory`, som tilhører det
ekte, krypterte identitetslageret. Nettlesertesten la også byggefiler og godkjente
syntetiske datapakker under denne mappen. Rekursiv `mkdir` for bygget opprettet
foreldremappen med standardmodus `0777 & ~umask`, altså `0755` ved umask `0022`.

Første identitetslesing går gjennom `privateFileStore.get()` og
`privateWorkspace()`, som korrekt krever en privat mappe (`0700`). Den eksisterende
kontrollen kaster `Runtime workspace must be private (0700)`. Brokeren skjuler
interne feil bak 502; dermed lyktes innlogging og resultatlesing mens
identitetslesingen ble avvist. Ingen lagring var startet.

## Avgrenset rettelse og regresjonsdekning

- Testens byggepakke, offentlige runtime og beskyttede frontend legges i en
  separat søskenmappe. Det private lageret oppretter selv sin mappe med `0700`.
- Nettlesertesten bruker eksplisitt `0022` i sin isolerte Node-testprosess og
  gjenoppretter tidligere umask ved opprydding. Dette gjenskaper miljøforskjellen
  også når utviklermaskinen bruker `0077`.
- Etter første vellykkede identitetslesing kontrolleres faktisk mappemodus `0700`.
  Hele lagre-/godkjenne-/logg-inn-på-nytt-flyten og begge innlogginger beholdes.
- En negativ brokertest oppretter en tom syntetisk mappe med `0755` og krever at
  lageret avviser den, GET returnerer 502 og mappen verken endres eller får filer.
- HTTP-statusforventningene, origin-/autentiseringskontrollene og sikre
  HTTP-/UI-diagnoser fra PR #119 beholdes. Ingen timeout økes.

Ingen produksjonskode, workflow, sikkerhetspolicy, data, pin eller secret endres.
Godkjent offentlig bygg og originale registre skal være uendret.

## Utrullingskontroll

Lokal testing bruker Chromium 156. Playwrights CI-Chromium 151 kunne ikke lastes
ned fordi CDN-tilgangen er blokkert; ny grønn GitHub-kjøring må fortsatt bekrefte
rettelsen i CI. Reproduksjonen ovenfor skyldes filrettigheter og krever ingen
endring av nettleserversjon.

Den eksisterende utrullingssperren mot gammel prosessorpin etter PR #118 beholdes.
Brokeren skal ikke legges til som et unntak i kildekontrollen. Faktisk privat
workflow er ikke fjernverifisert her. Før eventuell senere utrulling må private
workflow-/prosessorpinner gjennomgås og samsvare som beskrevet i
[del B](personkontroll-beskyttet-admin.md).
Ingen automatisk merge, deploy eller ekte dataendring er tillatt i denne hotfixen.
