# Worker protection #42 – undersøkelse og sikker diagnostikk

## Verifisert

- [Kjøring #42](https://github.com/morothon-no/historikk/actions/runs/44895040258)
  feilet på main `cff1ee637342767d31f38b289b751b09de5bfb6e`, 21. november 2026.
- [#41](https://github.com/morothon-no/historikk/actions/runs/44881598801) var grønn
  på `2c79691819d4aba05f5213e55ed171837ea6a4d1`. Selve kontrollen, byggereglene og
  listen over offentlige filer er uendret mellom disse committene.
- Den oppgitte feilmeldingen kommer fra Pages-løkken i `verifyHealth()` i
  `deploy/admin-serverless/check-deployment.cjs`. I denne kjøringen hadde derfor
  de foregående kontrollene allerede bestått: helse 200, anonym `/review` 401,
  innloggingsside uten admininnhold, beskyttede adminressurser 401 og sperret
  `/site/admin/admin.js` 404. Dette er en slutning fra den konkrete feilstasjonen,
  ikke en ny direkte verifisering av aktiv Worker fra utviklingsmiljøet.
- En ren bygging av godkjent main gir 59 offentlige filer, versjon
  `1161be8f67469fef` og 43 Heder-profiler. Ingen `admin/`-filer inngår. Private
  originalregistre, Worker, bindings, secrets, DNS og produksjonsdata er urørt.

## Adressene og kriteriet

Kontrollen starter på `https://morothon-no.github.io/historikk/admin/` og tester
deretter `index.html`, `admin.js`, `admin.css`, `web-transport.js`,
`event-profile.json`, `diploma-adapter.js` og `admin.js.map` under samme adresse.
Kun HTTP 404/410 godtas. En 301/302/307/308 følges bare dersom den peker til
samme ressurs under `https://historikk.morothon.no/admin/`, uten endret query.
Også det endelige svaret må være 404/410. HTTP 200, 401, 403 eller 500 godtas
ikke som bevis på at den offentlige adminruten er fjernet.

Det gamle feilsystemet la først til den konkrete ruten i feilen, men erstattet
deretter hele teksten med en generell prefiksstreng. Derfor mangler både filnavn
og HTTP-status i loggen. Feilen alene beviser ikke at offentlig admininnhold
faktisk ble levert; også en uventet omdirigering eller serverfeil kan utløse den.

## Denne avgrensede rettelsen

Kontrollen beholder nøyaktig de samme godkjenningskriteriene, tidsgrensene og
antall forsøk. Bare en internt konstruert Pages-feil får beholde den faste
forespørselsadressen og numeriske HTTP-statuser gjennom feilsaniteringen.
Kjente kanoniske ruter kan vises; andre omdirigeringsmål skjules og følges ikke.
Ingen sideinnhold, cookie, queryverdi, URL-legitimasjon, token eller rå feiltekst
fra eksterne tjenester logges.

En målrettet test dekker alle åtte Pages-rutene, legitim kanonisk 301→404,
301→200/401/403/500 og avvisning av fremmede mål. Eksisterende gateway- og
sikkerhetstester beholdes. Tillegget gjør det mulig å se hvilken adresse og
respons som faktisk stanser den aktive kontrollen; det erklærer ikke #42 løst.

## Gjenstående verifikasjon og publisering

Utviklingsmiljøets proxy stopper de tre nettstedene med **CONNECT 403 før HTTP**.
Dette er ikke HTTP 403 fra Morothon eller Pages. GitHub-siden viser bare exit 1,
mens logg-API-et på `api.github.com` også er blokkert. De tre ønskede domenene
er lagret i miljøutkast revisjon 4, men det kjørende miljøet bruker fortsatt
miljøspesifikasjon 4 uten disse domenene. Lagret utkast er ikke aktiv tilgang.

Dermed er **den konkrete Pages-ruten, HTTP-responsen og produksjonsinnholdet
ennå ikke verifisert**. Ingen omdirigeringsregel er endret på gjetning. Fullfør
lesekontrollen når miljøutkastet er tatt i bruk, eller bruk den presise feilen
fra en godkjent kjøring av den oppdaterte anonyme helsekontrollen.

Diagnostikkendringen endrer ingen offentlig byggfil og krever i seg selv ingen
ny Pages-publisering eller Worker-deploy. Dersom videre verifikasjon viser en
gammel Pages-pakke med admininnhold, kreves publisering av den rene pakken;
dersom svaret bare er en legitim omdirigering til 404/410, må dette håndteres
presist uten å godta HTTP 200. Det er foreløpig ikke grunnlag for å si at den
aktive feilen forsvinner med denne endringen alene.

Kontrollfilen er en beskyttet sikkerhetsfil. Normal PR-review og eventuell
godkjenning av eksakt head gjennom eksisterende policy kreves før merge.
Ingen godkjenningsreferanse eller obligatorisk CI-kontroll oppdateres automatisk.
