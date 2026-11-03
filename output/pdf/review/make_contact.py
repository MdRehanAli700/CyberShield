from PIL import Image, ImageDraw
from pathlib import Path
p=Path(r'C:\Users\Mdreh\Documents\Codex\2026-10-12\CyberShield\output\pdf\review')
fs=sorted(p.glob('page-*.png'))
out=Image.new('RGB',(960,850),'#dce5ec'); d=ImageDraw.Draw(out)
for i,f in enumerate(fs):
 im=Image.open(f).convert('RGB'); im.thumbnail((306,396)); x=10+(i%3)*318; y=28+(i//3)*410; out.paste(im,(x,y)); d.text((x,y-18),f.name,fill='#102a43')
out.save(p/'contact.png')
