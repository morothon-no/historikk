# Utgivelseskontroll – Morothon V3.2

Arbeidet fortsetter fra `codex/morothon-v3-2-kvalitet`, med arrangørens to
første korrigeringscommits bevart. Ikke opprett en parallell leveransegren.

## Datagrunnlag

Individuelle resultater, merkeregisteret, arrangementsdatoene og de godkjente
medalje-/vannmerkefilene skal ikke endres i denne utgaven. `data/honors.json` og
`docs/honors.md` beholder de avklarte 128 deltakerne i 1992. Avisens 129 er en
historisk kildeforskjell, ikke et åpent resultatspørsmål. 2018-datoen er søndag
11. november. «Inger Katherin Dahl Frantzen» skal ikke endres.

Regresjonstestene sammenligner de beskyttede filene med basen, og egne
kontroller dekker aliaser, Jon Grindland, Enny-Karin, stafett, rekorder,
merketerskler og milepæler. Behold full Git-historikk for originalkontrollene.

## Deterministisk utgave og filcache

`build-site.cjs` pakker bare eksplisitt valgte runtime-filer. Hashen omfatter
runtime-kildene, godkjente bilder, `package.json` og byggerens egen kode. Den
bruker filinnhold, ikke tidsstempel eller lokal filsti. Identisk kilde gir
identisk versjon og artifakt. Endringer i et stilark eller JavaScript gjør
versjonen ny uten manuelle `?v=`-redigeringer.

Alle CSS-/JS-adresser i `index.html`, `heder.html` og JavaScriptets dynamiske
filreferanser får samme versjon. Dette omfatter begge diplomtypers
`new URL('css/diplomas.css', document.baseURI)`. Kilden beholder vanlige relative
stier og kan brukes direkte med lokal HTTP-server. `build-info.json` og
`meta[name=morothon-version]` kan brukes ved cache-feilsøking.

`homepage` i `package.json` angir den offentlige HTTPS-adressen med avsluttende
skråstrek. Standardadressen er bekreftet i GitHubs `pagesUrl` for repositoryet:
https://morothon-no.github.io/historikk/. Bygget bruker den til canonical,
`og:url`, `og:image` og Twitter-bildet. Lokale testservere endrer ikke canonical.

Et allerede åpent nettleservindu oppgraderer ikke seg selv. Last siden på nytt
etter en godkjent utgivelse og kontroller versjonsmetadata ved feilrapportering.
Ingen service worker eller skjult cache-/versjonsoverstyring er innført.

## CI og Pages

Den eneste workflowen er `pages.yml`. Jobben `verify` kjører på PR mot `main`,
push til `codex/**` og `main`, samt manuell kjøring. Node 24, Python 3.12, Pillow,
Poppler, Liberation/URW-fonter og Playwright Chromium settes opp før `npm test`
og `npm run build`. Installerte filkilder er npm/PyPI/Ubuntu og Playwrights
offisielle nettleserdistribusjon. Ingen hemmeligheter legges i byggepakken.

En mislykket test stopper jobben før artifaktet sendes videre. `deploy` krever
`verify` og kjøres bare for `refs/heads/main` utenfor PR-hendelser. Den laster ned
det ferdig testede artifaktet og bygger ikke en annen variant på nytt. Arbeidsgrener
og PR-er får testkjøring uten offentlig Pages-publisering. Merge til `main`
krever arrangørens siste godkjenning.

## Lokal kontroll

Følg installasjonen i README. Kjør `npm ci`, `npm test` og `npm run build`.
Byggemappen må være tom; byggeskriptet sletter ikke vilkårlige mapper. Bevar
QA-bilder/PDF-er utenfor repositoryet. `tests/quality-v32.cjs` kontrollerer
versjonering, iframe-CSS, delingsmetadata, ikoner, Windows-fonttilfellet,
kompakt kvalitetsvisning, tastaturfokus og deploy-avgrensning.

Kontroller 320, 390, 768 og 1440 px: profilens fokusfangst og fokusretur,
Escape, mobilmeny, dialoglukking fra iframe, trykk/PDF og kort med lange navn.
Windows-testen bruker den målte fontmetrikken fra arrangørens Chrome, ikke en
Windows-VM. En senere faktisk Windows-kontroll av publisert versjon må bruke
riktig ny bygge-ID.

## Godkjente bilder og brukeropplevelse

Hashbundet trykkgodkjenning og faktisk DPI beholdes. Godkjente avvik vises
kort med åpnebare detaljer; reelle feil skjules ikke. Knappen «Lagre som PDF»
bruker fortsatt nettleserens utskriftsdialog. Signatur- og datofeltet er uendret.

Open Graph-PNG (1200 × 630), PNG-ikoner (16/32/180) og ICO er laget fra den
godkjente grove løperlogoen. De inngår eksplisitt i Pages-artifaktet; originalen
er uendret. `build:branding` er et lokalt verktøy som ikke publiserer noe.

Hederssiden er fortsatt skjult fra offentlig navigasjon og har
`noindex, nofollow`. En URL er ikke tilgangsbeskyttelse. Ingen adminlenke eller
offentlig diplomutsteder innføres.

Stor modularisering av `index.html` utsettes til en separat, avgrenset oppgave.
