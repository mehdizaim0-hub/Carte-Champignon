import urllib.request, urllib.parse, zlib, struct, re, collections, json, sys
UA={"User-Agent":"carte-champignons/1.0"}
def get(url,headers=None,timeout=40):
    h=dict(UA); h.update(headers or {})
    req=urllib.request.Request(url,headers=h)
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.read(), dict(r.headers), r.status
def png_decode(b):
    assert b[:8]==b'\x89PNG\r\n\x1a\n', "pas un PNG: %r"%b[:60]
    pos=8; ihdr=None; plte=None; trns=None; idat=b''
    while pos<len(b):
        ln,=struct.unpack('>I',b[pos:pos+4]); typ=b[pos+4:pos+8]; dat=b[pos+8:pos+8+ln]; pos+=12+ln
        if typ==b'IHDR': ihdr=struct.unpack('>IIBBBBB',dat)
        elif typ==b'PLTE': plte=dat
        elif typ==b'tRNS': trns=dat
        elif typ==b'IDAT': idat+=dat
    w,h,bd,ct,_,_,il=ihdr
    assert bd==8 and il==0, "png non gere bd=%s il=%s"%(bd,il)
    ch={0:1,2:3,3:1,4:2,6:4}[ct]; raw=zlib.decompress(idat); stride=w*ch; out=[]; prev=bytearray(stride); p=0
    for _ in range(h):
        f=raw[p]; line=bytearray(raw[p+1:p+1+stride]); p+=1+stride
        for i in range(stride):
            a=line[i-ch] if i>=ch else 0; up=prev[i]; c=prev[i-ch] if i>=ch else 0
            if f==1: line[i]=(line[i]+a)&255
            elif f==2: line[i]=(line[i]+up)&255
            elif f==3: line[i]=(line[i]+((a+up)>>1))&255
            elif f==4:
                pa=abs(up-c); pb=abs(a-c); pc=abs(a+up-2*c)
                pr=a if (pa<=pb and pa<=pc) else (up if pb<=pc else c)
                line[i]=(line[i]+pr)&255
        out.append(line); prev=line
    px=[]
    for line in out:
        row=[]
        for x in range(w):
            if ct==6: row.append(tuple(line[x*4:x*4+4]))
            elif ct==2: row.append(tuple(line[x*3:x*3+3])+(255,))
            elif ct==3:
                i=line[x]; r,g,bb=plte[i*3:i*3+3]; a=trns[i] if trns and i<len(trns) else 255; row.append((r,g,bb,a))
            elif ct==0: row.append((line[x],)*3+(255,))
            else: row.append((line[x*2],)*3+(line[x*2+1],))
        px.append(row)
    return w,h,px
print("=== Capabilities (couches foret / occupation du sol)")
try:
    xml,_,_=get("https://data.geopf.fr/wms-v/ows?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0",timeout=90)
    names=re.findall(rb"<Name>([^<]+)</Name>",xml)
    for n in names:
        s=n.decode()
        if re.search(r"FOREST|LANDCOVER|CLC|OCSGE|BDFORET|FORET",s,re.I): print("  ",s)
    print("  total couches:",len(names))
except Exception as e: print("ERREUR capabilities",e)
print("=== Bouconne (43.66N,1.13E) bbox 0.10 deg, GetMap 48x48")
for layer in ["LANDCOVER.FORESTINVENTORY.V2"]:
    d=0.05
    q=urllib.parse.urlencode({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetMap","LAYERS":layer,"STYLES":"","CRS":"EPSG:4326",
        "BBOX":"%f,%f,%f,%f"%(43.66-d,1.13-d,43.66+d,1.13+d),"WIDTH":48,"HEIGHT":48,"FORMAT":"image/png","TRANSPARENT":"TRUE"})
    try:
        b,h,s=get("https://data.geopf.fr/wms-v/ows?"+q)
        print(layer,"status",s,"type",h.get("Content-Type"),"octets",len(b))
        w,hh,px=png_decode(b)
        cnt=collections.Counter(p for row in px for p in row)
        print("  taille",w,hh,"couleurs distinctes",len(cnt))
        for c,n in cnt.most_common(12): print("   ",c,n)
        pal={c:chr(ord('a')+i) for i,(c,_) in enumerate(cnt.most_common(12))}
        for row in px[::2]: print("   "+"".join('.' if p[3]==0 else pal.get(p,'?') for p in row[::1]))
    except Exception as e: print("ERREUR GetMap",layer,e)
print("=== GetFeatureInfo au centre de Bouconne")
d=0.004
q=urllib.parse.urlencode({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetFeatureInfo","LAYERS":"LANDCOVER.FORESTINVENTORY.V2","QUERY_LAYERS":"LANDCOVER.FORESTINVENTORY.V2","CRS":"EPSG:4326","BBOX":"%f,%f,%f,%f"%(43.66-d,1.13-d,43.66+d,1.13+d),"WIDTH":10,"HEIGHT":10,"I":5,"J":5,"INFO_FORMAT":"application/json"})
try:
    b,h,s=get("https://data.geopf.fr/wms-v/ows?"+q); print(s,b[:700])
except Exception as e: print("ERREUR",e)
print("=== CORS (navigateur sur github.io)")
O={"Origin":"https://mehdizaim0-hub.github.io"}
tests={"ign GetMap":"https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=LANDCOVER.FORESTINVENTORY.V2&QUERY_LAYERS=LANDCOVER.FORESTINVENTORY.V2&CRS=EPSG:4326&BBOX=43.656,1.126,43.664,1.134&WIDTH=10&HEIGHT=10&I=5&J=5&INFO_FORMAT=application/json",
 "open-meteo":"https://api.open-meteo.com/v1/forecast?latitude=43.66&longitude=1.13&daily=precipitation_sum&past_days=40&forecast_days=8",
 "soilgrids":"https://rest.isric.org/soilgrids/v2.0/properties/query?lon=1.13&lat=43.66&property=phh2o&depth=0-5cm&value=mean"}
for k,u in tests.items():
    try:
        b,h,s=get(u,O,timeout=60); print(k,s,"ACAO=",h.get("Access-Control-Allow-Origin"),"octets",len(b))
    except Exception as e: print(k,"ERREUR",e)
# test poids/limites Open-Meteo : 40 jours passes, 5 variables, 40 mailles
try:
    qs=urllib.parse.urlencode({"latitude":",".join(str(43+i*.1) for i in range(40)),"longitude":",".join(str(1+i*.1) for i in range(40)),"daily":"precipitation_sum,temperature_2m_mean,temperature_2m_min,soil_moisture_0_to_10cm_mean,et0_fao_evapotranspiration","past_days":40,"forecast_days":8,"timezone":"Europe/Paris"})
    b,h,s=get("https://api.open-meteo.com/v1/forecast?"+qs,timeout=90); j=json.loads(b)
    print("open-meteo 40 mailles x 48 jours",s,len(j),"mailles; jours",len(j[0]["daily"]["time"]),"en-tetes limite:",{k:v for k,v in h.items() if "limit" in k.lower() or "retry" in k.lower()})
except Exception as e: print("open-meteo lot ERREUR",e)
