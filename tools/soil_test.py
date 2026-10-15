import json, random, time, urllib.parse, urllib.request, subprocess, sys
UA={"User-Agent":"carte-champignons/1.0"}
print("=== lecture raster : rasterio + VRT SoilGrids")
subprocess.run([sys.executable,"-m","pip","install","-q","--break-system-packages","rasterio","numpy"],check=False)
try:
    import numpy as np, rasterio
    from rasterio.vrt import WarpedVRT
    from rasterio.enums import Resampling
    from rasterio.transform import from_origin
    print("rasterio",rasterio.__version__)
    for prop in ("clay","phh2o"):
        url="/vsicurl/https://files.isric.org/soilgrids/latest/data/%s/%s_0-5cm_mean.vrt"%(prop,prop)
        t=time.time()
        with rasterio.Env(GDAL_HTTP_MULTIPLEX="YES",GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",VSI_CACHE="TRUE"):
            with rasterio.open(url) as src:
                print(prop,"crs",src.crs.to_string()[:40],"taille",src.width,"x",src.height,"| ouverture %.1fs"%(time.time()-t))
                res=0.0125; lon0,lat1,lon1,lat0=1.0,44.0,2.0,43.0           # fenêtre 1° x 1°, pas de 0,0125°
                w=int((lon1-lon0)/res); h=int((lat1-lat0)/res)
                dst=from_origin(lon0,lat1,res,res)
                t=time.time()
                with WarpedVRT(src,crs="EPSG:4326",transform=dst,width=w,height=h,resampling=Resampling.average,nodata=src.nodata) as v:
                    a=v.read(1)
                print("  lecture 1°x1° (%dx%d) : %.1fs | valeurs min/médiane/max :"%(w,h,time.time()-t),a.min(),int(np.median(a)),a.max(),"| nodata",src.nodata)
except Exception as e:
    import traceback; traceback.print_exc()
