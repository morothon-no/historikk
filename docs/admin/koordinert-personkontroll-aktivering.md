# Samordnet aktivering av Personkontroll etter #158

Ingen deploy, merge, secret-endring, personavgjørelse eller resultatpublisering er
utført. Dette er en avgrenset klargjøring av eksisterende manuelle deployjobb.

## Bekreftet produksjonsgrunnlag

Eieren har avlest følgende i Cloudflare Dashboard for `morothon-admin`:

| Binding | Aktiv verdi |
| --- | --- |
| Version ID, 100 % trafikk / R0 | `cab2d260-20d0-4292-88e5-09d81dc560fc` |
| `PRIVATE_WORKFLOW_SHA` | `5a5318b6d88653837b54a93f432b969afd9928ab` |
| `PROCESSOR_CODE_SHA` | `dcf5de9f1e27d8b262913a02d71b7909d4e73fe5` |

De to aktive pinnene er innbyrdes konsistente: workflowen på `5a5318b…` hardkoder
nettopp `dcf5de9…`, og sist registrerte Worker-kilde `f5a4adf…` har identisk CORE
med denne prosessorpinnen. Den faktiske private main er imidlertid
`7200efff68d3a5883abdf8610f887da67a0667b7`, og workflowen der kjører
`ff7f99c1e60a951ba5ca6762edb95bff62c0f4d2`. Et nytt dispatch mot privat main kan
derfor ikke oppfylle den aktive Workerens eksakte gamle OIDC-binding. Ingen privat
jobblogg eller personavgjørelse er hentet for å trekke denne konklusjonen.

Godkjent funksjonskode er main `e9ae01229fe04e978b15295a260089815fc7efdb`, inkludert
#158. Den nye klargjøringen bygger på denne uten å endre Personkontroll,
årsimport, lagringsformat, innlogging eller publiseringsmotor.

Privat Draft PR #5 foreslo opprinnelig kun å endre kodepinnen fra `ff7f99c…` til
e9ae012. Den skal inngå i samme leveranse. Pinnen må vise til gjennomgått kode som
også inkluderer denne deploy-klargjøringen; ellers avviser publiseringsmotoren
korrekt at offentlig main har fått nyere workflow-/sikkerhetskode etter pinnen.

## Én eksplisitt godkjenning av hele utrullingssettet

Ny **ikke-hemmelig repository-variabel** i `historikk`:
`MOROTHON_ADMIN_RELEASE`. Den er ikke opprettet eller satt av klargjøringen.

```json
{
  "version": 1,
  "processorCodeSha": "C: eksakt gjennomgått offentlig commit",
  "privateWorkflowSha": "W: faktisk privat main etter godkjent merge av PR #5",
  "rollbackVersionId": "cab2d260-20d0-4292-88e5-09d81dc560fc"
}
```

Eksemplet er en forklaring, ikke et gyldig deploy-input. C og W må være faktiske
40-tegns SHA-er. Ingen fremtidig merge-SHA skal gjettes eller erstattes med en
privat PR-head som ennå ikke er main.

Den uavhengige godkjenningsvariabelen er nødvendig: bare å kopiere operatørens
SHA-input til en fil og sammenligne dem igjen ville ikke bevart kontrollen.
Jobben kan ikke opprette eller endre godkjenningsvariabelen med sine read-only
GitHub-rettigheter. PR-kode og nettleseren har ingen ny godkjenningsrute.
Eksisterende resultatpubliserer kan fortsatt bare endre sine to eksisterende
publiseringsvariabler; denne godkjenningen inngår ikke i adapterens skriveliste.
Repository-administratorer med adgang til Actions-variabler er fortsatt en
betrodd grense, som for dagens A1C-godkjenning.

Kun den numerisk bekreftede hovedeieren kan starte utrullingen. Operatørens
bekreftede W og R0 må samsvare med den separat godkjente variabelen. Godkjenningen
bindes også til reelt checkout, kildekode og faktisk 100 %-rollbackversjon.

## Midlertidig konfigurasjon – ingen nye selvrefererende commits

`prepare-release` endrer kun `PROCESSOR_CODE_SHA` og `PRIVATE_WORKFLOW_SHA` i
runnerens midlertidige Wrangler-fil, etter godkjenning. Ingen config committes.

- Worker og assets bygges fra siste grønne offentlige main M.
- C må være en eksisterende ancestor av M, med **identisk Git-tre**. Dermed kan
  testet PR-head C brukes sammen med sin ordinære main-merge M uten å gjette M på
  forhånd. Nye kode-, dokumentasjons-, konfigurasjons- eller dataavvik stopper.
- Den opprinnelige CORE-guarden beholdes, og checkout må være eksakt M.
- Uventede lokale endringer avvises. Den genererte configen får bare avvike fra
  committet config i de to pinnene; identiteter, adresser og øvrige bindings kan
  ikke endres gjennom utgivelsesgodkjenningen.
- Privat workflow hardkoder fortsatt C. Den får ikke en dynamisk kodegren eller
  PR-styrt kodepin. Workerens lease og den private prosessoren kontrollerer C.
- OIDC beholder eksakt privat repo-ID, W, main, workflowsti, dispatch-actor,
  GitHub-hosted runner, oppgave-ID, nonce og rollebegrensninger.

