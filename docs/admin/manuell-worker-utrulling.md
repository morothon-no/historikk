# Manuell utrulling av morothon-admin

Denne leveransen klargjør utrulling av **eksisterende** Worker. Ingen deploy, workflow-dispatch, secret-endring, DNS-endring, offentlig admin-aktivering eller resultatendring er utført.

## Filer og bekreftede bindinger

- Aktiv konfigurasjon: `deploy/admin-serverless/wrangler.jsonc`.
- Worker: `scripts/admin/serverless/worker.mjs`, uendret fra godkjent main.
- Manuell workflow: `.github/workflows/deploy-admin-worker.yml`.
- Kontroller: `deploy/admin-serverless/check-deployment.cjs` og `tests/manual-worker-deploy.cjs`.
- Wrangler: **4.164.0**, installert midlertidig uten lifecycle-skript, uten endring i applikasjonens avhengigheter.

Mål er kontoen `7abd3bf4d65ed1b4395258ef99938ee5`, Worker `morothon-admin`, `https://morothon-admin.damofra75.workers.dev`. Portaladressen er `https://historikk.morothon.no/admin/`; tilkoblingen i Pages er fortsatt tom/deaktivert.

Intern eier-ID er **`2932a52f-6831-40a4-b566-bc97a0ab344f`**. Den er ikke hemmelig og skal beholdes ved senere oppdateringer og leverandørbytte. Ikke generer en ny UUID ved hver deploy. Resten av de oppgitte, ikke-hemmelige ID-ene står i konfigurasjonen.

Kontrollert 18. november 2026:

| Kontroll | Resultat |
| --- | --- |
| Offentlig main / prosessor | `d5c907d8bc1ebd7196db3fa3ae17b16e3a2d92c3` eksisterer; Worker og importerte runtime-filer samsvarer |
| Privat main | Git-ref peker på `99c1d9a704a6f7a0ab83a4d307ea97f38e99b77f` |
| Privat workflow | Kun `.github/workflows/morothon-result-job.yml` ble lest med filtrert Git-henting, uten originalregistre |
| Privat workflow-innhold | `MOROTHON_CODE_SHA` er `d5c907d8bc1ebd7196db3fa3ae17b16e3a2d92c3`; broker er riktig workers.dev-adresse; kun workflow_dispatch; contents:read og id-token:write. Hele YAML-modellen samsvarer med gjennomgått mal etter disse to ikke-hemmelige erstatningene |
| Privat workflow SHA-256 | `9c78eb8120106aa8dbecb33885a0cb79faf3670b260e283eddfb010786ac4276` |
| Limiter-ID-er | `1001` og `1002` er gyldige positive heltall representert som strenger, også akseptert av Wrangler 4.164.0 |
| OAuth App | `Ov23liCJ8N6fIUUWXq3` er oppgitt kandidat. Appinnstillinger og tilhørende eksisterende secret er **ikke live-verifisert** |
| Cloudflare-metadata | Eksisterende secrets/bindings, kontounike limiter-ID-er, tokenrettigheter og nåværende versjon er **ikke hentet eller endret** i dette oppdraget |

De øvrige numeriske GitHub-ID-ene er arrangørens bekreftede verdier. App-/installasjonsrettigheter og actor-ID ble ikke etterprøvd med en App-nøkkel; ingen slik nøkkel er lest. Den eksisterende OIDC-kontrollen beholder krav om eksakt privat repo-ID, workflow-ref/SHA, main, GitHub-hosted runner og App-bot-ID. Offentlig deploy-jobb får ingen private GitHub-nøkler eller originalregistre.

## Første deploy – operatørens kontrollpunkter

