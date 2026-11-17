# Valgfri lokal OCI-kontroll

Ingen leverandør-SDK, skykonto eller reell publisering kreves. Test kun med
syntetiske credentials og lokalt testvolum. Bind testport til `127.0.0.1`.

Docker sin ytre standard-seccomp kan nekte namespace-syscalls som Chromium trenger
for sin **egen** sandbox. Playwright dokumenterer en Docker-profil for dette:
[seccomp_profile.json, v1.62.1](https://github.com/microsoft/playwright/blob/v1.62.1/utils/docker/seccomp_profile.json).
Den beholder default-deny og tillater namespace-oppretting. Gi den som
`--security-opt seccomp=/godkjent/sti/seccomp_profile.json` ved Docker-test, aldri
`--privileged`, `--cap-add SYS_ADMIN` eller en avslått Chromium-sandbox.

Dette er et ytre Docker-testoppsett, ikke et krav om Docker-daemon eller denne
profilen hos enhver OCI-vertsleverandør. Generisk admin-start krever faktisk
positivt sandbox-resultat uansett plattform. App-prosessen kjører uprivilegert og
slipper capabilities i entrypoint; test ikke Chromium som root.

Bruk generert pakke som build context, secrets i separat `0600`-fil og et navngitt
montert volum på `/data`. Etter oppstart kontrolleres `/admin-healthz`, anonym
redirect, 401 på private API-er og at et syntetisk kryptert utkast overlever restart
med samme key/UUID. Stopp/fjern kun testcontainer/testvolum, aldri reelle driftsdata.
Kontrollrapporten skal skille disse testene fra ekstern HTTPS/OAuth og eiergodkjent
live-publisering. En fungerende lokal container er ikke en aktivert nettjeneste.