Kun eksisterende `workflow_dispatch` beholdes. Ingen nye triggere, secrets,
rettigheter, tjenester, tilganger, cache eller offentlige kontrollartefakter.
Wrangler er fortsatt 4.164.0. Remote metadata-preflight kjøres rett før deploy.

## Nødvendige PR-er og utrullingsrekkefølge

1. Gjennomgå offentlig klargjørings-PR. Den endrer eksisterende deployjobb,
   deploy-guard, målrettede tester og dette dokumentet. Ingen produksjonsdata.
   Sikkerhetsfilene krever eksisterende maintainer-godkjenning av eksakt PR-head
   gjennom `MOROTHON_REVIEWED_POLICY_HEAD`; ingen automatisk oppdatering.
2. Frys gjennomgått, testet offentlig PR-head **C**. Oppdater eksisterende privat
   Draft PR #5 til å hardkode C. Kun denne énlinjers pinendringen skal inngå.
   Ikke merge PR #5 isolert eller starte private personjobber.
3. Etter godkjent offentlig merge: avles M og bekreft grønn full main-CI samt
   identisk tre mellom C og M. Ved andre main-endringer må settet revideres.
4. Avtal vedlikeholdsvindu og avklar alle private jobber. Ingen aktive/pågående
   eller uavklarte jobber skal krysse pinbyttet. Ikke slett kø, gjenta avgjørelser
   eller kanseller ekte jobber automatisk. Gjeldende private `admin-state` bevares.
5. Etter særskilt godkjent privat merge av PR #5: avles faktisk privat main **W**,
   og kontroller at workflowen på W hardkoder C. Dette er W som OIDC forventer,
   ikke nødvendigvis committen som tidligere var PR-head.
6. Presenter endelig C/W/R0 for eksplisitt deploygodkjenning. Eieren setter det
   godkjente settet i `MOROTHON_ADMIN_RELEASE` og bekrefter samme W/R0 når den
   eksisterende manuelle workflowen startes fra main. Ingen secrets åpnes.
7. Jobben gjentar kilde-, eier-, konto-, OAuth-, siste grønne main-, binding- og
   metadata-kontroll. Den stopper dersom R0 ikke fortsatt er eneste 100 %-versjon,
   eller ved ukjente bindings eller feil secret-typer. Først da tillates deploy.
8. Registrer ny faktisk Cloudflare-version R1 og bindingene C/W. Kjør helse,
   anonym sperre, offentlig Pages-sperre og deretter særskilt godkjent eiertest.

Ingen godkjenning av denne PR-en aktiverer identitets- eller årspublisering:
begge policyene beholder `ENABLED=false`. Eksisterende kontrollerte
resultatpublisering er uendret og brukes ikke i aktiveringstesten.

## Lagring, kompatibilitet og rollback

Adapterne for AES-GCM v1, rekordnavn/AAD, autentisering, stabile eier-ID-er og
`STORAGE_KEY` beholdes. Ingen namespaces, registre, revisjoner eller audit flyttes.
Syntetisk kontroll fra tidligere klargjøring åpnet en avgjørelse skrevet med
sist registrerte Worker-kode i den nye tjenesten og videreførte avvisning/audit.
Faktisk privat tilstand er ikke lest eller antatt bekreftet lagret.

R0 ovenfor er et **eieravlest tilbakeføringspunkt**. Lokal formatkontroll og
syntetiske metadatatester erstatter ikke ny live metadata-preflight ved deploy.
Det er derfor ikke påstått at denne utviklingskjøringen har lest versjonen gjennom
Cloudflare-API eller testet en faktisk rollback.

Ved feil: stopp nye innsendinger, avklar allerede startede jobber og noter
R1/C/W. Etter godkjent tilbakeføring: Cloudflare → `morothon-admin` → Deployments
→ velg R0 → Roll back. Kontroller konto, 100 % trafikk, secret-referanser og helse.
Ikke reset `admin-state`, private main, offentlige resultater eller audit.

**R0 er retur til tidligere driftstilstand med kjent Personkontroll-feil, ikke
bevis på fungerende privat lagring.** Privat main W vil etter oppdateringen ikke
matche R0s gamle workflow-binding. En revert-commit gir heller ikke den gamle
OIDC-SHA-en tilbake. Ingen nye personjobber skal kjøres etter en slik rollback.
Funksjonell gjenoppretting krever et nytt konsistent og godkjent C/W-sett; aldri
historikkomskriving, automatisk gjeninnsending eller svekket OIDC.

## Driftstest etter separat godkjenning

Logg inn i ny admin. Hent først serverlagrede avgjørelser for Håkon-paret; ikke
anta at tidligere forsøk ble lagret. Hvis avvisningen finnes, bekreft den og unngå
ny innsending. Ellers, bare med uttrykkelig godkjent ekte test: velg forskjellige
personer, se ulagret-status, angre/velg igjen og send én samlet privat innsending.
HTTP 202 er ikke lagring; krev kvittering og riktige tellere. Hent kun status ved
ukjent svar. Logg ut og inn, og bekreft samme avvisning uten ny ubehandlet sak.
Ingen offentlig identitet eller resultat skal endres.

Personkontroll er først verifisert i drift når denne testen består på R1/C/W.