1. **Godkjenn PR-en og behold eksisterende sperrer.** Den nye workflowen er en beskyttet policyendring. Dagens A1C-guard krever at en maintainer etter gjennomgang setter `MOROTHON_REVIEWED_POLICY_HEAD` til den eksakte PR-head-en. Ingen variabel eller branch protection endres automatisk her. Vent på grønn PR/main-kontroll før manuell Worker-utrulling. Deploy-jobben krever siste grønne Pages-push-kjøring på valgt main-SHA.
2. **Kontroller GitHub OAuth App i eierens innstillinger.** Client ID må være `Ov23liCJ8N6fIUUWXq3`, callback nøyaktig `https://morothon-admin.damofra75.workers.dev/auth/callback`, og appen må være den som eksisterende `OAUTH_CLIENT_SECRET` ble opprettet for. Ikke vis, kopier eller erstatt secret-verdien. Stopp ved tvil; ingen innlogging eller testskriving trengs for denne kontrollen.
3. **Kontroller privat workflow på nytt i GitHub.** Privat main må ha oppgitt SHA, og `MOROTHON_CODE_SHA` og broker-URL må fortsatt stemme med konfigurasjonen. Den offentlige workflowen kan ikke bruke sitt GITHUB_TOKEN til å lese private kilder. Derfor kreves operatørbekreftelse, ikke et privat token i offentlig CI.
4. **Kontroller eksisterende Worker i Cloudflare Dashboard.** Riktig konto/navn; tre eksisterende secrets skal være av typen Secret med de oppgitte navnene. Ikke åpne verdier eller opprett nye nøkler. Kontroller alle bindings, at namespace `1001` og `1002` ikke utilsiktet brukes av andre Workers i kontoen, og at det ikke er uavklarte custom domains, routes, cron-triggere eller ressurser som skal bevares. Konfigurasjonen beskriver kun workers.dev og de to limiterne. Stopp ved andre ressurser; ikke slett dem for å få grønn kontroll.
5. **Noter tilbakeføringspunkt.** Under Worker → Deployments, kopier ID-en til gjeldende versjon med 100 % trafikk. Ikke bruk deployment-ID, tidligere tilfeldig versjon eller en versjon fra annen Worker. Ved gradvis utrulling skal denne enkle jobben ikke brukes. Unngå samtidige dashboard-/secret-/bindingsendringer under utrullingen.
6. **Start bare når utrulling uttrykkelig er godkjent.** GitHub → Actions → **Manual Morothon admin Worker deployment** → Run workflow → main. Fyll Worker-navn, kontrollert OAuth client-ID, kontrollert privat workflow-SHA og tilbakeføringsversjon. Kryss av først etter gjennomgang av bindings, namespace-ID-er og denne veiledningen. Dette autoriserer Worker-deployen, ikke resultatpublisering eller Pages-aktivering.

`CLOUDFLARE_API_TOKEN` brukes fra eksisterende repository-secret bare i steget som kontrollerer Cloudflare-metadata og deployer. `CLOUDFLARE_ACCOUNT_ID` brukes fra eksisterende repository-variabel og må samsvare med fast konto i JSONC. Tokenet bør bare ha **Account → Workers Scripts → Edit**, avgrenset til oppgitt konto; ikke DNS- eller kontoadministrasjon. Verifiser eksisterende scope i Cloudflare uten å vise tokenet. Jobbens GITHUB_TOKEN har bare contents:read og actions:read, ingen repo-skriving, OIDC eller deployrettigheter mot GitHub.

Workflowen har kun workflow_dispatch, en main-/repository-sperre og én utrulling om gangen. Den installerer ikke appavhengigheter og henter offentlig kode anonymt med sparse checkout og blob-filter, uten `data/` eller `public-data/`. Ingen cache eller artifacts med legitimasjon opprettes. Secrets er fortsatt repository-secrets: brukere som kan kjøre andre egenlagde workflows med skriverettigheter til repositoryet må være betrodde. En YAML-main-sjekk er ikke en ekstern sikkerhetsgrense mot en ondsinnet repository-maintainer. Sterkere separasjon krever senere en særskilt godkjent protected Environment/secret-flytting; ingen slik endring utføres eller påstås aktivert her.

## Hva som bevares, og hva Wrangler kan endre

Wrangler 4.164.0 bruker `keepSecrets: true` ved deploy og sender `keep_bindings` for `secret_text`/`secret_key`. De tre navnene står dessuten som `secrets.required` og arves fra eksisterende versjon; en manglende secret gir feil, ikke automatisk nøkkelopprettelse. Ingen secret-verdier ligger i JSONC, jobbmiljøet eller kommandolinjen. Verktøyet henter bare bindingsmetadata, aldri secret-verdier eller Worker-scriptinnhold.

Følgende kommandoer/valg brukes **ikke**: `secret put`, `secret bulk`, `secret delete`, `--secrets-file`, `--env`, eller en alternativ Worker-/kontooverstyring. Ikke legg dem til under operatørkjøringen. `STORAGE_KEY` skal spesielt aldri regenereres: eksisterende krypterte utkast kan da bli uleselige.

**Andre bindings og vanlige vars er ikke automatisk beskyttet av secret-bevaringen.** JSONC er autoritativ for de angitte ikke-hemmelige variablene; `keep_vars` er false. De to limiterne defineres eksplisitt. Preflight avviser ukjente bindings, feil secret-type og avvikende eksisterende limiter-ID/terskel. Ved ekstra bindings må konfigurasjonen gjennomgås i en egen endring før deploy. `--keep-vars` er ingen generell løsning for bevaring av ressursbindings.

