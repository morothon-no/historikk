# Personkontroll: HTTP 422 ved offentlig installasjonstoken

## Påvist feil

Den private kjøringen etter utrulling #24 stoppet med:

```text
Privat prosessor: lease HTTP 409
Privat prosessor: LEASE_PUBLIC_TOKEN GITHUB_INSTALLATION_TOKEN upstream HTTP 422
Privat prosessorfase: worker-lease
```

Dette er et avslag på tokenutstedelse for det offentlige repositoryet, etter
jobbens revisjonsbundne overtakelse. Ingen personavgjørelse er dermed bekreftet
lagret. Den utadrettede HTTP 409 er adapterens normalisering av GitHubs HTTP 422.
Det er ikke dokumentasjon på en konflikt i en resultatfil eller en offentlig PR.

Arrangøren har bekreftet installasjonens godkjente rettigheter og tilgang til
begge repositoryer. Det er ingen ventende rettighetsgodkjenning på det viste
installasjonsbildet. En ny rettighetsutvidelse er ikke del av rettelsen.

Tokenforespørslene brukte det ugyldige tillatelsesnavnet `variables`. GitHubs
server-til-server-data identifiserer rettigheten som **`actions_variables`**:

- [GitHubs tillatelsesdata for API 2022-11-28](https://github.com/github/docs/blob/d7487f5debb5a5a2a6e65e6f9fa539266f5f8db6/src/github-apps/data/fpt-2022-11-28/server-to-server-permissions.json), nøkkelen `actions_variables`.
- [Go-klientens installasjonstillatelser](https://github.com/google/go-github/blob/5c5bbe8ec264908513eaee2a285d86aa52ef5d18/github/apps.go), `InstallationPermissions.ActionsVariables` med JSON-navnet `actions_variables`.
- [Rapportert avvik i GitHubs OpenAPI-skjema](https://github.com/github/rest-api-description/issues/5437). Fravær i dette skjemaet er ikke alene en gyldig kontroll av API-navnet.

## Avgrenset rettelse

Workerens lese- og publiseringstokens og den separate serverbaserte
publiseringsadapteren bruker nå `actions_variables`. De forespurte
rettighetsnivåene, repoavgrensningen og den strenge kontrollen av faktisk
returnerte rettigheter beholdes. Det er ingen overgang til et token med alle
installasjonens rettigheter og ingen alternativ tokenforespørsel ved avslag.

De tidligere testdoblene returnerte forespurte tillatelser uten å kontrollere
API-navnet. De avviser nå `variables` med HTTP 422 og krever det dokumenterte
navnet. Før rettelsen gjenskaper Worker-testen samme diagnostiske signatur som
produksjon. Tester dekker både lesetokens og `publish`/`continue`, den separate
adapteren og avvisning av et returnert token med det gamle tillatelsesnavnet.

Autentisering, OIDC, kilde-/workflow-bindinger, kryptert lagringsformat,
revisjonskontroller, obligatorisk CI, branch protection og artifact-gate endres
ikke. Identitets- og årspublisering forblir deaktivert. Offentlige data og
byggefiler skal være byteidentiske før og etter rettelsen.

## Aktivering og etterkontroll

Rettelsen er ikke aktiv før en eiergodkjent, samordnet utrulling har oppdatert
privat prosessorpinne, eksakt privat workflow-SHA og Worker-kilde etter
[aktiveringsveiledningen](koordinert-personkontroll-aktivering.md). Ingen deploy,
merge, secrets-endring eller ny ekte avgjørelse utføres som del av kodeendringen.
Det aktive Cloudflare-versjonsnummeret må leses på nytt som rollback-punkt;
rollback-punktet fra før utrulling #24 skal ikke gjenbrukes ukontrollert.

En allerede feilet jobb skal ikke sendes på nytt automatisk. Etter godkjent
utrulling hentes først privat status. Et nytt, uttrykkelig valgt forsøk må få
serverkvittering med høyere revisjon og gjenfinnes etter ny innlogging. At en
sak forsvinner fra den lokale arbeidslisten er ikke lagringsbevis. Dersom den
aktive kjøringen fortsatt feiler, brukes den konkrete nye diagnostikken; lokale
syntetiske tester er ikke en verifikasjon av GitHubs aktive tokenutstedelse.
