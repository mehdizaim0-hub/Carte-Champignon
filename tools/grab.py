import urllib.request, urllib.parse, time, colorsys, sys
sys.path.insert(0,'.')
import build_forets as bf
IGN="https://data.geopf.fr/wms-v/ows"; L="LANDCOVER.FORESTINVENTORY.V2"
def cov(w,h,px):
    t=0
    for row in px:
        for r,g,b,a in row:
            if a<128: continue
            hh,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255); hh*=360
            if s<.35 or 25<=hh<66: continue
            t+=1
    return 100*t/(w*h)
cells={"Bouconne (43.65,1.14)":(43.65,1.14),"Beauce (48.2,1.8)":(48.2,1.8),"Landes (44.25,-0.9)":(44.25,-0.9),"Gers (43.65,0.5)":(43.65,0.5),"Vosges (48.1,6.9)":(48.1,6.9)}
for name,(la,lo) in cells.items():
    print("==",name)
    for px in (96,192,288,480,720,960):
        q=urllib.parse.urlencode({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetMap","LAYERS":L,"STYLES":"","CRS":"EPSG:4326","FORMAT":"image/png","TRANSPARENT":"TRUE",
            "BBOX":"%f,%f,%f,%f"%(la-.075,lo-.09,la+.075,lo+.09),"WIDTH":px,"HEIGHT":px})
        t=time.time()
        try:
            b=urllib.request.urlopen(urllib.request.Request(IGN+"?"+q,headers={"User-Agent":"carte-champignons/1.0"}),timeout=120).read(); dt=time.time()-t
            t=time.time(); w,h,p=bf.png_decode(b); dd=time.time()-t
            print("  %4d px : couverture %5.1f %% | %6d Ko | requête %.2fs | décodage %.2fs"%(px,cov(w,h,p),len(b)//1024,dt,dd),flush=True)
        except Exception as e: print("  %4d px : ERREUR %s"%(px,e),flush=True)
