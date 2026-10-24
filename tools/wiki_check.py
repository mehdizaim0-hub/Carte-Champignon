import json, urllib.request, urllib.parse, re
UA={"User-Agent":"carte-champignons/1.0 (https://github.com/mehdizaim0-hub/Carte-Champignon)","Origin":"https://mehdizaim0-hub.github.io"}
titles=["Boletus_reticulatus","Russula_cyanoxantha","Suillus_luteus","Armillaria_mellea","Pleurotus_ostreatus","Agaricus_campestris","Calocybe_gambosa","Marasmius_oreades"]
for t in titles:
    row=[t.ljust(22)]
    for lang in ("fr","en"):
        try:
            j=json.load(urllib.request.urlopen(urllib.request.Request("https://%s.wikipedia.org/api/rest_v1/page/summary/%s"%(lang,t),headers=UA),timeout=30))
            th=(j.get("thumbnail") or {}).get("source")
            if th:
                path=urllib.parse.urlparse(th).path
                fn=urllib.parse.unquote(path.split("/thumb/")[1].split("/")[2]) if "/thumb/" in path else urllib.parse.unquote(path.split("/")[-1])
                m=json.load(urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode({"action":"query","titles":"File:"+fn,"prop":"imageinfo","iiprop":"extmetadata","format":"json","origin":"*"}),headers=UA),timeout=30))
                ii=list(m["query"]["pages"].values())[0]["imageinfo"][0]["extmetadata"]
                row.append("%s: %s | %s | %s"%(lang,j.get("title"),re.sub("<[^>]+>","",ii.get("Artist",{}).get("value",""))[:28],ii.get("LicenseShortName",{}).get("value")))
            else: row.append("%s: PAS D'IMAGE (%s)"%(lang,j.get("title")))
        except Exception as e: row.append("%s: ERREUR %s"%(lang,str(e)[:40]))
    print(" || ".join(row))
