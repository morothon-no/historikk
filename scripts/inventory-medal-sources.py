from pathlib import Path
from PIL import Image
import subprocess,re,json,base64,io,hashlib,collections
root=Path(__file__).resolve().parent.parent; candidates={}; seen=set(); scanned=[]
def add(data,label,origin):
 try:
  im=Image.open(io.BytesIO(data)); w,h=im.size
 except Exception:return
 digest=hashlib.sha256(data).hexdigest();key=(label,digest)
 if key in candidates:
  candidates[key]['sources'].append(origin);return
 candidates[key]=dict(id=label,width=w,height=h,sha256=digest,format=im.format,sources=[origin],data=data)
def html(data,origin):
 text=data.decode('utf-8',errors='replace')
 m=re.search(r'const BADGE_IMAGES\s*=\s*(\{.*?\});',text)
 if m:
  try:
   for n,src in json.loads(m.group(1)).items():add(base64.b64decode(src.split(',')[1]),'badge-'+str(n),origin+':BADGE_IMAGES['+str(n)+']')
  except Exception:pass
 for name,label in [('RECORD_BADGE_IMAGE','record'),('RUNNER_IMAGE','runner'),('SHARE_LOGO_IMAGE','logo')]:
  m=re.search(r"(?:const|let) "+name+r"\s*=\s*['\"](data:image/[^'\"]+)['\"]",text)
  if m:add(base64.b64decode(m.group(1).split(',')[1]),label,origin+':'+name)
for line in subprocess.check_output(['git','rev-list','--objects','--all'],cwd=root,text=True).splitlines():
 parts=line.split(' ',1)
 if len(parts)!=2:continue
 oid,name=parts
 if not name.lower().endswith(('.html','.png','.webp','.jpg','.jpeg','.svg')):continue
 data=subprocess.check_output(['git','cat-file','blob',oid],cwd=root);scanned.append(dict(blob=oid,path=name))
 if name.endswith('.html'):html(data,'git:'+oid+':'+name)
 else:add(data,'unclassified','git:'+oid+':'+name)
html((root/'index.html').read_bytes(),'working:index.html')
# Existing canonical originals are the immutable local sources; legacy duplicate folders are not required.
for p in (root/'assets/medals/originals').glob('*'):
 label=p.stem.split('-')[0]
 if p.name.startswith('badge-'):label='badge-'+p.name.split('-')[1]
 add(p.read_bytes(),label,str(p.relative_to(root)))
summary=[]
for label in ['badge-'+str(n) for n in range(5,51,5)]+['record','runner']:
 items=[v for v in candidates.values() if v['id']==label];items.sort(key=lambda c:(min(c['width'],c['height']),c['width']*c['height']),reverse=True)
 for i,c in enumerate(items):
  ext=c['format'].lower(); name=f'{label}-{c["width"]}x{c["height"]}-{c["sha256"][:10]}.{ext}'
  path=root/'assets/medals/originals'/name;path.write_bytes(c.pop('data'));c['file']=str(path.relative_to(root));c['highestAvailable']=i==0;summary.append(c)
report=dict(gitHtmlAndImageBlobsScanned=len(scanned),gitCommitsAvailable=int(subprocess.check_output(['git','rev-list','--all','--count'],cwd=root,text=True)),scanned=scanned,candidates=summary)
(root/'assets/medals/source-inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'gitBlobs':len(scanned),'gitCommits':report['gitCommitsAvailable'],'candidates':[{k:c[k] for k in ['id','width','height','highestAvailable']} for c in summary]},indent=2))
