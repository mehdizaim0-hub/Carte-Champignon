import sys, json, time, collections, urllib.request, urllib.parse, random
sys.path.insert(0,'tools')
import importlib.util
spec=importlib.util.spec_from_file_location("ex","tools/explore_ign.py")
src=open("tools/explore_ign.py").read().split('print("=== Capabilities')[0]   # réutiliser get() et png_decode()
ns={}; exec(src,ns); get=ns["get"]; png_decode=ns["png_decode"]
IGN="https://data.geopf.fr/wms-v/ows"; LAYER="LANDCOVER.FORESTINVENTORY.V2"
def getmap(bbox,w,h):
    q=urllib.parse.urlencode({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetMap","LAYERS":LAYER,"STYLES":"","CRS":"EPSG:4326",
        "BBOX":"%f,%f,%f,%f"%bbox,"WIDTH":w,"HEIGHT":h,"FORMAT":"image/png","TRANSPARENT":"TRUE"})
    for k in range(3):
        try: return png_decode(get(IGN+"?"+q)[0])
        except Exception as e: err=e; time.sleep(2)
    raise err
print("=== CORS (en-tetes insensibles à la casse)")
O={"Origin":"https://mehdizaim0-hub.github.io"}
tests={"ign":IGN+"?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS="+LAYER+"&STYLES=&CRS=EPSG:4326&BBOX=43.6,1.1,43.7,1.2&WIDTH=8&HEIGHT=8&FORMAT=image/png",
 "open-meteo":"https://api.open-meteo.com/v1/forecast?latitude=43.66&longitude=1.13&daily=precipitation_sum&past_days=40&forecast_days=8",
 "soilgrids":"https://rest.isric.org/soilgrids/v2.0/properties/query?lon=1.13&lat=43.66&property=phh2o&depth=0-5cm&value=mean"}
for k,u in tests.items():
    try:
        req=urllib.request.Request(u,headers=dict({"User-Agent":"x"},**O))
        with urllib.request.urlopen(req,timeout=60) as r: print(k,r.status,"ACAO =",r.headers.get("Access-Control-Allow-Origin"),"| ACAH =",r.headers.get("Access-Control-Allow-Headers"))
    except Exception as e: print(k,"ERREUR",e)
print("=== couleur GetMap -> type de forêt (terrain.json, échantillon)")
T=json.load(open("terrain.json")); by={"f":[],"r":[],"m":[]}
for key,v in T.items():
    if v["fo"] in by: la,lo=map(float,key.split(",")); by[v["fo"]].append((la,lo))
random.seed(1); mp=collections.defaultdict(collections.Counter)
for cls,pts in by.items():
    for la,lo in random.sample(pts,min(70,len(pts))):
        d=0.0004
        try:
            w,h,px=getmap((la-d,lo-d,la+d,lo+d),5,5); c=px[2][2]
            mp[c[:3]][cls]+=1 if c[3]>200 else 0
        except Exception as e: print("err",e)
rows=sorted(mp.items(),key=lambda kv:-sum(kv[1].values()))[:14]
for c,cnt in rows: print("  couleur",c,dict(cnt))
json.dump({str(k):dict(v) for k,v in mp.items()},open("tools/color_map.json","w"))
print("=== Open-Meteo : 40 mailles x (40 passés + 8 prévus) x 5 variables")
qs=urllib.parse.urlencode({"latitude":",".join(str(round(43+i*.1,2)) for i in range(40)),"longitude":",".join(str(round(1+i*.1,2)) for i in range(40)),
 "daily":"precipitation_sum,temperature_2m_mean,temperature_2m_min,soil_moisture_0_to_10cm_mean,et0_fao_evapotranspiration","past_days":40,"forecast_days":8,"timezone":"Europe/Paris"})
for k in range(4):
    t=time.time()
    try:
        req=urllib.request.Request("https://api.open-meteo.com/v1/forecast?"+qs,headers={"User-Agent":"x"})
        with urllib.request.urlopen(req,timeout=120) as r:
            b=r.read(); j=json.loads(b)
        print("  essai",k+1,"OK en %.1fs"%(time.time()-t),len(j),"mailles,",len(j[0]["daily"]["time"]),"jours,",len(b)//1024,"Ko")
        break
    except Exception as e: print("  essai",k+1,"echec",e); time.sleep(10)
