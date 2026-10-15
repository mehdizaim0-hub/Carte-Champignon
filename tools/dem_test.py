import sys, time, io, math, struct, zlib, urllib.request, subprocess
UA={"User-Agent":"carte-champignons/1.0"}
print("=== 1. Tuiles AWS Terrain (terrarium, z10) autour de Toulouse")
def tile(z,lat,lon):
    n=2**z; x=int((lon+180)/360*n); y=int((1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n); return x,y
for z,(la,lo) in ((10,(43.6,1.44)),(10,(45.9,6.9))):
    x,y=tile(z,la,lo); url="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%d/%d/%d.png"%(z,x,y)
    try:
        t=time.time(); b=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60).read(); print(url,"OK",len(b)//1024,"Ko en %.2fs"%(time.time()-t))
    except Exception as e: print(url,"ERREUR",e)
print("=== 2. Copernicus GLO-30 (COG sur AWS) : une tuile 1x1 degré")
subprocess.run([sys.executable,"-m","pip","install","-q","--break-system-packages","rasterio","numpy"],check=False)
try:
    import numpy as np, rasterio
    for (lat,lon) in ((43,1),(45,6)):
        name="Copernicus_DSM_COG_10_N%02d_00_E%03d_00_DEM"%(lat,lon)
        url="https://copernicus-dem-30m.s3.amazonaws.com/%s/%s.tif"%(name,name)
        t=time.time()
        with rasterio.open(url) as src:
            print(name,"taille",src.width,"x",src.height,"| ouverture %.1fs"%(time.time()-t),"| overviews",src.overviews(1))
            t=time.time(); a=src.read(1,out_shape=(src.height//3,src.width//3),resampling=rasterio.enums.Resampling.average)
            print("  lecture au tiers : %.1fs | alt min/médiane/max"%(time.time()-t),int(a.min()),int(np.median(a)),int(a.max()))
except Exception as e:
    import traceback; traceback.print_exc()
