#!/usr/bin/env python3
"""Read-only image inspection. Does not remove backgrounds, upscale pixels or change motifs."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parent.parent
inventory=json.loads((ROOT/'assets/medals/source-inventory.json').read_text())
registry=json.loads((ROOT/'data/badges.json').read_text())
rows=[]
for badge in registry['badges']:
 if badge['kind'] not in ['participation','record']:continue
 candidate=next(c for c in inventory['candidates'] if c['id']==badge['id'] and c['highestAvailable'])
 p=ROOT/candidate['file'];im=Image.open(p).convert('RGBA');w,h=im.size;a=im.getchannel('A');hist=a.histogram();visible=a.point(lambda v:255 if v>32 else 0);bbox=visible.getbbox()
 edge=sum(a.getpixel((x,y))>32 for x in range(w) for y in [0,h-1])+sum(a.getpixel((x,y))>32 for y in range(1,h-1) for x in [0,w-1])
 clear=sum(hist[:1])/(w*h);transparent=hist[255]<w*h
 dpi=max(w/badge['widthMm'],h/badge['heightMm'])*25.4
 issues=[]
 if not transparent:issues.append('Ugjennomsiktig bildebakgrunn; må frilegges uten endring av motiv.')
 if dpi<300:issues.append('For liten for valgt diplomfelt ved 300 DPI. Større original trengs; oppskalering øker ikke kildekvaliteten.')
 if edge and transparent:issues.append('Synlig motiv berører bildekanten; kontroller beskjæring.')
 # Readiness requires a visually inspected source with this exact checksum in the shared registry.
 reviewed=badge.get('reviewedSha256')==candidate['sha256'] and badge.get('cropReviewed')
 correct=bool(transparent and not edge and reviewed)
 if not reviewed:issues.append('Frilegging og fullstendige ytterkanter er ikke visuelt godkjent for denne filen.')
 ready=bool(dpi>=300 and correct and badge.get('printReady') is True)
 rows.append(dict(id=badge['id'],name=badge['name'],source=candidate['file'],sha256=candidate['sha256'],width=w,height=h,transparent=transparent,fullyTransparentFraction=round(clear,5),visibleEdgePixels=edge,visibleBounds=bbox,correctCutout=correct,maxPrintMm300=[round(w/300*25.4,2),round(h/300*25.4,2)],diplomaBoxMm=[badge['widthMm'],badge['heightMm']],dpiAtDiplomaSize=round(dpi,2),printReady=ready,issues=issues,provenance=candidate['sources']))
report=dict(schemaVersion=1,motifProofReport='assets/medals/review/cutouts/proof-quality.json',gitCommitsInspected=inventory['gitCommitsAvailable'],gitImageAndHtmlBlobsInspected=inventory['gitHtmlAndImageBlobsScanned'],masterPackage=registry['masterPackage'],notes=['DPI gjelder originalens piksler ved contain i valgt felt. Maksimal trykkstørrelse gjelder hele bildeflaten.', 'RGB-kanaler under alpha=0 er ikke synlig bakgrunn. Alfakanal alene beviser ikke korrekt frilegging.', 'Kandidatene er aldri godkjent bare fordi de har nok piksler.'],medals=rows)
(ROOT/'assets/medals/quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
lines=['# Kvalitetsrapport – offisielle Morothon-medaljer','',f"Kilder: {report['gitCommitsInspected']} lokale commits, {report['gitImageAndHtmlBlobsInspected']} ulike HTML-/bildeblobs, arbeidskopien, tidligere lokale gjennomgangsfiler og master v2. Ingen større filer er lastet ned eller funnet hos en ekstern leverandør. Tilgjengelige lokale kilder er undersøkt; dette utelukker ikke større originaler hos arrangøren.",'','For vurdering av faktisk 55 mm medaljemotiv, se [kontrollert frilegging og A4-testark](medal-cutout-review.md). Tallene nedenfor gjelder hele kildefilen, inkludert luft/fotobakgrunn, og må ikke forveksles med detaljoppløsningen i selve medaljen.','', 'DPI beregnes fra native piksler. Ingen original er oppskalert eller tegnet om. Maksstørrelsene gjelder hele bildeflaten; selve medaljen er mindre hvis originalen har bakgrunn eller luft rundt.','', '| Merke | Native piksler | Alfa | Frilegging kontrollert | Maks ved 300 DPI | DPI for hele filen | Trykkklar |','|---|---:|---|---|---:|---:|---|']
for r in rows:lines.append(f"| {r['name']} | {r['width']} × {r['height']} | {'Ja' if r['transparent'] else 'Nei'} | {'Ja' if r['correctCutout'] else 'Nei'} | {r['maxPrintMm300'][0]:.1f} × {r['maxPrintMm300'][1]:.1f} mm | {r['dpiAtDiplomaSize']:.0f} | {'Ja' if r['printReady'] else 'Nei'} |")
for r in rows:
 lines+=['',f"## {r['name']}",'',f"Kilde: `{r['source']}`. SHA-256: `{r['sha256']}`.",f"Synlige kantpiksler: {r['visibleEdgePixels']}. Helt transparent bildeflate: {r['fullyTransparentFraction']*100:.1f} %."]
 lines += ['- '+i for i in r['issues']] if r['issues'] else ['Bildekontroll bestått ved oppgitt størrelse.']
(ROOT/'docs/medal-quality.md').write_text('\n'.join(lines)+'\n')
print(json.dumps({'medals':len(rows),'printReady':[r['id'] for r in rows if r['printReady']],'requiresCutout':[r['id'] for r in rows if not r['transparent']]}))
