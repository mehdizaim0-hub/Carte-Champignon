import urllib.request, urllib.parse, re, json
UA={"User-Agent":"carte-champignons/1.0"}
def get(url,timeout=120):
    return urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=timeout).read()
print("=== WFS : types de routes")
try:
    x=get("https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities").decode("utf8","replace")
    names=re.findall(r"<(?:wfs:)?Name>([^<]+)</(?:wfs:)?Name>",x)
    print(len(names),"types ; routes :",[n for n in names if re.search(r"troncon_de_route|route_numerotee|RESEAU_ROUTIER",n,re.I)][:12])
except Exception as e: print("ERREUR caps",e)
def wfs(params):
    return get("https://data.geopf.fr/wfs/ows?"+urllib.parse.urlencode(dict({"SERVICE":"WFS","VERSION":"2.0.0"},**params)))
print("=== échantillon troncon_de_route autour de Toulouse")
try:
    b=wfs({"REQUEST":"GetFeature","TYPENAMES":"BDTOPO_V3:troncon_de_route","OUTPUTFORMAT":"application/json","COUNT":300,"SRSNAME":"EPSG:4326","BBOX":"43.55,1.35,43.65,1.50,EPSG:4326"})
    j=json.loads(b);fs=j.get("features",[]);print(len(fs),"tronçons")
    from collections import Counter
    print("importance:",Counter(f["properties"].get("importance") for f in fs).most_common())
    print("nature:",Counter(f["properties"].get("nature") for f in fs).most_common(8))
    print("clés:",list(fs[0]["properties"].keys())[:30]);print("géométrie:",fs[0]["geometry"]["type"],str(fs[0]["geometry"]["coordinates"])[:120])
except Exception as e: print("ERREUR GetFeature",e)
print("=== nombre de tronçons par importance (France)")
for imp in ("1","2","3"):
    try:
        b=wfs({"REQUEST":"GetFeature","TYPENAMES":"BDTOPO_V3:troncon_de_route","RESULTTYPE":"hits","CQL_FILTER":"importance='%s'"%imp})
        print("importance",imp,re.search(rb'numberMatched="(\d+)"',b).group(1).decode() if re.search(rb'numberMatched="(\d+)"',b) else b[:200])
    except Exception as e: print("importance",imp,"ERREUR",e)
print("=== CORINE Land Cover 2018 : image + légende")
try:
    q=urllib.parse.urlencode({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetMap","LAYERS":"LANDCOVER.CLC18_FR","STYLES":"","CRS":"EPSG:4326","BBOX":"43.45,1.2,43.75,1.7","WIDTH":480,"HEIGHT":288,"FORMAT":"image/png","TRANSPARENT":"TRUE"})
    open("tools/clc_toulouse.png","wb").write(get("https://data.geopf.fr/wms-r/wms?"+q));print("clc_toulouse.png ok")
    q=urllib.parse.urlencode({"SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetLegendGraphic","LAYER":"LANDCOVER.CLC18_FR","FORMAT":"image/png"})
    open("tools/clc_legend.png","wb").write(get("https://data.geopf.fr/wms-r/wms?"+q));print("clc_legend.png ok")
except Exception as e: print("ERREUR CLC",e)
