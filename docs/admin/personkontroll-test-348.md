# Test #348 etter PR #118

Feilen gjelder main `c692970702f84f8f2676f104862dc3361fbde9c4`,
[run 44626163859, source-jobb 135920579326](https://github.com/morothon-no/historikk/actions/runs/44626163859/job/135920579326).
Vedlikeholderens feilstakk fra jobben:

```text
not ok 348 - protected Personkontroll saves, approves and reopens after a fresh login
failureType: 'testCodeFailure'
error: 'page.waitForFunction: Timeout 30000ms exceeded.'
code: 'ERR_TEST_FAILURE'
name: 'TimeoutError'
stack:
  TestContext.<anonymous> (/home/runner/work/historikk/historikk/tests/serverless-identity-browser.cjs:71:13)
```

Dette er den første statusventingen, før lagring eller POST. Testens HTTPS-nettverk
er fullstendig syntetisk, men baserte seg delvis på nettlesergenererte Fetch
Metadata-/Origin-headere. Den gamle adapteren erstattet bare manglende
`Sec-Fetch-Site`, ikke en verdi som `none` fra en oppfylt/interseptert forespørsel.
Da kan den ekte GET-normaliseringen korrekt nekte å rekonstruere Origin, og
brokeren avviser lesingen. Testen ventet likevel bare på en vellykket UI-status.

Kontrollert lokal reproduksjon med **uendret test fra main** og bare slik metadata
på første `/identity`: `/session` og `/review` returnerer 200, `/identity` returnerer
403, og samme predikat på linje 71 får `Timeout 30000ms exceeded`. Uten
feilinjeksjonen består testen med system-Chromium 156.

HTTP 403 er observert i den kontrollerte reproduksjonen, **ikke hentet fra den
opprinnelige CI-loggen**, som manglet HTTP-diagnostikk ved denne ventingen.
GitHub-API-et svarer Forbidden her; feilstakken over er levert av vedlikeholderen.
CI bruker Playwright Chromium 151. Nedlasting av den versjonen ble forsøkt, men
CDN-tilgangen er blokkert. En ny grønn GitHub-kjøring må derfor bekrefte rettelsen
i dette miljøet før deploy eller del C; lokal testing erstatter ikke dette.

## Avgrenset rettelse

- Testadapteren modellerer genererte nettmetadata fra den faktiske, egne
  fixture-framen. En eksplisitt fremmed Origin overskrives ikke. Bearer-token og
  cookies kommer fortsatt fra reelle nettleserforespørsler, ikke fra et auth-bypass.
- Begge nye innlogginger testes med manglende Origin og `Sec-Fetch-Site:none`
  på `/identity`, uavhengig av hvilken nettleser som kjører testen.
- Første GET må returnere 200, og første lagrings-POST må returnere 202 før testen
  venter på UI. Feil rapporterer HTTP-sti/metode/status, UI-status og pageerrors,
  aldri cookies, bearer-token eller request-body.
- Direkte brokertester krever fortsatt 403 for både fremmed og manglende Origin
  på samtlige identitetsendepunkter. Ingen timeout, kontroll eller forventet
  sluttstatus er fjernet eller svekket.

## Utrullingskontroll

Ingen produksjonskode, workflow, sikkerhetspolicy, data, pin eller secret endres.
De eksisterende utrullingstestene består. Den faktiske kildekontrollen stopper
fortsatt mot den gamle prosessorpinnen, fordi PR #118 endret blant annet
`broker.cjs`, driver og prosessor. Dette er et separat, tilsiktet stoppunkt;
brokeren skal ikke legges til som et unntak i kildekontrollen.

Workflow-malen bruker fortsatt eksakt offentlig kodepin, privat OIDC-lease og
sparse checkout av `/scripts/admin/`, som dekker de nye identitetsmodulene.
Før eventuell senere utrulling må private workflow-/prosessorpinner gjennomgås
og samsvare som beskrevet i [del B](personkontroll-beskyttet-admin.md).
Denne hotfixen gir ingen tillatelse til merge, deploy eller ekte dataendringer.
