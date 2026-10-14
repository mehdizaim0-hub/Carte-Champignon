import urllib.request, urllib.parse, json, re
UA={"User-Agent":"carte-champignons/1.0 (https://github.com/mehdizaim0-hub/Carte-Champignon)","Origin":"https://mehdizaim0-hub.github.io"}
titles=["Boletus_edulis","Cantharellus_cibarius","Morchella_esculenta","Craterellus_cornucopioides","Hydnum_repandum","Lactarius_deliciosus","Imleria_badia","Craterellus_tubaeformis","Macrolepiota_procera"]
for lang in ("fr","en"):
    print("=====",lang)
    for t in titles:
        try:
            req=urllib.request.Request("https://%s.wikipedia.org/api/rest_v1/page/summary/%s"%(lang,t),headers=UA)
            r=urllib.request.urlopen(req,timeout=30); j=json.load(r)
            th=j.get("thumbnail",{}); oi=j.get("originalimage",{})
            print(t.ljust(28),"ACAO=",r.headers.get("Access-Control-Allow-Origin"),"|",j.get("title"),"|",(th.get("source") or "pas d'image")[:150],"|",th.get("width"),"x",th.get("height"))
        except Exception as e: print(t,"ERREUR",e)
# métadonnées de licence pour un fichier (cèpe, en)
try:
    j=json.load(urllib.request.urlopen(urllib.request.Request("https://en.wikipedia.org/api/rest_v1/page/summary/Boletus_edulis",headers=UA),timeout=30))
    src=(j.get("originalimage") or j.get("thumbnail"))["source"]; fn=urllib.parse.unquote(src.split("/")[-1] if "/thumb/" not in src else src.split("/thumb/")[1].split("/")[2])
    print("fichier:",fn)
    u="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode({"action":"query","titles":"File:"+fn,"prop":"imageinfo","iiprop":"extmetadata","format":"json","origin":"*"})
    r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30); k=json.load(r)
    pg=list(k["query"]["pages"].values())[0]["imageinfo"][0]["extmetadata"]
    print("ACAO commons:",r.headers.get("Access-Control-Allow-Origin"),"| Artist:",re.sub("<[^>]+>","",pg.get("Artist",{}).get("value",""))[:80],"| Licence:",pg.get("LicenseShortName",{}).get("value"))
except Exception as e: print("ERREUR méta",e)
