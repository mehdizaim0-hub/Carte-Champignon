import urllib.request, re
def caps(url):
    req=urllib.request.Request(url,headers={"User-Agent":"carte-champignons/1.0"})
    return urllib.request.urlopen(req,timeout=120).read().decode("utf8","replace")
pat=re.compile(r"LANDCOVER|CLC|OCSGE|BATI|BUILD|TRANSPORT|ROUTE|ROAD|URBAN|ARTIF|BDTOPO|BDUNI|OCS",re.I)
for name,url in (("WMS-V","https://data.geopf.fr/wms-v/ows?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0"),("WMS-R","https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0")):
    try:
        x=caps(url)
        layers=re.findall(r"<Layer[^>]*>\s*<Name>([^<]+)</Name>\s*<Title>([^<]*)</Title>",x)
        print("==",name,len(layers),"couches")
        for n,t in layers:
            if pat.search(n): print("  ",n,"|",t[:70])
    except Exception as e: print(name,"ERREUR",e)
