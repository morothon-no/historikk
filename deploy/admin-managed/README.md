# Portabel Morothon-admin – ikke aktivert

Standard Node.js, OCI-container, miljøvariabler og privat filstore. Ingen
leverandør-SDK eller konto kreves av kjernelogikken. Se
[oppsett og få eierhandlinger](../../docs/admin-managed-90.md) og
[lagringskontrakt og flytting](../../docs/admin-storage-contract.md).

Bruk kun generert, kontrollert applikasjonspakke som Docker-build-context.
Ikke bygg/deploy checkoutet med administrative originaler og Git-historikk.
`managed-deployment.cjs bundle` lager en eksplisitt offentlig datapakke pluss
nødvendig serverkode, uten administrative originaler eller secrets.

`examples/fly/` er et valgfritt leverandøreksempel, ikke del av runtime eller
standardpakken. Ingen tjeneste, disk, deploy eller publisering opprettes automatisk.
