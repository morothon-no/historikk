#!/usr/bin/env python3
"""Apply explicit native-coordinate alpha masks. Original RGB and resolution stay unchanged."""
from pathlib import Path
from PIL import Image
import json,subprocess,hashlib
r=Path(__file__).resolve().parent.parent
inventory=json.loads((r/'assets/medals/source-inventory.json').read_text())
config=json.loads((r/'assets/medals/review/cutouts/masks.json').read_text());results=[]
for mask in config['masks']:
 source=next(c for c in inventory['candidates'] if c['id']==mask['id'] and c['highestAvailable'])
 w,h=source['width'],source['height'];folder=r/'assets/medals/review/cutouts';stem=mask['id']
 svg=folder/f'{stem}-mask.svg';alpha=folder/f'{stem}-alpha.png';out=folder/f'{stem}.png'
 svg.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="black"/><path d="{mask["path"]}" fill="white"/></svg>\n')
 subprocess.run(['env','XDG_CONFIG_HOME=/tmp/morothon-mask-config','XDG_CACHE_HOME=/tmp/morothon-mask-cache','inkscape',str(svg),'--export-type=png','--export-filename='+str(alpha),'--export-width='+str(w),'--export-height='+str(h)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 subprocess.run(['convert',str(r/source['file']),str(alpha),'-alpha','off','-compose','CopyOpacity','-composite','PNG32:'+str(out)],check=True)
 # Read-only verification: every source RGB pixel must survive, including the transparent region.
 a=Image.open(r/source['file']).convert('RGB');b=Image.open(out).convert('RGBA');assert a.size==b.size
 assert a.tobytes()==b.convert('RGB').tobytes(),f'RGB changed for {stem}'
 channels=b.getchannel('A');visible=channels.point(lambda v:255 if v>32 else 0);bbox=visible.getbbox()
 results.append(dict(id=stem,source=source['file'],sourceSha256=source['sha256'],src=str(out.relative_to(r)),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),width=w,height=h,visibleBounds=bbox,nativeRgbPreserved=True,resized=False,generatedMotif=False,status='review-pending',printReady=False,notes=['Manuell konservativ maske. Kantrester og mulige avvik i masken må vurderes visuelt.','Originalens fotografiske detaljer er uendret; nye detaljer er ikke oppfunnet.']))
(r/'assets/medals/review/cutouts/manifest.json').write_text(json.dumps(dict(schemaVersion=1,method=config['method'],cutouts=results),ensure_ascii=False,indent=2)+'\n')
registryPath=r/'data/badges.json';registry=json.loads(registryPath.read_text())
for item in results:
 badge=next(b for b in registry['badges'] if b['id']==item['id'])
 bbox=Image.open(r/item['src']).getchannel('A').getbbox()
 dpi=max(bbox[2]-bbox[0],bbox[3]-bbox[1])/55*25.4
 badge['controlledCutoutDraft']=dict(src=item['src'],sha256=item['sha256'],originalSource=item['source'],originalSha256=item['sourceSha256'],status='review-pending',printReady=False,nativeRgbPreserved=True,effectiveDpiAt55Mm=round(dpi,2))
registryPath.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cutouts':len(results),'rgbPreserved':all(c['nativeRgbPreserved'] for c in results)}))
