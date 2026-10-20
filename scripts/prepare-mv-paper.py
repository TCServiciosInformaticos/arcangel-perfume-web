"""Extract the owner's MV Rep 1.8 paper catalog without redrawing its product photos."""
import argparse,hashlib,io,json,re,unicodedata
from pathlib import Path
import fitz
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BRANDS=[['Higienol']*3+['Sussex','Elegante','Elegante','Elegante','Elegante','Belipel','Elegante','Elegante','Elegante'],['Elegante']*4+['Dicha']+['Elegante']*7,['Felpita','Felpita','Felpita','Cartabella','Felpita','Felpita','Nitidess']+['Newpel']*5]
EXPECTED_PRICES=[[17054,21700,30800,15680,11516,20668,21450,30025,9829,6070,10800,3450],[13811,29050,19999,19143,13227,13558,7324,13736,17348,10325,10190,11716],[14275,20850,27620,10976,17920,6884,10600,5720,18300,8802,14490,11482]]
PACKAGES={(1,10):(12,30,4),(1,11):(24,50,4),(1,12):(12,30,4),(2,7):(24,30,4),(3,6):(24,30,3)}
TEXT_RANGES=[[(244,307),(400,463),(540,604),(677,757)],[(232,296),(383,448),(534,614),(678,743)],[(232,297),(381,460),(557,621),(708,772)]]
def slug(s):return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('pdf',type=Path);args=ap.parse_args();raw=args.pdf.read_bytes();doc=fitz.open(stream=raw,filetype='pdf');assert len(doc)==3
 records=[]
 for pi,page in enumerate(doc):
  images=[x for x in page.get_image_info(xrefs=True) if 120<(x['bbox'][1]+x['bbox'][3])/2<760];assert len(images)==12
  images.sort(key=lambda x:(x['bbox'][1]+x['bbox'][3])/2);ordered=[]
  for row in range(4):ordered+=sorted(images[row*3:row*3+3],key=lambda x:x['bbox'][0])
  blocks=page.get_text('blocks')
  for i,info in enumerate(ordered):
   row,col=divmod(i,3);y0,y1=TEXT_RANGES[pi][row]
   blocks_in_card=[b for b in blocks if b[6]==0 and y0<=b[1]<y1 and int(((b[0]+b[2])/2)//200)==col]
   text='\n'.join(b[4].strip() for b in sorted(blocks_in_card,key=lambda b:b[1]))
   amounts=[int(m.replace('.','')) for m in re.findall(r'\$([0-9.]+)',text)];assert amounts and amounts[0]==EXPECTED_PRICES[pi][i],(pi,i,text,amounts)
   code=re.search(r'Código:[ \t]*([^\n]*)',text);code=code[1].strip() if code else '';code=code if re.fullmatch('[A-Za-z0-9]+',code) else None
   identifier=f'p{pi+1}-r{row+1}-c{col+1}';sid='mv-rep-1-8-'+identifier
   pix=fitz.Pixmap(doc,info['xref']);smask=next((x[1] for x in page.get_images(full=True) if x[0]==info['xref']),0)
   if smask:pix=fitz.Pixmap(pix,fitz.Pixmap(doc,smask))
   im=Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA');canvas=Image.new('RGB',im.size,'white');canvas.paste(im,mask=im.getchannel('A'))
   folder=ROOT/'public/catalog/mv-rep-1-8';folder.mkdir(parents=True,exist_ok=True)
   canvas.save(folder/(sid+'.webp'),'WEBP',quality=91,method=6);canvas.thumbnail((360,360));canvas.save(folder/(sid+'-thumb.webp'),'WEBP',quality=82,method=6)
   brand=BRANDS[pi][i];original=' '.join(text.split('Código:')[0].split());typ='Rollos de cocina' if ('Cocina' in original or 'Mega Rollo' in original) else 'Papel higiénico'
   package=PACKAGES.get((pi+1,i+1))
   if package:
    qty,meters,bulto=package
    label=('Papel higiénico '+('SuperPack' if (pi,i)==(2,5) else 'familiar' if qty==24 else 'valijita' if (pi,i)==(0,9) else ''))+f' — paquete de {qty} rollos x {meters} m'
   else:label=original
   # Prefix only brands not already in the source description.
   name=(brand+' ' if brand.lower() not in label.lower() else '')+label
   description=original+'.'
   if package:description+=f'\n\nPrecio por paquete de {qty} rollos de {meters} metros. El proveedor también indica bulto de {bulto} paquetes.'
   else:description+='\n\nPrecio por la presentación completa indicada.'
   if code:description+='\n\nCódigo del proveedor: '+code+'.'
   if 'aprox' in text:description+='\n\nLos metros son aproximados según la lista del proveedor.'
   records.append(dict(name=name,slug=sid,description=description,source_id=identifier,source_url='attachment:mv-rep-1-8/'+identifier,source_page=pi+1,source_position=i+1,source_text=text,source_code=code,source_price=amounts[0],price=round(amounts[0]*145/100,2),markup_percent=45,compare_at_price=None,brand=brand,brand_slug=slug(brand),category_slug='limpieza',product_type=typ,price_unit='paquete' if package else 'presentación indicada',bulto_packages=package[2] if package else None,image_xref=info['xref'],image_original_size=[info['width'],info['height']],image_urls=['/catalog/mv-rep-1-8/'+sid+'.webp'],thumbnail_url='/catalog/mv-rep-1-8/'+sid+'-thumb.webp'))
 data=dict(stage='prepared',count=len(records),source_filename=args.pdf.name,source_sha256=hashlib.sha256(raw).hexdigest(),pricing='published_pdf_plus_45_percent_per_indicated_presentation',products=records)
 (ROOT/'scripts/catalog-data/mv-paper-1-8.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print('Extracted',len(records),'cards and',2*len(records),'WebP files');print('Brands',sorted({p['brand'] for p in records}))
if __name__=='__main__':main()