Cloudflare beskriver limiter-ID-ene som positive heltallsstrenger. To bindings med samme namespace-ID i samme konto kan dele tellere på samme lokasjon. Formatkontroll/dry-run beviser derfor ikke kontounikhet. Dette er et operatørkontrollpunkt inntil kontoens faktiske metadata er gjennomgått. Begrensningen er omtrentlig og lokasjonsbasert; den erstatter ikke autentisering.

## Sikker kontroll etter deploy

Jobben gjør kun to read-only kontrollkall til Workeren: `GET /health` skal gi 200/`status:ok`; anonym `GET /review` med korrekt portal-Origin skal gi 401. Dette oppretter ikke innloggingsflyt, privat utkast, jobb eller rettelse. Ved feil stoppes jobben. Ingen automatisk ny deploy eller rollback kjøres.

Kontroller deretter i Dashboard at riktig kilde/tag er deployet, at de tre secret-navnene fortsatt finnes og at limiterne står riktig. Ikke logg verdier. Pages-transporten skal fortsatt være tom, og offentlig Adelskalender skal være uendret. Ikke åpne en ekte OAuth-/redigerings-/publiseringsflyt uten separat godkjenning.

### Stoppunkt før faktisk resultatpublisering

Denne PR-en endrer offentlig main med deploy-/test-/dokumentasjonsfiler. Den eksisterende `github-result-publisher.cjs` tillater bare datafilendringer etter `PROCESSOR_CODE_SHA`. Derfor vil den gamle d5c907d-pinnen **sperre nye resultatpubliseringer etter merge av denne PR-en**, selv om selve Worker-koden fortsatt er identisk. Sperren er korrekt og er ikke svekket.

Worker-deploy for kontroll av oppsett/helse er dermed ikke godkjenning av en operativ publiseringstjeneste. Før senere aktivering må nye versjonspins samordnes etter siste gjennomgåtte offentlige main: privat workflow må bruke den nye offentlige kodeversjonen, og Worker må binde til den resulterende private workflow-committen. Disse endelige drifts-pinnene må håndteres utenfor en selvrefererende offentlig Git-commit; bare å committe en ny offentlig SHA inn i JSONC gir enda en nyere main og løser ikke problemet. Dette krever en separat godkjent konfigurasjonsoppdatering før offentlig admin-transport eller resultatpublisering aktiveres. Ikke omgå kode- eller publiseringskontrollen for å få det til å virke.

## Tilbakeføring og senere oppdateringer

Ved feil: behold jobblogg, kilde-SHA og notert tidligere versjons-ID. Kontroller faktisk Cloudflare Deployments-status før et nytt forsøk; et nettverksavbrudd betyr ikke at ingenting ble deployet. En gammel rollback-ID vil bli avvist av preflight hvis aktiv versjon har endret seg.

Tilbakeføring krever egen operatørbeslutning: Cloudflare → eksisterende Worker → Deployments → velg den noterte tidligere versjonen → Roll back. Kontroller nøye at den gjelder riktig Worker og at ingen secrets/bindings har blitt endret siden versjonen ble tatt. En rollback kan også gjeninnføre gamle bindings, vars og secret-referanser; den må ikke brukes blindt etter nøkkelrotasjon. Kontroller helse og anonym sperre igjen. Ingen resultatdata eller Git-historikk skal resettes.

Senere endringer gjøres i en gjennomgått PR, med bevaring av intern UUID og eksisterende secrets. Gjenta kilde-/OIDC-/OAuth-/bindingskontrollene og velg nytt reelt rollback-punkt. Wrangler og offisielle Actions er låst; oppgraderinger krever bevisst gjennomgang. Ikke aktiver auto-deploy-triggere eller offentlig transport som del av vedlikeholdet.

## Kontroller som kan kjøres uten legitimasjon

- `node deploy/admin-serverless/check-deployment.cjs local`
- `node --test tests/manual-worker-deploy.cjs tests/serverless-admin.cjs tests/github-result-publisher.cjs tests/admin-managed-deployment.cjs tests/public-export.cjs tests/test-planning.cjs`
- Wrangler **4.164.0**: `wrangler deploy --dry-run --config deploy/admin-serverless/wrangler.jsonc --outdir <tom-midlertidig-mappe>`

Dry-run er bundling/konfigurasjonskontroll, ikke bevis på eksisterende Cloudflare-secrets, kontoens namespace-bruk eller fungerende innlogging. Ikke kjør `remote`, `health` eller ekte deploy som del av lokal gjennomgang; de er til den separat godkjente manuelle utrullingen.

Referanser: [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [rate-limit-bindinger](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Wrangler 4.164.0](https://www.npmjs.com/package/wrangler/v/4.164.0). Secret-bevaringen er i tillegg kontrollert i den installerte 4.164.0-koden (`createWorkerUploadForm` og deploy-helpers), ikke bare i dagens nettdokumentasjon.
