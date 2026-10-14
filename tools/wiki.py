import urllib.request, urllib.parse, json, re
UA={"User-Agent":"carte-champignons/1.0 (https://github.com/mehdizaim0-hub/Carte-Champignon)","Origin":"https://mehdizaim0-hub.github.io"}
for t in ["Boletus_edulis","Cantharellus_cibarius","Macrolepiota_procera"]:
    try:
        j=json.load(urllib.request.urlopen(urllib.request.Request("https://fr.wikipedia.org/api/rest_v1/page/summary/"+t,headers=UA),timeout=30))
        src=j["thumbnail"]["source"]; path=urllib.parse.urlparse(src).path
        fn=urllib.parse.unquote(path.split("/thumb/")[1].split("/")[2]) if "/thumb/" in path else urllib.parse.unquote(path.split("/")[-1])
        u="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode({"action":"query","titles":"File:"+fn,"prop":"imageinfo","iiprop":"extmetadata","format":"json","origin":"*"})
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30); k=json.load(r)
        ii=list(k["query"]["pages"].values())[0]["imageinfo"][0]["extmetadata"]
        print(t,"| fichier:",fn,"| ACAO:",r.headers.get("Access-Control-Allow-Origin"),"| Auteur:",re.sub("<[^>]+>","",ii.get("Artist",{}).get("value",""))[:70],"| Licence:",ii.get("LicenseShortName",{}).get("value"))
        big=src.replace("/330px-","/500px-"); rr=urllib.request.urlopen(urllib.request.Request(big,headers=UA),timeout=30); print("   500px :",rr.status,rr.headers.get("Content-Type"),len(rr.read())//1024,"Ko")
    except Exception as e: print(t,"ERREUR",repr(e))
