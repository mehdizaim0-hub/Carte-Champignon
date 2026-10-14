import urllib.request, urllib.parse
IGN="https://data.geopf.fr/wms-v/ows"; L="LANDCOVER.FORESTINVENTORY.V2"
def get(params,out):
    q=urllib.parse.urlencode(params); req=urllib.request.Request(IGN+"?"+q,headers={"User-Agent":"carte-champignons/1.0"})
    b=urllib.request.urlopen(req,timeout=90).read(); open(out,"wb").write(b); print(out,len(b),b[:12])
base={"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetMap","LAYERS":L,"STYLES":"","CRS":"EPSG:4326","FORMAT":"image/png","TRANSPARENT":"TRUE"}
# Bouconne (43.667N, 1.10E) : bbox 0.12 x 0.12 deg, 4 résolutions
for n,px in (("a",96),("b",384)):
    get(dict(base,BBOX="43.59,1.04,43.73,1.18",WIDTH=px,HEIGHT=px),"tools/bouconne_%s.png"%n)
# La maille entière (43.65,1.14) comme build_forets : 96 px
get(dict(base,BBOX="43.575,1.05,43.725,1.23",WIDTH=96,HEIGHT=96),"tools/cell_96.png")
get(dict(base,BBOX="43.575,1.05,43.725,1.23",WIDTH=480,HEIGHT=480),"tools/cell_480.png")
# légende
try:
    get({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetLegendGraphic","LAYER":L,"FORMAT":"image/png","STYLE":""},"tools/legend.png")
except Exception as e: print("legende",e)
# même zone avec fond OSM-like pour repère : couche plan IGN
get({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetMap","LAYERS":"GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2","STYLES":"","CRS":"EPSG:4326","BBOX":"43.59,1.04,43.73,1.18","WIDTH":384,"HEIGHT":384,"FORMAT":"image/png"},"tools/bouconne_plan.png")
