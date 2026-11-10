# Oppdatere hederslisten

Navnene ligger i `data/honors.json`, atskilt fra bildefilene i `data/badges.json`. Hederssiden henter filen ved lasting; flere navn krever ingen endring i JavaScript eller historikkfilen.

## Flere dugnadshelter

Legg til en post i `groups` → gruppen med `id: "volunteers"` → `members`:

```json
{"id": "nytt-unikt-navn", "name": "Fornavn Etternavn", "status": "provisional", "reason": null}
```

- `id`: unik intern nøkkel. Behold nøkkelen ved senere navneretting.
- `name`: navnet som vises.
- `status`: `provisional` gir «Foreløpig oppført». Endre til `confirmed` når oppføringen er endelig bekreftet.
- `reason`: `null` når begrunnelse ikke er gitt, eller en bekreftet tekst som vises under navnet. Ikke legg til biografi eller påstander uten grunnlag.

Listen vises i filens rekkefølge. Hver person skal ha en unik nøkkel. Bruk gyldig JSON med komma mellom postene. Oppføringer i hederslisten påvirker aldri løper-ID-er, resultater, deltakelsesmerker eller statistikk.

## Nåværende grunnlag

- Dugnadshelter, foreløpig: Dag Morten Frantzen og Håkon Lohne.
- Bekreftede grunnleggere: Oscar Lohne, Helge Andersen, Arnfinn Håverstad og Einar Danielsen.
- Tre merkekategorier i den skjulte forhåndsvisningen: Dugnadshelt, Hedersildsjel og Grunnlegger. V2-instruksen erstatter den tidligere avklaringen om to synlige kategorier; ingen nye mottakere er utledet.

Grunnleggernes rolle er bekreftet av brukeren. Merkedesign og diplomer er fortsatt lokale utkast; listen er ikke en påstand om at et diplom er utstedt. Begrunnelser er ikke oppfunnet. Diplomeksemplet er lukket ved første visning og kan åpnes separat.

Fellesregisteret og maskebeskrivelsen markerer dessuten at den røde buen på 30-merket skal beholdes. Bildepikslene er ikke endret av avklaringen.

## Kontroller

`node --test tests/honors.cjs tests/badges.cjs tests/diplomas.cjs`

Testene dekker dagens navn/status, mobil/PC, at et nytt navn fra datafilen dukker opp uten kodeendring, HTML-escaping, dupliserte nøkler, bekreftet rød bue og eksisterende merke-/diplomfunksjoner.

## Hedersprofiler og kilder

Alle navn åpner en egen profil på `heder.html#person/<id>`. Oscar-eksemplet ligger på `heder.html#person/oscar-lohne`. Profilen viser rollen fra den bekreftede/foreløpige oppføringen, kildeangivelsen og riktig merkebilde fra fellesregisteret. Hedersidentiteter slås ikke sammen med løper-ID-er etter navn.

`roleSource` dokumenterer grunnlaget for rolleoppføringen. Valgfrie historier legges i `stories`:

```json
{"title":"Overskrift", "text":"Dokumentert historie", "source":"Navngitt kilde eller dokument", "confirmed":true}
```

Bare historier med `confirmed: true` og en ikke-tom kilde vises. Ingen historier er oppfunnet i denne oppdateringen; dagens profiler sier at ingen dokumentert historie er lagt til ennå. En ubekreftet oppføring kan ikke legges inn som grunnlegger.

Diplomvalg er personbundet: grunnleggere får grunnleggerdiplom, foreløpige dugnadshelter får foreløpig dugnadsutkast. Alle hedersdiplomer kan bare forhåndsvises. Den offentlige siden har ingen utskrifts-/PDF-knapper for hedersdiplomer, og iframe-sandkassen tillater ikke utskriftsdialog. Utkaststatus og «ikke utstedt» står utenfor selve diplomdesignet. Det seremonielle A4-utkastet har medalje og en kort hederstekst, uten store tekniske statusfelt. Dette tildeler ikke et merke eller utsteder et diplom. Individuelle, opptjente merkediplomer har fortsatt sin separate utskriftsfunksjon.

Grunnleggerillustrasjonen er korrigert i den eksisterende SVG-masteren ved å fjerne den separate horisontale streken som krysset «1992». Ingen andre SVG-elementer er endret. Den samme vektorkilden er rendret til transparent 2400 × 2400 PNG for alle aktive visninger.

## Skjult forhåndsvisning og senere lansering

`heder.html` er tilgjengelig via direkte adresse, med `noindex, nofollow` og en utviklingsmelding. Det finnes ingen inngående lenke fra offentlig hovedmeny, mobilmeny eller løperprofiler, og siden skal ikke legges i sitemap. Dette er ikke tilgangsbeskyttelse: både side og data kan leses av alle som kjenner adressen. Ingen private historier, portretter eller roller utledes.

Ved en senere godkjent lansering settes `HONORS_NAVIGATION_ENABLED` til `true` i `js/navigation.js`. Det aktiverer én lenke i hver av hoved- og mobilmenyen. Vurder også indeksering og utviklingsmelding ved lanseringen; ikke endre disse automatisk. Ingen synlig adminlenke eller administrasjonsfunksjon er lagt til.

Oscar Lohnes rolle har særskilt grunnlag i arrangørens tidligere navngitte grunnleggerliste i samtalen. Rollen er ikke utledet fra løpsresultater. Ingen portrett- eller biografisk opplysning er lagt til. Grunnleggermerket med rettet «1992» er byte-uendret i V2.
