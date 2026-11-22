# HTTP 409 ved privat jobbautorisasjon

## Bekreftet og uavklart

Etter utrulling av offentlig main `84d5aa22fb3d6ee1ca06dc303c9e89bf06fc99e1`
meldte privat prosessor `lease HTTP 409` i fasen `worker-lease`.
Lokale valg ble vist som ulagrede og var ikke bekreftet lagret etter ny innlogging.
Dette er ikke en bekreftet lagringskvittering eller dokumentasjon på datatap.

Eieren har bekreftet appinstallasjon på begge repoer og de dokumenterte
rettighetene for Administration, Checks, Metadata, Actions, Variables, Contents
og Pull requests. Ingen av disse rettighetene endres her.

Eksisterende adapter normaliserer både GitHub HTTP 409 og 422 til HTTP 409.
Den opprinnelige statusen og API-operasjonen gikk tapt. Den oppgitte loggen
kan derfor ikke alene avgjøre om avslaget gjelder en privat filskriving eller
utstedelse av installasjonstoken. Produksjonsoperasjonen er ikke direkte
verifisert: miljøet mangler tilgang til GitHub API og aktive Worker-logger.

Ingen offentlig PR, branch eller resultatpublisering opprettes i lease-steget.
Den publiserende adapteren kalles først av prosessoren etter en gyldig lease.
En konflikt ved offentlig PR-opprettelse forklarer dermed ikke dette stoppunktet.

## Avgrenset konflikthåndtering

En ny test gjenskaper HTTP 409 gjennom faktisk Worker, signert syntetisk OIDC og
kryptert syntetisk jobbtilstand: GitHub Contents avviser en skriving etter at en
annen fil har endret den delte private grenen. Målfilen kan fortsatt være uendret.
Den gamle adapteren avbrøt straks, uten å kontrollere denne forskjellen.

Ved et **bekreftet oppstrøms HTTP 409 på en Contents-skriving** prøver adapteren nå maksimalt tre
skrivinger. Før hvert nytt forsøk hentes målfilen på nytt. Kryptert fil-SHA,
revisjon og innhold må være identiske med det opprinnelig leste grunnlaget.
Samme ferdig beregnede oppdatering, ciphertext og forventede SHA brukes igjen.

- En nyere målfil avvises, også når den inneholder samme ønskede sluttverdi.
  Dette er nødvendig for engangsdata ved innlogging og ekte samtidige forfattere.
- HTTP 422, usikre nettverksutfall og andre avslag gjentas ikke.
- Det startes ingen ny jobb, og kommandoer, nonce, audit eller ID-er regenereres ikke.
- Revisjonskontrollen svekkes ikke. En vedvarende konflikt stopper fortsatt.

Dette retter en reprodusert feilklasse. Det påstås ikke at den hittil uspesifikke
produksjonsloggen beviser at akkurat denne konflikten oppstod i den ekte jobben.

## Presis, avgrenset diagnose

Etter godkjent privat OIDC kan lease-feil rapportere faste kontrollpunktkoder:

| Kode | Operasjon |
| --- | --- |
| `LEASE_TASK_READ` | Lesing av den private jobben |
| `LEASE_TASK_BINDING` | Kontroll av jobb, eier, nonce og versjoner |
| `LEASE_TASK_CLAIM` | Revisjonsbundet overtakelse av jobben |
| `LEASE_PRIVATE_TOKEN` | Utstedelse av privat, repoavgrenset installasjonstoken |
| `LEASE_PUBLIC_TOKEN` | Utstedelse av offentlig, repoavgrenset installasjonstoken |

Original numerisk GitHub-status og fast API-operasjonskode beholdes. Dermed kan
loggen skille `GITHUB_STATE_WRITE upstream HTTP 409` fra
`GITHUB_INSTALLATION_TOKEN upstream HTTP 422` uten å skrive ut rå leverandørsvar.

Jobbtokenenes faktiske rapporterte rettigheter kontrolleres nå mot de allerede
forespurte rettighetene. Implisitt `metadata: read` godtas. Manglende, avvikende
eller ekstra rettigheter avvises med `TOKEN_PERMISSIONS`; ingen tilganger utvides.
Dette verifiserer tokens ved neste reelle utstedelse og er ikke en påstand om at
vi har lest eksisterende produksjonstokens.

Prosessoren leser høyst 2048 byte av feilresponsen og skriver bare tillatte
kontrollpunkt-/operasjonskoder og numeriske statuser. Token, nøkkel, nonce,
jobb-ID, persondata og rå responsinnhold logges ikke. Uverifisert OIDC får ingen
slike private kontrollpunktdetaljer.

## Regresjon og videre kontroll

Tester dekker opprinnelig Worker-409, endret og uendret målfil, en annen fil på
samme gren, fast antall forsøk, usikre skriveresultater, engangsdata med identisk
konkurrerende verdi, tokenavslag 422, faktiske tokenrettigheter, feilsignatur og
begrenset logginnhold. Eksisterende private lagrings-/gjenåpnings-, import- og
publiseringstester beholdes. Ingen testtidsgrenser, workflow eller publiserings-
og godkjenningsregler endres. Testresultater og SHA rapporteres i PR-en.

Ingen ekte avgjørelse sendes på nytt, og ingen privat kø eller revisjon nullstilles.
Offentlige data, Heder, løperprofiler, diplomer og grafikk endres ikke.
Identitets- og årspublisering er fortsatt deaktivert.

Etter gjennomgang kreves samordnet og særskilt godkjent C/W/rollback-sett etter
[aktiveringsveiledningen](koordinert-personkontroll-aktivering.md). Aktiv
Cloudflare-versjon må avleses på nytt. Deretter kontrolleres den konkrete private
jobben, eksakt serverkvittering og gjenåpning etter ny innlogging. Ved fortsatt
avslag brukes den nye presise operasjonskoden; rettigheter endres ikke på gjetning.
