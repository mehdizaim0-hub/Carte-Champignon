// ---------- Tiroir mobile : constantes (placées en tête : la carte les utilise dès son initialisation) ----------
const mqMobile=window.matchMedia?window.matchMedia("(max-width:860px)"):{matches:false,addEventListener(){}};
const SHEET_MIN=132;
function sheetPx(n){return n==="peek"?SHEET_MIN:n==="full"?Math.round(innerHeight*.9):Math.round(innerHeight*.48)}
// 1er janvier : date par défaut de nombreuses observations GBIF sans jour connu. Pour les espèces qui ne poussent pas en hiver, janvier est ramené au niveau de février.
SP.forEach(sp=>{if(!sp.winter&&sp.n!=="Chanterelle en tube"&&sp.gb[0]>sp.gb[1])sp.gb[0]=sp.gb[1]});
// nom, lat, lon, altitude, sol (a acide, c calcaire, n neutre), forêt (f feuillus, r résineux, m mixte), microclimat
const REF=`Landes de Gascogne,44.2,-0.9,60,a,r,.1
Sologne,47.5,2.0,120,a,m,0
Fontainebleau,48.4,2.65,120,a,m,0
Forêt d'Orléans,47.9,2.2,120,a,m,0
Vosges (Gérardmer),48.07,6.87,700,a,r,.5
Jura (Risoux),46.55,6.1,1100,c,r,.4
Morvan,47.2,4.0,600,a,m,.4
Plateau de Millevaches,45.65,1.9,700,a,f,.5
Livradois-Forez,45.6,3.6,900,a,m,.3
Mont Aigoual,44.1,3.58,1200,a,m,.3
Périgord,45.0,0.9,150,c,f,0
Ariège,42.9,1.4,1100,c,m,.4
Forêt d'Iraty,43.0,-1.0,1000,a,f,.6
Montagne Noire,43.45,2.35,800,a,m,.3
Chartreuse,45.3,5.8,1100,c,r,.3
Queyras,44.7,6.8,1500,a,r,0
Mercantour,44.1,7.2,1400,c,m,.1
Sainte-Baume,43.3,5.7,600,c,m,.2
Luberon,43.8,5.4,400,c,m,-.3
Vizzavona (Corse),42.1,9.1,1100,a,r,.2
Paimpont (Bretagne),48.0,-2.2,150,a,m,.3
Forêt de Brotonne,49.5,0.8,80,c,f,.2
Ardennes,49.8,4.7,350,a,m,.3
Argonne,49.0,5.0,250,c,f,0
Forêt d'Orient,48.5,4.8,150,c,f,0
Cîteaux (Bourgogne),47.1,5.1,220,c,f,0
Forêt de Chaux,47.1,5.6,300,n,f,.2
Mervent (Vendée),46.6,-0.7,100,a,m,0
Double (Charente),45.1,0.2,100,a,m,.1
Gers,43.7,0.5,150,c,f,-.2
Lévézou (Aveyron),44.2,2.9,800,a,m,.2
Margeride (Lozère),44.7,3.5,1200,a,r,.2
Meygal (Haute-Loire),45.0,4.1,1100,a,r,.2
Tanargue (Ardèche),44.7,4.1,900,a,f,.3
Haguenau (Alsace),48.8,7.8,150,a,m,0
Mormal (Nord),50.2,3.65,130,c,f,0
Rambouillet,48.65,1.8,150,n,m,0`.split("\n").map(l=>{const p=l.split(",");return{n:p[0],lat:+p[1],lon:+p[2],alt:+p[3],so:p[4],fo:p[5],mi:+p[6]}});
let Z=REF.slice();
// ---------- Sol : pH continu, drainage déduit de la texture, humus ----------
// Données SoilGrids (250 m, moyennées par blocs de 2,8 km) : pH 0-5 cm, sable et argile 5-15 cm, carbone organique 0-5 cm.
// Le « drainage » est une déduction de la texture (argile > 35 % : engorgement ; sable > 80 % : sol séchant), sans pente ni nappe.
const clamp01=x=>Math.max(0,Math.min(1,x));
function soilFactor(sp,s){
  let fp=1,fd=1,fo=1;
  if(s.ph!=null&&sp.ph)fp=sp.pf+(1-sp.pf)*trap(s.ph,...sp.ph);
  if(s.clay!=null)fd-=sp.wc*clamp01((s.clay-35)/15);
  if(s.sand!=null)fd-=sp.ws*clamp01((s.sand-80)/15);
  if(s.soc!=null&&sp.soc)fo=.85+.15*clamp01((s.soc-sp.soc[0])/(sp.soc[1]-sp.soc[0]));
  fd=Math.max(.2,fd);
  return{f:fp*fd*fo,fp,fd,fo};
}
function texClass(sand,clay){
  if(sand==null||clay==null)return null;
  const silt=100-sand-clay;
  return clay>=35?"argileux":sand>=80?"sableux":sand>=55?"sablo-limoneux":silt>=50?"limoneux":"équilibré (limon, sable, argile)";
}
function drainClass(sand,clay){
  if(sand==null||clay==null)return null;
  return clay>=40?"lent (risque d'engorgement)":sand>=80?"très rapide (sol séchant)":"bon";
}
const fr1=v=>String(Math.round(v*10)/10).replace(".",",");
function soilModelText(sp){
  const L=["estimé","partiellement étayé","étayé par des études"],o=[`pH optimal ${fr1(sp.ph[1])} à ${fr1(sp.ph[2])} (${L[sp.evp]})`];
  o.push(`${sp.ws>=.3?"sable > 80 % nettement pénalisé":"sable > 80 %"} et argile > 35 % pénalisés (${L[sp.evt]})`);
  if(sp.soc)o.push(`humus favorable (${L[sp.evo||0]})`);
  return o.join(" ; ");
}
let SOL=null;
const SOIL={a:"acide",c:"calcaire",n:"neutre"},FOR={f:"feuillus",r:"résineux",m:"mixte"};
const CITIES={"Paris":[48.86,2.35],"Lyon":[45.76,4.84],"Marseille":[43.3,5.37],"Toulouse":[43.6,1.44],"Bordeaux":[44.84,-0.58],"Nantes":[47.22,-1.55],"Lille":[50.63,3.06],"Strasbourg":[48.58,7.75],"Nice":[43.7,7.26],"Rennes":[48.11,-1.68],"Clermont-Ferrand":[45.78,3.08],"Grenoble":[45.19,5.72],"Dijon":[47.32,5.04],"Limoges":[45.83,1.26]};
// ---------- Utilitaires ----------
const trap=(x,a,b,c,d)=>x<=a||x>=d?0:x<b?(x-a)/(b-a):x<=c?1:(d-x)/(d-c);
const clamp=x=>Math.max(0,Math.min(1,x));
const km=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r*Math.cos((a+c)*r/2);return 6371*Math.sqrt(x*x+y*y)};
const $=id=>document.getElementById(id);
const BASE=[5,6,9,12,15,19,21.5,21.5,18,14,9,6];
let st={cmp:-1,view:"dur",mode:"dots",past:14,pt:null,ptZ:null,ptTok:0,spTok:0,spots:null,spotData:null,forets:null,off:14,sp:0,day:0,rain:100,dt:0,live:null,sel:null,fetchedAt:null,dataDate:null};
const dateOf=d=>{const x=new Date();x.setDate(x.getDate()+d);return x};
// ---------- Météo ----------
// lag : la pluie qui compte est celle tombée lag à lag+14 jours avant la date visée.
function weather(z,d,lag,tw,rw,dT){
  const L=z.L||(st.live&&z.i>=0?st.live[z.i]:null);
  if(L){
    const off=dT!=null?dT:(z.dT||0);   // correction d'altitude : -6,5 °C par km par rapport au point de la série
    const P=L.p,T=L.t,i=Math.min((L.off!=null?L.off:st.off)+d,P.length-1);
    const iLag=Math.max(0,Math.min(i-(lag||0)+4,P.length-1));
    let r=0;for(let k=Math.max(0,iLag-13);k<=iLag;k++)r+=P[k]||0;
    const n=tw||7;let t=0,nt=0;for(let k=Math.max(0,i-n+1);k<=i;k++){t+=T[k]||0;nt++}
    const w={R:r,T:t/Math.max(nt,1)+off,src:"live"};
    if(rw){let rs=0,nn=0;for(let k=Math.max(0,iLag-rw+1);k<=iLag;k++){rs+=P[k]||0;nn++}w.RL=nn?rs*rw/nn:0} // fenêtre longue, ramenée à rw jours si l'historique est plus court
    {let a=0,b=0,na=0,nb=0;for(let k=Math.max(0,i-6);k<=i;k++){a+=T[k]||0;na++}for(let k=Math.max(0,i-13);k<=i-7;k++){b+=T[k]||0;nb++}if(na&&nb)w.warm=a/na-b/nb}
    if(L.tn){ // gel 3 derniers jours : fort (<-3°C) ou léger (-3..0°C)
      let hard=0,light=0;
      for(let k=Math.max(0,i-2);k<=i;k++){if(L.tn[k]+off<-3)hard=1;else if(L.tn[k]+off<0)light=1}
      w.frostHard=hard;w.frostLight=light&&!hard;
      // choc thermique : amplitude jour/nuit ~ 2x(Tmoy-Tmin), moyenne 3 j
      let amp=0,na=0;for(let k=Math.max(0,i-2);k<=i;k++){amp+=2*(T[k]-L.tn[k]);na++}
      w.amp=na?amp/na:8;
    }
    if(L.sm){ // humidité du sol moyenne 7 j (m³/m³) + bilan hydrique pluie-ET0 14 j
      let s=0,c=0;for(let k=Math.max(0,i-6);k<=i;k++){if(L.sm[k]>0){s+=L.sm[k];c++}}
      if(c)w.SM=s/c;
      if(L.et){let bal=0;for(let k=Math.max(0,i-13);k<=i;k++)bal+=(P[k]||0)-(L.et[k]||0);w.bal=bal}
    }
    return w;
  }
  const m=dateOf(d).getMonth();
  const Tn=BASE[m]-0.0065*z.alt-0.5*(z.lat-46);
  const Rn=28+z.alt*0.012+z.mi*6;
  return{R:Rn*st.rain/100,T:Tn+st.dt,src:"sim"};
}
// ---------- Score ----------
function score(sp,z,d,dT){
  const w=weather(z,d,sp.lag,sp.tw,sp.rw,dT),mo=dateOf(d).getMonth();
  const sfx=z.sol?soilFactor(sp,z.sol):null,so=sfx?sfx.f:sp.so[z.so],fo=z.urb?.01:z.nf?(sp.open?sp.open[z.open||"autre"]:.03):sp.fo[z.fo]*(z.sparse?(sp.sparse||.55):1),al=trap(z.alt,...sp.al.map((v,i)=>i==0&&v==0?-1:v));
  const tf=trap(w.T,...sp.t);
  // humidité : sol réel mappé sur la plage de l'espèce si dispo, sinon pluie décalée
  let rf;
  if(w.SM!=null){
    const[h0,h1]=sp.hu||[.12,.3];
    rf=clamp((w.SM-h0)/(h1-h0));
    if(w.bal!=null&&w.bal<-40)rf*=.6;                // dessèchement net malgré tout
  }else{
    rf=Math.pow(clamp(w.R*(1+.15*z.mi)/sp.ro),.8)*(w.R>sp.ro*5?.6:1);
  }
  if(sp.rr&&w.RL!=null)rf*=.55+.45*clamp(w.RL/sp.rr); // pluie cumulée sur la fenêtre longue (cèpe, lactaire)
  // saison : poids mensuels GBIF (observations réelles), interpolés au jour
  const day=dateOf(d).getDate(),dim=new Date(dateOf(d).getFullYear(),mo+1,0).getDate();
  const g0=sp.gb[mo],g1=sp.gb[(mo+1)%12];
  const sf=Math.max(.05,g0+(g1-g0)*(day/dim));
  // gel : fort = coupe selon sensibilité ; léger = coupe (sensibles) ou stimule (frost<0)
  let frMul=1;
  if(w.frostHard)frMul=1-.9*Math.abs(sp.frost);
  else if(w.frostLight)frMul=sp.frost<0?1.15:1-.6*sp.frost;
  // choc thermique : amplitude jour/nuit 6-13°C documentée favorable
  let ampMul=w.amp!=null?(.9+.2*trap(w.amp,2,6,13,20)):1;
  if(sp.warm&&w.warm!=null)ampMul*=1+.12*Math.max(-1,Math.min(1,w.warm/3)); // morille : sol qui se réchauffe
  // score = 100 x habitat(sol, altitude) x forêt^0,7 x météo : Ha et M sont exposés pour recalculer le score bloc par bloc
  const tfx=z.rel?terrainFactors(z.rel,rf):null;   // point : exposition, dépression, pente (les blocs de la carte les appliquent séparément)
  const Ha=Math.pow(so*Math.max(al,.001),.7),M=Math.pow(Math.max(tf*rf,0),.9)*sf*frMul*ampMul*(tfx?tfx.f:1);
  const sc=z.anth?0:Math.min(100,100*Ha*Math.pow(fo,.7)*M);   // agglomération ou axe routier : aucune présence possible
  return{sc:Math.round(sc),so,fo,al,tf,rf,sf,w,M,Ha,sfx,tfx};
}
// Dégradé séquentiel : jaune pâle (peu favorable) -> ambre -> orange -> rouge -> bordeaux (très favorable).
// Chaque palier est nettement distinct en teinte ET en luminosité (lisible aussi en daltonisme). Sous 22 : transparent.
const PALS={
  std:[[22,255,214,64],[40,255,194,51],[55,255,140,26],[70,238,75,28],[85,194,23,31],[100,122,16,72]],
  // Daltonisme : jaune -> vert -> bleu -> violet (type viridis), luminosité strictement décroissante, sans rouge/vert confondus
  cvd:[[22,253,231,37],[40,122,209,81],[55,34,168,132],[70,42,120,142],[85,65,68,135],[100,68,1,84]]
};
let STOPS=PALS.std;
const rgbAt=s=>{s=Math.max(22,Math.min(100,s));let i=1;while(i<STOPS.length-1&&s>STOPS[i][0])i++;const a=STOPS[i-1],b=STOPS[i],t=(s-a[0])/(b[0]-a[0]);return[0,1,2].map(k=>Math.round(a[k+1]+(b[k+1]-a[k+1])*t))};
const gA=s=>s<22?0:Math.min(.9,.42+.48*Math.pow((s-22)/78,.8));
const gC=s=>`rgb(${rgbAt(s).join(",")})`;
let _lut=null;
function lut(){if(_lut)return _lut;_lut=new Uint8ClampedArray(101*4);for(let v=0;v<=100;v++){const c=rgbAt(v);_lut.set([c[0],c[1],c[2],Math.round(gA(v)*255)],v*4)}return _lut}
const DARK=matchMedia("(prefers-color-scheme:dark)").matches;
const col=s=>s<25?"var(--mute)":`hsl(${Math.round(30-s*.14)},95%,${DARK?Math.round(64-s*.08):Math.round(40-s*.1)}%)`;
// ---------- Vues : jour / durable (8 jours) / meilleur jour / habitat ----------
const VIEWS=[
 {k:"day",t:"Jour choisi",note:"Score du jour sélectionné, d'après la météo réelle ou prévue."},
 {k:"dur",t:"Zones durables",note:"Moyenne pondérée des 8 prochains jours (les jours lointains comptent moins). Ressortent les zones bonnes longtemps, pas juste un jour."},
 {k:"best",t:"Meilleur jour",note:"Le meilleur score de la semaine pour chaque zone."},
 {k:"hab",t:"Habitat",note:"Sol, forêt et altitude seulement, sans la météo : les grands massifs durablement propices. Villes et cultures s'effacent."},
 {k:"all",t:"Toutes les espèces",note:"Le meilleur score parmi toutes les espèces, pour le jour choisi. Zones de 17 km : choisissez une espèce pour le détail fin."},
];
const WD=[1,1,.9,.8,.7,.6,.5,.4];
function habOnly(sp,z){
  const sfx=z.sol?soilFactor(sp,z.sol):null,so=sfx?sfx.f:sp.so[z.so],fo=z.urb?.01:z.nf?(sp.open?sp.open[z.open||"autre"]:.03):sp.fo[z.fo]*(z.sparse?(sp.sparse||.55):1),al=trap(z.alt,...sp.al.map((v,i)=>i==0&&v==0?-1:v));
  const Ha=Math.pow(so*Math.max(al,.001),.7);
  return{sc:z.anth?0:Math.round(Math.min(100,100*Ha*Math.pow(fo,.7))),so,fo,al,M:1,Ha,sfx,rf:1};
}
function allScore(z){
  const c=st.allCache,ok=c&&c.key===allKey()&&z.i!=null&&z.i>=0&&z.i<c.sc.length;
  return{sc:ok?c.sc[z.i]:0,best:ok?c.best[z.i]:-1,M:0,Ha:0,fo:0,al:0,so:0,sfx:0,rf:0};
}
const allKey=()=>[st.fetchedAt,st.dataDate,Math.max(-1,st.day),st.rain,st.dt,st.live?1:0].join("|");
function ensureAll(){
  if(st.view!=="all"){st.allJob=null;return false}   // on a quitté la vue : le calcul en cours est abandonné
  const key=allKey();
  if(st.allCache&&st.allCache.key===key)return true;
  if(st.allJob&&st.allJob.key===key)return false;   // déjà en cours pour cet état
  const job=st.allJob={key,i:0,sc:new Float32Array(Z.length),best:new Int8Array(Z.length).fill(-1)};
  const sps=SP.map((x,i)=>[x,i]).filter(x=>!x[0].toxic),N=Z.length,CH=60,d0=Math.max(-1,st.day);
  const step=()=>{
    if(st.allJob!==job)return;   // annulé : vue ou jour changés entre-temps
    const end=Math.min(N,job.i+CH);
    for(let c=job.i;c<end;c++){
      const z=Z[c];let m=0,b=-1;
      if(!z.anth)for(const[x,i]of sps){const v=score(x,z,d0).sc;if(v>m){m=v;b=i}}
      job.sc[z.i]=m;job.best[z.i]=b;
    }
    job.i=end;
    if(end<N){const t=$("status");if(t)t.textContent="Toutes les espèces : calcul en cours… "+Math.round(100*end/N)+" %";setTimeout(step,0)}
    else{st.allCache={key,sc:job.sc,best:job.best};st.allJob=null;render()}
  };
  setTimeout(step,0);return false;
}
function viewScore(sp,z,forDetail){
  const v=(st.view==="all"&&forDetail)?"day":st.view;
  if(v==="all")return allScore(z);
  if(v=="hab")return habOnly(sp,z);
  if(v=="day")return score(sp,z,st.day);
  const a=[...Array(8)].map((_,d)=>score(sp,z,d)),r0=a[0];
  const M=v=="best"?Math.max(...a.map(x=>x.M)):a.reduce((s,x,i)=>s+x.M*WD[i],0)/WD.reduce((s,x)=>s+x,0);
  const rf=a.reduce((s,x,i)=>s+x.rf*WD[i],0)/WD.reduce((s,x)=>s+x,0);
  return{sc:z.anth?0:Math.round(Math.min(100,100*r0.Ha*Math.pow(r0.fo,.7)*M)),M,Ha:r0.Ha,fo:r0.fo,al:r0.al,so:r0.so,sfx:r0.sfx,rf};
}
// M (facteur météo) de la vue affichée pour un décalage thermique dT : sert à corriger la température selon l'altitude du bloc.
function viewM(sp,z,dT){
  const v=st.view;
  if(v=="hab")return 1;
  if(v=="day")return score(sp,z,st.day,dT).M;
  let sum=0,ws=0,mx=0;
  for(let d=0;d<8;d++){const m=score(sp,z,d,dT).M;sum+=m*WD[d];ws+=WD[d];if(m>mx)mx=m}
  return v=="best"?mx:sum/ws;
}
// ---------- Carte Leaflet ----------
let map,selMarker=null,topLayer=null;
// Contour des meilleures zones : plus fin et plus sélectif à l'échelle nationale, plus net en gros plan.
function drawOutline(){
  if(topLayer){topLayer.remove();topLayer=null}
  const F=st.F;if(!F||!map)return;
  const z=map.getZoom(),minC=z<7?60:z<9?12:F.minComp,segs=outlineSegs(F,minC);
  if(!segs.length)return;
  const w=z<7?1.3:z<9?1.9:2.6,hw=w+(z<7?1.6:3);
  topLayer=L.layerGroup([
    L.polyline(segs,{color:"#fff",weight:hw,opacity:.9,lineJoin:"round",lineCap:"round",interactive:false}),
    L.polyline(segs,{color:"#4a148c",weight:w,opacity:1,lineJoin:"round",lineCap:"round",interactive:false})
  ]).addTo(map);
}
// Étiquette de score au survol (souris uniquement)
function tipLabel(v){return v>=70?"Très propice":v>=55?"Propice":v>=35?"Moyennement propice":v>=20?"Peu propice":"Peu ou pas favorable"}
function showTip(e){
  const t=$("tip");if(!t)return;
  if(!st.F||matchMedia("(pointer:coarse)").matches){t.style.display="none";return}
  const v=Math.min(100,fieldAt(st.F,e.latlng.lat,e.latlng.lng)*st.F.gain);
  t.textContent=v<12?"Peu ou pas favorable":tipLabel(v)+" · "+Math.round(v);
  t.style.display="block";t.style.left=Math.min(e.containerPoint.x+14,$("map").clientWidth-190)+"px";t.style.top=(e.containerPoint.y+16)+"px";
}
// Sur mobile, la France est cadrée dans la partie de la carte visible au-dessus du tiroir (pas sous lui).
const BASE_BOUNDS=[[40.5,-6.5],[52.2,11.5]];
function applyBounds(){
  if(!map)return;
  const b=L.latLngBounds(BASE_BOUNDS);
  if(!mqMobile.matches){map.setMaxBounds(b);return}
  const z=map.getZoom(),ext=map.unproject(map.project(b.getSouthWest(),z).add([0,sheetPx(st.sheet||"half")]),z);
  map.setMaxBounds(L.latLngBounds([Math.min(ext.lat,b.getSouth()),b.getWest()],[b.getNorth(),b.getEast()]));
}
function franceView(fly){
  applyBounds();
  if(mqMobile.matches){
    const b=[[41.2,-5.4],[51.2,9.9]],o={paddingTopLeft:[8,72],paddingBottomRight:[8,sheetPx(st.sheet||"half")+8]};
    if(fly)map.flyToBounds(b,o);else map.fitBounds(b,o);
  }else if(fly)map.flyTo([46.6,2.6],6,{duration:.7});else map.setView([46.6,2.6],6);
}
function initMap(){
  map=L.map("map",{preferCanvas:true,zoomControl:true,minZoom:5,maxZoom:14,zoomSnap:.5,wheelPxPerZoomLevel:90,
    maxBoundsViscosity:.8});
  franceView(false);
  const osm=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"});
  const topo=L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{maxZoom:17,attribution:"© OpenStreetMap, SRTM · © OpenTopoMap (CC-BY-SA)"});
  osm.addTo(map);
  L.control.layers({"Plan":osm,"Relief et forêts":topo},null,{position:"topright"}).addTo(map);
  initDots();
  map.on("click",e=>setPoint(e.latlng.lat,e.latlng.lng,false));
  map.on("zoomend",drawOutline);
  map.on("zoomend",applyBounds);
  map.on("moveend",scheduleNow);
  map.on("zoomend resize",()=>{clearTimeout(st.spT);st.spT=setTimeout(()=>updateSpots(false),220)});
  map.on("mousemove",showTip);map.on("mouseout",()=>{$("tip").style.display="none"});map.on("movestart",()=>{$("tip").style.display="none"});
  const Rec=L.Control.extend({options:{position:"topleft"},onAdd(){
    const b=L.DomUtil.create("button","leaflet-bar recbtn");b.type="button";b.title="Voir toute la France";b.setAttribute("aria-label","Voir toute la France");b.textContent="⌂";
    L.DomEvent.disableClickPropagation(b);b.onclick=()=>franceView(true);return b}});
  map.addControl(new Rec());
}
// ---------- Couche de chaleur : un seul canvas lissé (pas de cercles superposés) ----------
let heatOverlay=null,heatBounds=null,heatGeom=null;
const mercY=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
function buildHeat(){
  if(heatOverlay){heatOverlay.remove();heatOverlay=null}
  if(!Z.length)return;
  const lats=Z.map(z=>z.lat),lons=Z.map(z=>z.lon);
  // pas de la grille : plus petit écart non nul
  const step=a=>{const u=[...new Set(a)].sort((x,y)=>x-y);let m=1e9;for(let i=1;i<u.length;i++)m=Math.min(m,u[i]-u[i-1]);return m<1e9?m:1};
  const dLat=step(lats),dLon=step(lons);
  const lat0=Math.min(...lats)-dLat/2,lat1=Math.max(...lats)+dLat/2;
  const lon0=Math.min(...lons)-dLon/2,lon1=Math.max(...lons)+dLon/2;
  const W=720,H=Math.round(W*(mercY(lat1)-mercY(lat0))/((lon1-lon0)*Math.PI/180));
  const my0=mercY(lat0),my1=mercY(lat1);
  const px=lon=>(lon-lon0)/(lon1-lon0)*W;
  const py=lat=>(my1-mercY(lat))/(my1-my0)*H;
  heatGeom={W,H,px,py,dLat,dLon,la0:Math.min(...lats),lo0:Math.min(...lons),lon0,lon1,my0,my1};
  heatBounds=[[lat0,lon0],[lat1,lon1]];
  heatOverlay=L.imageOverlay("data:image/gif;base64,R0lGODlhAQABAAAAACw=",heatBounds,{opacity:1,interactive:false}).addTo(map);
}
// ---------- Champ de score ----------
// Un champ F = grille G (w x h) + transformation indice -> coordonnées : lat = Alat + i*Blat, lon = Alon + j*Blon.
// Mode grossier : mailles de 17 km lissées. Mode fin : blocs de forêt d'environ 1,4 km (si forets.json est présent),
// ce qui fait ressortir les petits massifs et îlots forestiers au milieu de zones bâties ou cultivées.
function buildField(sc){
  if(!heatGeom||!st.live)return null;
  const{dLat,dLon,la0,lo0}=heatGeom;
  let ni=0,nj=0;
  const idx=sc.map(o=>{const i=Math.round((o.z.lat-la0)/dLat),j=Math.round((o.z.lon-lo0)/dLon);if(i+1>ni)ni=i+1;if(j+1>nj)nj=j+1;return[i,j,o.r.sc]});
  const w=nj+4,h=ni+4,A=new Float32Array(w*h),G=new Float32Array(w*h);
  idx.forEach(([i,j,v])=>{A[(i+2)*w+(j+2)]=v});
  for(let i=1;i<h-1;i++)for(let j=1;j<w-1;j++){const k=i*w+j;G[k]=.4*A[k]+.1*(A[k-1]+A[k+1]+A[k-w]+A[k+w])+.05*(A[k-w-1]+A[k-w+1]+A[k+w-1]+A[k+w+1])}
  let mx=0;for(let k=0;k<G.length;k++)if(G[k]>mx)mx=G[k];
  return{kind:"coarse",G,w,h,mx,gain:85/Math.max(60,mx),Alat:la0-2*dLat,Blat:dLat,Alon:lo0-2*dLon,Blon:dLon,R:5,minComp:60};
}
function fieldAt(F,lat,lon){
  const fi=(lat-F.Alat)/F.Blat,fj=(lon-F.Alon)/F.Blon,i0=Math.floor(fi),j0=Math.floor(fj);
  if(i0<0||j0<0||i0>=F.h-1||j0>=F.w-1)return 0;
  const a=fi-i0,b=fj-j0,k=i0*F.w+j0,G=F.G,w=F.w;
  return G[k]*(1-a)*(1-b)+G[k+1]*(1-a)*b+G[k+w]*a*(1-b)+G[k+w+1]*a*b;
}
function sf7Grid(sp){
  st.sf7=st.sf7||{};
  if(st.sf7[sp.n])return st.sf7[sp.n];
  const n=SOL.w*SOL.h,out=new Float32Array(n),U=255;
  for(let i=0;i<n;i++){
    const ph=SOL.ph[i],sa=SOL.sand[i],cl=SOL.clay[i],so=SOL.soc[i];
    if(ph==U&&sa==U&&cl==U){out[i]=-1;continue}
    out[i]=Math.pow(soilFactor(sp,{ph:ph==U?null:ph/10,sand:sa==U?null:sa,clay:cl==U?null:cl,soc:so==U?null:so}).f,.7);
  }
  return st.sf7[sp.n]=out;
}
function blockSoil(lat,lon){
  if(!SOL||!heatGeom)return null;
  const{la0,lo0,dLat,dLon}=heatGeom,K=SOL.K,y=Math.floor((lat-(la0-dLat/2))/(dLat/K)),x=Math.floor((lon-(lo0-dLon/2))/(dLon/K));
  if(y<0||x<0||y>=SOL.h||x>=SOL.w)return null;
  const i=y*SOL.w+x,g=(a,d)=>a[i]==255?null:a[i]/d;
  const o={ph:g(SOL.ph,10),sand:g(SOL.sand,1),clay:g(SOL.clay,1),soc:g(SOL.soc,1)};
  return(o.ph==null&&o.sand==null)?null:o;
}
function setSol(j){
  const dec=b=>{const t=atob(b),a=new Uint8Array(t.length);for(let i=0;i<t.length;i++)a[i]=t.charCodeAt(i);return a};
  SOL={K:j.K,w:j.w,h:j.h,ph:dec(j.layers.ph),sand:dec(j.layers.sand),clay:dec(j.layers.clay),soc:dec(j.layers.soc)};
  st.sf7={};
}
function applySol(){   // moyenne du sol par maille (pour les listes et le calcul grossier)
  if(!SOL||!st.live||!heatGeom)return;
  const K=SOL.K,W=SOL.w;
  Z.forEach(z=>{
    const acc={ph:[0,0],sand:[0,0],clay:[0,0],soc:[0,0]};
    for(let y=z.ci*K;y<z.ci*K+K;y++)for(let x=z.cj*K;x<z.cj*K+K;x++){const i=y*W+x;for(const k in acc){const v=SOL[k][i];if(v!=255){acc[k][0]+=v;acc[k][1]++}}}
    const g=(k,d)=>acc[k][1]>=8?acc[k][0]/acc[k][1]/d:null,o={ph:g("ph",10),sand:g("sand",1),clay:g("clay",1),soc:g("soc",1)};
    z.sol=(o.ph==null&&o.sand==null)?undefined:o;
  });
}
async function loadSol(){
  try{const r=await fetch("sol.json",{cache:"no-cache"});if(!r.ok)return;const j=await r.json();if(j.layers&&j.w)setSol(j)}catch(e){}
}
// ---------- Relief : altitude du bloc, pente, exposition, position topographique ----------
// Source : tuiles d'altitude AWS (106 m par pixel) agrégées par blocs de 2,8 km (build_relief.py).
// Effets : (1) température corrigée de l'altitude du bloc (-6,5 °C/km) ; (2) versants nord et dépressions plus frais et humides :
// bonus jusqu'à +25 % quand l'humidité manque, malus symétrique sur versants sud et crêtes ; (3) pente > 15° pénalisée jusqu'à -30 %.
// Étayé en Espagne méditerranéenne (rendement croissant avec l'exposition nord, décroissant avec la pente) ; effet inverse signalé
// en climat humide (Turquie, cèpe) : c'est pourquoi l'effet d'exposition ne joue que lorsque l'humidité est limitante.
let RLF=null;
const DT5=[-6,-3,0,3,6];
function terrainFactors(rel,rf){
  const mi=.7*(rel.north||0)+.3*Math.max(-1,Math.min(1,-(rel.tpi||0)/40));       // > 0 : frais et humide
  const fm=1+.25*mi*(1-Math.min(1,rf));
  const fs=1-.3*clamp01(((rel.slope||0)-15)/25);
  return{mi,fm,fs,f:fm*fs};
}
const b64bytes=b=>{const t=atob(b),a=new Uint8Array(t.length);for(let i=0;i<t.length;i++)a[i]=t.charCodeAt(i);return a};
function setRelief(j){
  RLF={K:j.K,w:j.w,h:j.h,elev:b64bytes(j.layers.elev),slope:b64bytes(j.layers.slope),north:b64bytes(j.layers.north),tpi:b64bytes(j.layers.tpi)};
  const n=RLF.w*RLF.h,MI=new Float32Array(n);
  for(let i=0;i<n;i++){const nv=RLF.north[i],tv=RLF.tpi[i];MI[i]=(nv==255||tv==255)?0:.7*((nv-127)/127)+.3*Math.max(-1,Math.min(1,-((tv-127)/1.27)/40))}
  RLF.MI=MI;st.t7={};
}
function terr7Grid(sp){
  st.t7=st.t7||{};
  if(st.t7[sp.n])return st.t7[sp.n];
  const n=RLF.w*RLF.h,out=new Float32Array(n),al=sp.al.map((v,i)=>i==0&&v==0?-1:v);
  for(let i=0;i<n;i++){
    const e=RLF.elev[i];if(e==255){out[i]=-1;continue}
    const sl=RLF.slope[i],fs=sl==255?1:1-.3*clamp01((sl-15)/25);
    out[i]=Math.pow(Math.max(trap(e*20,...al),.001)*fs,.7);
  }
  return st.t7[sp.n]=out;
}
function applyRelief(){   // amplitude d'altitude dans chaque maille : décide où la correction thermique compte
  if(!RLF||!st.live||!heatGeom)return;
  const K=RLF.K,W=RLF.w;
  Z.forEach(z=>{let mx=0;for(let y=z.ci*K;y<z.ci*K+K;y++)for(let x=z.cj*K;x<z.cj*K+K;x++){const e=RLF.elev[y*W+x];if(e!=255)mx=Math.max(mx,Math.abs(e*20-z.alt))}z.relMax=mx});
}
function blockRelief(lat,lon){
  if(!RLF||!heatGeom)return null;
  const{la0,lo0,dLat,dLon}=heatGeom,K=RLF.K,y=Math.floor((lat-(la0-dLat/2))/(dLat/K)),x=Math.floor((lon-(lo0-dLon/2))/(dLon/K));
  if(y<0||x<0||y>=RLF.h||x>=RLF.w)return null;
  const i=y*RLF.w+x;if(RLF.elev[i]==255)return null;
  return{elev:RLF.elev[i]*20,slope:RLF.slope[i]==255?0:RLF.slope[i],north:RLF.north[i]==255?0:(RLF.north[i]-127)/127,tpi:RLF.tpi[i]==255?0:(RLF.tpi[i]-127)/1.27};
}
async function loadRelief(){
  try{const r=await fetch("relief.json",{cache:"no-cache"});if(!r.ok)return;const j=await r.json();if(j.layers&&j.w)setRelief(j)}catch(e){}
}
// Clé de maille identique à celle des scripts Python : un flottant entier s'écrit « 48.0 » côté Python et « 48 » côté JavaScript.
const nk=v=>Number.isInteger(v)?v.toFixed(1):String(v);
const ckey=(lat,lon)=>nk(lat)+","+nk(lon);
// Grille fine des classes de forêt (0 aucune ; 1 feuillus, 2 résineux, 3 autre/mixte ; +3 = bois épars), alignée sur la grille des mailles.
let FINE=null;
function indexCells(){
  st.cellMap=new Map();
  if(!heatGeom||!st.live)return;
  const{la0,lo0,dLat,dLon}=heatGeom;
  Z.forEach(z=>{z.ci=Math.round((z.lat-la0)/dLat);z.cj=Math.round((z.lon-lo0)/dLon);st.cellMap.set(z.ci+","+z.cj,z)});
}
function buildFineGrid(){
  FINE=null;
  if(!st.forets||!heatGeom||!st.live)return;
  const K=st.forets.K,cells=st.forets.cells;
  let ni=0,nj=0;Z.forEach(z=>{if(z.ci+1>ni)ni=z.ci+1;if(z.cj+1>nj)nj=z.cj+1});
  const FW=nj*K,FH=ni*K,cls=new Uint8Array(FW*FH),idx=new Int32Array(ni*nj).fill(-1);
  let have=0;
  Z.forEach(z=>{
    idx[z.ci*nj+z.cj]=z.i;
    const s=cells[ckey(z.lat,z.lon)];if(s)have++;
    const cc=z.nf?0:(z.fo=="f"?1:z.fo=="r"?2:3);   // repli : type de la maille entière
    for(let r=0;r<K;r++){const a=K-1-r;for(let b=0;b<K;b++){
      let c=cc;
      if(s){const ch=s[r*K+b];c=ch=="."?0:(ch=="f"||ch=="F")?1:(ch=="r"||ch=="R")?2:3;if(c&&ch==ch.toLowerCase())c+=3} // 1-3 : massif dense ; 4-6 : bois épars (25-60 % du bloc)
      cls[(z.ci*K+a)*FW+z.cj*K+b]=c}}
  });
  // agglomérations : un bloc artificialisé (CORINE) n'est plus une forêt, même si le blocs voisins le sont
  const urb=new Uint8Array(FW*FH);
  if(st.urbain)Z.forEach(z=>{
    const u=st.urbain.cells[ckey(z.lat,z.lon)];if(!u)return;
    for(let r=0;r<K;r++){const a=K-1-r;for(let b=0;b<K;b++){const ch=u[r*K+b],k=(z.ci*K+a)*FW+z.cj*K+b;
      if(ch=="#"){urb[k]=1;cls[k]=0}else if(ch=="p"&&cls[k]==0)cls[k]=7}}   // # agglomération ; p prairie ou milieu ouvert semi-naturel
  });
  FINE={K,FW,FH,ni,nj,cls,idx,have,urb};
}
function buildFineField(sc,sp){
  if(!FINE)return null;
  const{K,FW,FH,ni,nj,cls}=FINE,{la0,lo0,dLat,dLon}=heatGeom;
  const cw=nj+2,nc=cw*(ni+2);
  const Mc=new Float32Array(nc),HcS=new Float32Array(nc),HcA=new Float32Array(nc),Dc=new Float32Array(nc),Ac=new Float32Array(nc),Wc=new Uint8Array(nc);
  const useSol=!!SOL&&K%SOL.K==0,useRel=!!RLF&&K%RLF.K==0;
  const Sc7=new Float32Array(ni*nj),Al7c=new Float32Array(ni*nj),SF7=useSol?sf7Grid(sp):null,T7=useRel?terr7Grid(sp):null;
  const Mtab=useRel?new Float32Array(nc*5):null;
  sc.forEach(({z,r})=>{
    const k=(z.ci+1)*cw+z.cj+1;
    Mc[k]=r.M!=null?r.M:0;Wc[k]=1;
    HcS[k]=Math.pow(Math.max(r.so||0,0),.7);HcA[k]=Math.pow(Math.max(r.al||0,.001),.7);   // sol et altitude de la maille
    Dc[k]=r.rf!=null?1-Math.min(1,r.rf):0;Ac[k]=z.alt;
    Sc7[z.ci*nj+z.cj]=HcS[k];Al7c[z.ci*nj+z.cj]=HcA[k];
    if(useRel){
      // table de M pour 5 décalages thermiques, seulement dans les mailles à fort relief (sinon M constant)
      if(z.relMax>=100&&st.view!="hab")for(let t=0;t<5;t++)Mtab[k*5+t]=viewM(sp,z,DT5[t]);
      else for(let t=0;t<5;t++)Mtab[k*5+t]=Mc[k];
    }
  });
  const SPARSE=sp.sparse||.55;  // un bloc boisé à 25-60 % (lisières, massifs aérés, bocage) pèse 55 % d'un bloc très boisé
  const FP=[Math.pow(.03,.7),Math.pow(sp.fo.f,.7),Math.pow(sp.fo.r,.7),Math.pow(sp.fo.m,.7)];
  FP.push(Math.pow(sp.fo.f*SPARSE,.7),Math.pow(sp.fo.r*SPARSE,.7),Math.pow(sp.fo.m*SPARSE,.7));
  FP.push(Math.pow(sp.open?sp.open.prairie:.03,.7));   // 7 : prairie ou milieu ouvert
  if(sp.open)FP[0]=Math.pow(sp.open.autre,.7);          // espèce de milieux ouverts : un bloc sans forêt n'est pas nul
  const mt=(kk,wt,ab)=>{   // M de la maille kk corrigé de la température du bloc (altitude ab)
    if(!Wc[kk])return 0;
    const t=(Math.max(-6,Math.min(6,-.0065*(ab-Ac[kk])))+6)/3,ti=Math.min(3,t|0),fr=t-ti;
    return wt*(Mtab[kk*5+ti]*(1-fr)+Mtab[kk*5+ti+1]*fr);
  };
  const pad=2,w=FW+2*pad,h=FH+2*pad,A=new Float32Array(w*h),G=new Float32Array(w*h);
  for(let y=0;y<FH;y++){
    const gy=(y+.5)/K-.5,i0=Math.floor(gy),fy=gy-i0,ci=Math.floor(y/K),sy=useSol?Math.floor(y*SOL.K/K):0,ry=useRel?Math.floor(y*RLF.K/K):0;
    for(let x=0;x<FW;x++){
      const gx=(x+.5)/K-.5,j0=Math.floor(gx),fx=gx-j0,k=(i0+1)*cw+(j0+1),cj=Math.floor(x/K);
      const w00=(1-fy)*(1-fx),w01=(1-fy)*fx,w10=fy*(1-fx),w11=fy*fx;
      const a=w00*Wc[k],b=w01*Wc[k+1],c=w10*Wc[k+cw],d=w11*Wc[k+cw+1],wdn=a+b+c+d;
      let ab=-1,rb=0;
      if(useRel){rb=ry*RLF.w+Math.floor(x*RLF.K/K);const e=RLF.elev[rb];if(e!=255)ab=e*20}
      // météo lissée entre mailles, corrigée de la température de l'altitude du bloc
      const M=ab>=0?mt(k,w00,ab)+mt(k+1,w01,ab)+mt(k+cw,w10,ab)+mt(k+cw+1,w11,ab):Mc[k]*w00+Mc[k+1]*w01+Mc[k+cw]*w10+Mc[k+cw+1]*w11;
      // sol : du bloc (pH, texture, humus) sinon de la maille ; altitude et pente : du bloc sinon de la maille
      let qS,qA,fm=1;
      if(useSol){qS=SF7[sy*SOL.w+Math.floor(x*SOL.K/K)];if(qS<0)qS=Sc7[ci*nj+cj]}
      else qS=wdn>0?(HcS[k]*a+HcS[k+1]*b+HcS[k+cw]*c+HcS[k+cw+1]*d)/wdn:0;
      if(ab>=0){qA=T7[rb];if(qA<0)qA=Al7c[ci*nj+cj];fm=1+.25*RLF.MI[rb]*(wdn>0?(Dc[k]*a+Dc[k+1]*b+Dc[k+cw]*c+Dc[k+cw+1]*d)/wdn:0)}
      else qA=wdn>0?(HcA[k]*a+HcA[k+1]*b+HcA[k+cw]*c+HcA[k+cw+1]*d)/wdn:0;
      const v=FINE.urb[y*FW+x]?0:100*qS*qA*FP[cls[y*FW+x]]*M*fm;   // agglomération : jamais de présence
      A[(y+pad)*w+x+pad]=v>100?100:v;
    }
  }
  for(let i=1;i<h-1;i++)for(let j=1;j<w-1;j++){const k=i*w+j;G[k]=.6*A[k]+.08*(A[k-1]+A[k+1]+A[k-w]+A[k+w])+.02*(A[k-w-1]+A[k-w+1]+A[k+w-1]+A[k+w+1])}
  let mx=0;for(let k=0;k<G.length;k++)if(G[k]>mx)mx=G[k];
  const bl=dLat/K,bo=dLon/K;
  return{kind:"fine",G,w,h,mx,gain:85/Math.max(60,mx),Alat:la0-dLat/2+(-pad+.5)*bl,Blat:bl,Alon:lo0-dLon/2+(-pad+.5)*bo,Blon:bo,R:1,minComp:3};
}
// Contours lissés (marching squares) : le haut du panier de la vue affichée (>= 78 % du meilleur niveau, jamais sous 35).
function outlineSegs(F,mc){
  if(!F||F.mx<35)return[];
  const{G,w,h,R}=F,minComp=mc!=null?mc:F.minComp;
  let thr=Math.max(35,.78*F.mx);
  const P=(h-1)*R+1,Q=(w-1)*R+1;
  for(let essai=0;essai<3;essai++){
    const val=new Float32Array(P*Q);
    if(R==1)val.set(G);
    else for(let p=0;p<P;p++){const fi=p/R,i0=Math.min(Math.floor(fi),h-2),a=fi-i0;
      for(let q=0;q<Q;q++){const fj=q/R,j0=Math.min(Math.floor(fj),w-2),b=fj-j0,k=i0*w+j0;
        val[p*Q+q]=G[k]*(1-a)*(1-b)+G[k+1]*(1-a)*b+G[k+w]*a*(1-b)+G[k+w+1]*a*b}}
    // retire les pics isolés trop petits pour désigner une zone
    {const seen=new Uint8Array(P*Q),stk=new Int32Array(P*Q);
     for(let s0=0;s0<P*Q;s0++){
       if(seen[s0]||val[s0]<thr)continue;
       let top=0;const comp=[];stk[top++]=s0;seen[s0]=1;
       while(top){const k=stk[--top];comp.push(k);const p=(k/Q)|0,q=k-p*Q;
         if(q>0&&!seen[k-1]&&val[k-1]>=thr){seen[k-1]=1;stk[top++]=k-1}
         if(q<Q-1&&!seen[k+1]&&val[k+1]>=thr){seen[k+1]=1;stk[top++]=k+1}
         if(p>0&&!seen[k-Q]&&val[k-Q]>=thr){seen[k-Q]=1;stk[top++]=k-Q}
         if(p<P-1&&!seen[k+Q]&&val[k+Q]>=thr){seen[k+Q]=1;stk[top++]=k+Q}}
       if(comp.length<minComp)for(const k of comp)val[k]=0;
     }}
    const ll=(p,q)=>[F.Alat+(p/R)*F.Blat,F.Alon+(q/R)*F.Blon];
    const X=(p1,q1,v1,p2,q2,v2)=>{const t=(thr-v1)/(v2-v1);return ll(p1+(p2-p1)*t,q1+(q2-q1)*t)};
    const segs=[];
    for(let p=0;p<P-1;p++)for(let q=0;q<Q-1;q++){
      const a=val[p*Q+q],b=val[p*Q+q+1],d=val[(p+1)*Q+q],c2=val[(p+1)*Q+q+1];
      const c=(a>=thr?1:0)|(b>=thr?2:0)|(c2>=thr?4:0)|(d>=thr?8:0);
      if(c==0||c==15)continue;
      const T=()=>X(p,q,a,p,q+1,b),Rt=()=>X(p,q+1,b,p+1,q+1,c2),Bt=()=>X(p+1,q,d,p+1,q+1,c2),Lf=()=>X(p,q,a,p+1,q,d);
      switch(c){
        case 1:case 14:segs.push([Lf(),T()]);break;
        case 2:case 13:segs.push([T(),Rt()]);break;
        case 3:case 12:segs.push([Lf(),Rt()]);break;
        case 4:case 11:segs.push([Rt(),Bt()]);break;
        case 6:case 9:segs.push([T(),Bt()]);break;
        case 7:case 8:segs.push([Lf(),Bt()]);break;
        default:{const m=(a+b+d+c2)/4>=thr,A=[[Lf(),T()],[Rt(),Bt()]],B=[[T(),Rt()],[Lf(),Bt()]];
          segs.push(...((c==5)==m?B:A))}
      }
    }
    if(segs.length<30000||essai==2)return segs;
    thr+=8;   // trop de contours (ex. vue « Habitat ») : on ne garde que le meilleur
  }
  return[];
}
function paintHeatRects(sc){
  if(!heatGeom)return;
  const mx=Math.max(...sc.map(o=>o.r.sc)),gain=85/Math.max(60,mx);
  const{W,H,px,py,dLat,dLon}=heatGeom;
  const c1=document.createElement("canvas");c1.width=W;c1.height=H;
  const g=c1.getContext("2d");
  sc.forEach(({z,r})=>{
    const x0=px(z.lon-dLon/2),x1=px(z.lon+dLon/2);
    const y0=py(z.lat+dLat/2),y1=py(z.lat-dLat/2);
    const v=Math.min(100,r.sc*gain);g.globalAlpha=gA(v);
    g.fillStyle=gC(v);
    g.fillRect(x0-.5,y0-.5,x1-x0+1,y1-y0+1);
  });
  const c2=document.createElement("canvas");c2.width=W;c2.height=H;
  const g2=c2.getContext("2d");
  const blur=Math.max(2,Math.round(.6*(px(dLon)-px(0))));
  g2.filter="blur("+blur+"px)";
  g2.drawImage(c1,0,0);
  heatOverlay.setUrl(c2.toDataURL("image/png"));
}
function paintHeat(sc){
  if(!heatGeom)return;
  const F=st.F;
  if(!F){paintHeatRects(sc);return}
  const{W,H,lon0,lon1,my0,my1}=heatGeom,gain=F.gain,LUT=lut();
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const g=cv.getContext("2d"),im=g.createImageData(W,H),d=im.data;
  for(let y=0;y<H;y++){
    const my=my1-(y+.5)/H*(my1-my0),lat=(2*Math.atan(Math.exp(my))-Math.PI/2)*180/Math.PI;
    for(let x=0;x<W;x++){
      const v=fieldAt(F,lat,lon0+(x+.5)/W*(lon1-lon0))*gain;
      if(v<22)continue;
      const L=Math.min(100,Math.round(v))*4,p=(y*W+x)*4;
      d[p]=LUT[L];d[p+1]=LUT[L+1];d[p+2]=LUT[L+2];d[p+3]=LUT[L+3];
    }
  }
  g.putImageData(im,0,0);
  heatOverlay.setUrl(cv.toDataURL("image/png"));
}
// ---------- Nuage de points : la densité et la taille des points suivent le score ----------
// Réseau régulier en pixels « monde » (stable quand on déplace la carte), léger décalage aléatoire,
// un point est tracé avec une probabilité qui croît avec le score. Recalculé à chaque déplacement/zoom.
let dotsCanvas=null;
const DOTC=[...Array(101)].map((_,v)=>gC(v));
function setPalette(k){
  STOPS=PALS[k]||PALS.std;_lut=null;for(let v=0;v<=100;v++)DOTC[v]=gC(v);
  const r=document.documentElement.style,c=v=>"rgb("+rgbAt(v).join(",")+")";
  r.setProperty("--c2",c(40));r.setProperty("--c3",c(55));r.setProperty("--c4",c(85));
  r.setProperty("--bargrad","linear-gradient(90deg,transparent 0%,rgba("+rgbAt(22).join(",")+",.45) 22%,"+[40,55,70,85,100].map(v=>c(v)+" "+v+"%").join(",")+")");
}
function hash3(a,b,c){let h=Math.imul(a|0,374761393)+Math.imul(b|0,668265263)+Math.imul(c|0,2246822519)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296}
function initDots(){
  map.createPane("dots");const pn=map.getPane("dots");pn.style.zIndex=395;pn.style.pointerEvents="none";
  dotsCanvas=L.DomUtil.create("canvas","",pn);dotsCanvas.style.position="absolute";
  map.on("moveend zoomend resize",drawDots);
  map.on("zoomstart",()=>{dotsCanvas.style.opacity=0});
}
function drawDots(){
  const c=dotsCanvas;if(!c||!map)return;
  const F=st.F,on=st.mode=="dots"&&F;
  if(!on){c.width=1;c.height=1;return}
  const sz=map.getSize(),padx=Math.round(sz.x*.25),pady=Math.round(sz.y*.25),dpr=window.devicePixelRatio||1;
  const wpx=sz.x+2*padx,hpx=sz.y+2*pady;
  c.width=wpx*dpr;c.height=hpx*dpr;c.style.width=wpx+"px";c.style.height=hpx+"px";c.style.opacity=1;
  const g=c.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);
  const zoom=map.getZoom(),pb=map.getPixelBounds(),org=map.getPixelOrigin();
  const wx0=pb.min.x-padx,wy0=pb.min.y-pady;
  L.DomUtil.setPosition(c,L.point(wx0-org.x,wy0-org.y));
  const size=256*Math.pow(2,zoom),S=6,gain=F.gain;
  const a0=Math.floor(wx0/S),a1=Math.ceil((wx0+wpx)/S),b0=Math.floor(wy0/S),b1=Math.ceil((wy0+hpx)/S);
  g.globalAlpha=.95;
  g.lineWidth=.5;g.strokeStyle="rgba(35,28,20,.5)";   // contour sombre très fin : les points pâles restent visibles sur le fond clair
  const{dLat:fdl,dLon:fdo,la0:fl0,lo0:fo0}=heatGeom||{},fK=FINE?FINE.K:12,fla=fl0-fdl/2,flo=fo0-fdo/2,fbl=fdl/fK,fbo=fdo/fK,roads=!!ROADS&&zoom>=10;
  for(let b=b0;b<=b1;b++)for(let a=a0;a<=a1;a++){
    const wx=(a+.5+(hash3(a,b,1)-.5)*.8)*S,wy=(b+.5+(hash3(a,b,2)-.5)*.8)*S;
    const lon=wx/size*360-180,lat=180/Math.PI*Math.atan(Math.sinh(Math.PI-2*Math.PI*wy/size));
    const v=Math.min(100,fieldAt(F,lat,lon)*gain);
    if(v<20)continue;
    if(hash3(a,b,3)>Math.min(1,(v-16)/55))continue;
    if(FINE&&FINE.urb){const fy=Math.floor((lat-fla)/fbl),fx=Math.floor((lon-flo)/fbo);if(fy>=0&&fx>=0&&fy<FINE.FH&&fx<FINE.FW&&FINE.urb[fy*FINE.FW+fx])continue}   // agglomération
    if(roads&&nearRoad(lat,lon,140))continue;                                                                                                               // axe routier
    g.fillStyle=DOTC[Math.round(v)];
    g.beginPath();g.arc(wx-wx0,wy-wy0,1.1+1.9*Math.min(1,v/90),0,6.2832);g.fill();g.stroke();
  }
}
// ---------- UI ----------
// ---------- Mémoire des choix et lien partageable ----------
const PREF_KEY="cm:v1",INIT_HASH=location.hash||"";   // le lien d'origine est lu une fois : render() réécrit le hash
function loadPrefs(){
  let p={};try{p=JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch(e){}
  const h=new URLSearchParams(INIT_HASH.replace(/^#/,""));
  const sp=h.has("e")?+h.get("e"):p.sp;if(Number.isInteger(sp)&&sp>=0&&sp<SP.length)st.sp=sp;
  const v=h.get("v")||p.view;if(VIEWS.some(x=>x.k==v))st.view=v;
  if(p.mode==="flat"||p.mode==="dots")st.mode=p.mode;
  if(typeof p.gray==="boolean")$("gray").checked=p.gray;
  if(p.cvd===true){$("cvd").checked=true;setPalette("cvd")}
  $("mode").value=st.mode;
  $("map").classList.toggle("gray",$("gray").checked);
}
function savePrefs(){
  try{localStorage.setItem(PREF_KEY,JSON.stringify({sp:st.sp,view:st.view,mode:st.mode,gray:$("gray").checked,cvd:$("cvd").checked}))}catch(e){}
  try{const h=["e="+st.sp,"v="+st.view];if(st.pt)h.push("p="+st.pt.lat.toFixed(5)+","+st.pt.lon.toFixed(5));history.replaceState(null,"","#"+h.join("&"))}catch(e){}
}
function scrollToDetail(){
  const a=$("side"),d=$("detail");if(!a||!d)return;
  const g=$("grab"),top=d.getBoundingClientRect().top-a.getBoundingClientRect().top+a.scrollTop-10-(g?g.offsetHeight:0);
  try{a.scrollTo({top,behavior:"smooth"})}catch(e){a.scrollTop=top}
}
function build(){
  Z.forEach((z,i)=>z.i=i);
  const GR=[["foret","En forêt"],["prairie","Prairies et lisières"],["bois","Sur bois"]];
  $("chips").innerHTML=GR.map(([k,l])=>`<span class="glab">${l}</span>`+SP.map((s,i)=>s.grp==k?`<button aria-pressed="${i==st.sp}" data-i="${i}"${s.toxic?' class="tox" title="Espèce toxique"':""}>${s.n}${s.toxic?' <span aria-hidden="true">⚠</span><span class="sr"> (toxique)</span>':""}</button>`:"").join("")).join("");
  $("chips").onclick=e=>{const b=e.target.closest("button");if(!b)return;st.sp=+b.dataset.i;render()};
  $("mode").onchange=e=>{st.mode=e.target.value;render()};
  $("detail").onclick=e=>{const li=e.target.closest(".spots li");if(li&&st.spots){const c=st.spots[+li.dataset.i];if(c)goSpot(c)}};
  $("gray").onchange=e=>{$("map").classList.toggle("gray",e.target.checked);savePrefs()};
  $("cvd").onchange=e=>{setPalette(e.target.checked?"cvd":"std");savePrefs();render()};
  $("calque").onchange=e=>setCalque(e.target.value);
  $("cnv").onchange=e=>setContours(e.target.checked);
  $("actSave").onclick=toggleSpotAtPoint;$("actFind").onclick=openFindQ;
  $("fqNo").onclick=closeFindQ;$("findq").addEventListener("click",e=>{if(e.target===$("findq"))closeFindQ()});
  $("fqOk").onclick=()=>{
    if(!st.pt)return closeFindQ();
    const r=recordFind(st.pt.lat,st.pt.lon,$("fqSp").value,$("fqDate").value,$("fqQty").value);closeFindQ();
    spotSay("Trouvaille enregistrée"+(r.find.m?" · modèle : "+r.find.m.sc+"/100":""));
  };
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("findq").hidden)closeFindQ()});
  (function(){const g=$("grab");if(!g)return;
    let y0=0,h0=0,drag=false,moved=false,skip=false;
    g.addEventListener("pointerdown",e=>{drag=true;moved=false;y0=e.clientY;h0=$("side").getBoundingClientRect().height;try{g.setPointerCapture(e.pointerId)}catch(x){}$("side").classList.add("dragging")});
    g.addEventListener("pointermove",e=>{if(!drag)return;const dy=y0-e.clientY;if(Math.abs(dy)>4)moved=true;document.documentElement.style.setProperty("--sheet-h",Math.max(SHEET_MIN,Math.min(innerHeight*.92,h0+dy))+"px")});
    const end=e=>{if(!drag)return;drag=false;$("side").classList.remove("dragging");if(!moved)return;skip=true;setSheet(snapSheet($("side").getBoundingClientRect().height,y0-e.clientY));ensureVisible()};
    g.addEventListener("pointerup",end);g.addEventListener("pointercancel",end);
    g.addEventListener("click",()=>{if(skip){skip=false;return}setSheet(st.sheet==="half"?"full":"half");ensureVisible()});
    g.addEventListener("keydown",e=>{if(e.key==="ArrowUp"){e.preventDefault();setSheet(st.sheet==="peek"?"half":"full")}else if(e.key==="ArrowDown"){e.preventDefault();setSheet(st.sheet==="full"?"half":"peek")}});
    addEventListener("resize",()=>setSheet(st.sheet||"half"));setSheet("half");
  })();
  document.querySelectorAll("#chips,#days,.ctlrow .chips.seg").forEach(el=>el.addEventListener("scroll",updFade,{passive:true}));
  addEventListener("resize",updFade);addEventListener("resize",placeEmpty);setTimeout(updFade,400);
  map.on("zoomend",cnvNote);
  $("helpbtn").onclick=()=>{const d=$("howto");d.open=true;d.scrollIntoView({behavior:"smooth",block:"start"})};
  $("legtoggle").onclick=()=>{const l=$("maplegend"),m=l.classList.toggle("min");$("legtoggle").setAttribute("aria-expanded",String(!m))};
  if(innerWidth<=860)$("maplegend").classList.add("min");
  $("map").classList.toggle("gray",$("gray").checked);
  $("views").innerHTML=VIEWS.map(v=>`<button data-v="${v.k}" aria-pressed="${v.k==st.view}">${v.t}</button>`).join("");
  $("views").onclick=e=>{const b=e.target.closest("button");if(!b)return;st.view=b.dataset.v;render()};
  $("days").innerHTML=[...Array(9)].map((_,k)=>{const i=k-1,dt=dateOf(i);const t=i==-1?"Hier":i==0?"Auj.":dt.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric"});return`<button data-d="${i}" aria-pressed="${i==st.day}">${t}</button>`}).join("");
  $("days").onclick=e=>{const b=e.target.closest("button");if(!b)return;st.day=+b.dataset.d;render()};
  [["rain","rain"],["dt","dt"]].forEach(([id,k])=>$(id).oninput=e=>{st[k]=+e.target.value;render()});
}
function updFade(){
  document.querySelectorAll("#chips,#days,.ctlrow .chips.seg").forEach(el=>el.classList.toggle("more",el.scrollWidth-el.clientWidth-el.scrollLeft>4));
}
function render(){
  const sp=SP[st.sp],d=st.day;
  setTimeout(updFade,0);
  if(st.live){renderMySpots();scheduleNow()}
  document.querySelectorAll("#chips button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.i===st.sp));
  document.querySelectorAll("#days button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.d==d));
  document.querySelectorAll("#views button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v==st.view));
  $("viewnote").textContent=VIEWS.find(v=>v.k==st.view).note;
  $("days").closest(".ctlrow").style.display=(st.view=="dur"||st.view=="best")?"none":"";
  $("rainv").textContent=st.rain+" % de la normale";
  $("dtv").textContent=(st.dt>0?"+":"")+st.dt+" °C";
  const live=!!st.live;
  $("manual").style.display=live?"none":"";
  $("status").className="badge"+(live?" live":"");
  $("status").textContent=live?(st.off>st.past+1?"⚠ Données du "+st.dataDate+" (anciennes) : lancez une mise à jour":"Météo réelle (Open-Meteo), grille de "+Z.length+" mailles"):"Météo simulée : normales de saison, ajustez les curseurs";
  if(st.day<0)$("status").textContent+=" · Hier : conditions observées, pas prévues";
  $("fetched").style.display=st.fetchedAt?"":"none";
  if(st.fetchedAt)$("fetched").textContent="Données récupérées le "+st.fetchedAt;
  // champ de score : fin (forêt à 1,4 km) si disponible, sinon grossier
  ensureAll();
  const sc=Z.map(z=>({z,r:viewScore(sp,z)}));
  st.F=(st.live&&FINE&&st.view!=="all")?buildFineField(sc,sp):buildField(sc);   // en vue « toutes », pas de détail fin propre à une espèce
  st.scoreSorted=Float32Array.from(sc.map(o=>o.r.sc)).sort();
  renderEmptyMap(st.scoreSorted,sp);
  const dots=st.mode=="dots"&&!!st.F;
  if(dots){if(heatOverlay)heatOverlay.setOpacity(0)}else{if(heatOverlay)heatOverlay.setOpacity(1);paintHeat(sc)}
  drawDots();
  drawOutline();
  renderSpecies();
  renderPointMarker();
  if(st.spotData&&st.spotData.state=="ok")renderSpots();else renderDetail();
  savePrefs();
}
// ---------- Fiche espèce : photo Wikipédia/Wikimedia Commons (licence libre, auteur crédité) ----------
const PHOTOS={};
function renderSpecies(){
  const sp=SP[st.sp];
  renderSosies(sp);
  renderCurves(sp,st.ptZ&&st.pt?st.ptZ:null,st.ptZ&&st.pt&&st.live?(()=>{try{return score(sp,st.ptZ,st.day).w.T}catch(e){return null}})():null,st.day);
  $("spname").textContent=sp.n;$("splat").textContent=sp.lat||"";$("spsumn").textContent=sp.n;$("spsuml").textContent=(sp.lat||"")+(sp.toxic?" · TOXIQUE":"");$("toxban").hidden=!sp.toxic;$("spwarn").hidden=!!sp.toxic;
  const spRows=[["Arbres hôtes",(sp.hote?hostChips(sp.n)+"<span class=\"hnote\">"+sp.hote+"</span>":"")],["Sol",sp.sol],["Sol (modèle)",sp.ph?soilModelText(sp):""],["Forêt (modèle)",sp.open?"Lisières, clairières et prairies favorables (clairière 90 %, prairie 70 %, culture 15 %) ; forêt dense moins favorable. Estimé d'après l'écologie générale de l'espèce (saprophyte), sans étude de rendement.":"Arbre hôte nécessaire : un bloc sans forêt vaut 3 %, un bloc à demi boisé 55 %."],["Relief (modèle)","Versant nord et dépression favorables quand l'humidité manque (jusqu'à +25 %), pente au-delà de 15° pénalisée (jusqu'à −30 %), température corrigée de l'altitude (−6,5 °C par km). Étayé en Espagne méditerranéenne ; effet inverse signalé en climat humide."],["Saison",sp.saison],["Altitude",sp.alt],["Elle sort quand",sp.txt],["Reconnaître",sp.id]].filter(r=>r[1]);
  const rowsHtml=a=>a.map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("");
  $("spdl").innerHTML=rowsHtml(spRows.filter(r=>!/\(modèle\)$/.test(r[0])));
  const tech=spRows.filter(r=>/\(modèle\)$/.test(r[0]));
  $("spmodel").innerHTML=tech.length?`<details class="mdl"><summary>Détails du modèle</summary><dl>${rowsHtml(tech.map(r=>[r[0].replace(" (modèle)",""),r[1]]))}</dl></details>`:"";
  const img=$("spimg"),cap=$("spcap"),k=st.sp,P=PHOTOS[k];
  const show=p=>{if(st.sp!==k)return;if(!p){img.style.visibility="hidden";cap.textContent="";$("spthumb").removeAttribute("src");return}$("spthumb").src=p.src;img.style.visibility="visible";img.alt=sp.n+" ("+sp.lat+")";img.src=p.src;cap.innerHTML=p.cap};
  if(P!==undefined){show(P);return}
  img.style.visibility="hidden";cap.textContent="Chargement de la photo…";
  loadPhoto(sp).then(p=>{PHOTOS[k]=p;show(p);if(st.ptZ&&st.spots&&st.sp===k)renderSpots(true)});
}
async function loadPhoto(sp){
  const J=async(u)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw 0;return await r.json()}finally{clearTimeout(t)}};
  try{
    let j=await J("https://fr.wikipedia.org/api/rest_v1/page/summary/"+sp.wiki);
    if(!(j.thumbnail&&j.thumbnail.source))j=await J("https://en.wikipedia.org/api/rest_v1/page/summary/"+sp.wiki);   // repli : page anglaise
    const th=j.thumbnail&&j.thumbnail.source;if(!th)return null;
    const src=th.replace(/\/\d+px-/,"/500px-"),path=new URL(th).pathname;
    const fn=decodeURIComponent(path.includes("/thumb/")?path.split("/thumb/")[1].split("/")[2]:path.split("/").pop());
    let cap=`Photo : Wikimedia Commons · <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fn)}" target="_blank" rel="noopener">source et licence</a>`;
    try{
      const m=await J("https://commons.wikimedia.org/w/api.php?"+new URLSearchParams({action:"query",titles:"File:"+fn,prop:"imageinfo",iiprop:"extmetadata",format:"json",origin:"*"}));
      const ii=Object.values(m.query.pages)[0].imageinfo[0].extmetadata,art0=(ii.Artist&&ii.Artist.value||"").replace(/<[^>]+>/g,"").trim(),art=/voir ci-dessous|see below|created by us|\.(jpe?g|png)\b/i.test(art0)||art0.length<3?"":art0,lic=ii.LicenseShortName&&ii.LicenseShortName.value;
      cap=`Photo : ${art||"auteur indiqué sur la source"}${lic?" · "+lic:""} · <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fn)}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
    }catch(e){}
    return{src,cap,thumb:src.replace(/\/\d+px-/,"/120px-")};
  }catch(e){return null}
}
// ---------- Calques : type de forêt (blocs de ~1,4 km) et pH du sol (blocs de ~2,8 km), tirés des grilles déjà chargées ----------
// Chaque ligne de la grille est replacée en projection Mercator (la grille est linéaire en latitude, la carte non) : sans cela, les blocs
// dériveraient de plusieurs dizaines de km au centre de la France.
let calqueLayer=null;
const FCOL=[null,[46,125,50],[18,82,98],[150,150,40],[132,186,132],[110,160,175],[200,200,110],[224,232,180]];   // classes de FINE.cls : 1-3 dense, 4-6 épars, 7 prairie
const PHSTOPS=[[4.5,179,88,6],[5.5,241,163,64],[6.5,247,247,247],[7.5,153,142,195],[8.3,84,39,136]];             // diverging orange - blanc - violet (sûr en daltonisme)
function phRGB(p){
  p=Math.max(PHSTOPS[0][0],Math.min(PHSTOPS[PHSTOPS.length-1][0],p));let i=1;
  while(i<PHSTOPS.length-1&&p>PHSTOPS[i][0])i++;
  const a=PHSTOPS[i-1],b=PHSTOPS[i],t=(p-a[0])/(b[0]-a[0]);return[1,2,3].map(k=>Math.round(a[k]+(b[k]-a[k])*t));
}
function calqueImage(key){
  if(!heatGeom)return null;
  const{la0,lo0,dLat,dLon}=heatGeom;let W,H,K,get;
  if(key==="foret"){
    if(!FINE)return null;W=FINE.FW;H=FINE.FH;K=FINE.K;
    get=(y,x)=>{const i=y*W+x,c=FINE.cls[i];if(!c||FINE.urb[i])return null;const f=FCOL[c];return[f[0],f[1],f[2],c===7?110:c>=4?150:205]};
  }else if(key==="ph"){
    if(!SOL||!SOL.ph)return null;W=SOL.w;K=SOL.K;H=SOL.h||Math.round(SOL.ph.length/W);
    get=(y,x)=>{const v=SOL.ph[y*W+x];if(v===255)return null;const c=phRGB(v/10);return[c[0],c[1],c[2],170]};
  }else return null;
  const latS=la0-dLat/2,bl=dLat/K,latN=latS+H*bl,lonW=lo0-dLon/2,lonE=lonW+W*(dLon/K);
  const mer=la=>Math.log(Math.tan(Math.PI/4+la*Math.PI/360)),inv=y=>(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI;
  const yT=mer(latN),yB=mer(latS),cv=document.createElement("canvas");cv.width=W;cv.height=H;
  const cx=cv.getContext("2d"),im=cx.createImageData(W,H),d=im.data;let n=0;
  for(let oy=0;oy<H;oy++){
    const lat=inv(yT+(yB-yT)*(oy+.5)/H),fy=Math.max(0,Math.min(H-1,Math.floor((lat-latS)/bl)));
    for(let x=0;x<W;x++){const c=get(fy,x);if(!c)continue;const o=(oy*W+x)*4;d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=c[3];n++}
  }
  cx.putImageData(im,0,0);
  return{url:cv.toDataURL("image/png"),bounds:[[latS,lonW],[latN,lonE]],n};
}
function calqueLegend(key){
  const sw=(c,l)=>`<span class="it"><i class="sw" style="background:rgb(${c.join(",")})"></i>${l}</span>`;
  if(key==="foret")return "<b>Type de forêt</b><br>"+sw(FCOL[1],"Feuillus")+sw(FCOL[2],"Résineux")+sw(FCOL[3],"Mixte")+sw(FCOL[4],"Bois épars (teinte claire)")+sw(FCOL[7],"Prairie, milieu ouvert");
  const g=PHSTOPS.map(s=>`rgb(${s[1]},${s[2]},${s[3]}) ${Math.round((s[0]-4.5)/3.8*100)}%`).join(",");
  return `<b>pH du sol</b><div class="calbar" style="background:linear-gradient(90deg,${g})"></div><div class="calrow"><span>4,5 acide</span><span>6,5 neutre</span><span>8,3 calcaire</span></div>`;
}
function setCalque(key){
  st.calque=key||"";
  if(calqueLayer){map.removeLayer(calqueLayer);calqueLayer=null}
  const lg=$("calleg");lg.hidden=true;lg.textContent="";
  if(!st.calque)return;
  const img=calqueImage(st.calque);
  if(!img){spotSay("Calque indisponible : données pas encore chargées.");st.calque="";$("calque").value="";return}
  if(!map.getPane("calque")){map.createPane("calque");const p=map.getPane("calque");p.style.zIndex=390;p.style.pointerEvents="none"}
  calqueLayer=L.imageOverlay(img.url,img.bounds,{pane:"calque",opacity:1,interactive:false}).addTo(map);
  lg.innerHTML=calqueLegend(st.calque);lg.hidden=false;
}
// ---------- État vide : aucune zone favorable (hors saison) -> expliquer et proposer des espèces qui sortent ----------
let EMPTYC={key:"",out:null};
// Sur mobile, le message vit dans le tiroir : superposé à la carte, il cacherait la moitié nord de la France.
function placeEmpty(){
  const box=$("emptymap"),host=mqMobile.matches?$("emptyside"):$("mapwrap");
  if(!box||!host||box.parentNode===host)return;
  if(host===$("mapwrap"))host.insertBefore(box,$("map"));else host.appendChild(box);
}
function renderEmptyMap(sorted,sp){
  const box=$("emptymap");if(!box)return;placeEmpty();
  const best=sorted&&sorted.length?sorted[sorted.length-1]:0,tok=st.emptyTok=(st.emptyTok||0)+1,vk=sp.n+"|"+st.view+"|"+st.day;
  box.textContent="";
  if(st.view==="all"&&st.allJob){box.hidden=true;return}   // calcul en cours : rien à conclure
  if(st.emptyHide&&st.emptyHide!==vk)st.emptyHide=null;   // la fermeture ne vaut que pour l'état où elle a été faite
  if(!sorted||!sorted.length||best>=22||st.emptyHide===vk){box.hidden=true;return}
  if(st.view==="all"){
    const t0=document.createElement("p"),x0=document.createElement("button");
    t0.innerHTML=`<b>Aucune zone favorable</b> ${st.day>0?"à cette date":"aujourd'hui"}, toutes espèces confondues. <span class="sub">Meilleur score en France : ${Math.round(best)}/100.</span> C'est la fin de saison : revenez dans quelques jours.`;
    x0.type="button";x0.className="x";x0.textContent="×";x0.setAttribute("aria-label","Masquer ce message");x0.onclick=()=>{st.emptyHide=vk;box.hidden=true};
    box.append(x0,t0);box.hidden=false;return;
  }
  const when=st.view==="hab"?"dans cette vue":st.view==="day"?"à cette date":"cette semaine";
  const d0=Math.max(0,st.day),today=d0>0?"à cette date":"aujourd'hui";
  const t=document.createElement("p"),x=document.createElement("button"),alts=document.createElement("div");
  t.innerHTML=`<b>Aucune zone favorable</b> pour ${sp.n} ${when}. <span class="sub">Meilleur score en France : ${Math.round(best)}/100.</span>`;
  x.type="button";x.className="x";x.textContent="×";x.setAttribute("aria-label","Masquer ce message");x.onclick=()=>{st.emptyHide=vk;box.hidden=true};
  alts.className="alts";alts.textContent="Recherche d'espèces favorables…";
  box.append(x,t,alts);box.hidden=false;
  const show=list=>{
    if(tok!==st.emptyTok)return;alts.textContent="";
    const pick=list.filter(o=>o.i!==st.sp&&o.n>=10).sort((a,b)=>b.n-a.n).slice(0,3);
    if(!pick.length){alts.textContent="Aucune espèce du catalogue n'est favorable "+today+" : c'est la fin de saison. Revenez dans quelques jours.";return}
    alts.append("Favorables "+today+" (zones) : ");
    pick.forEach(o=>{const b=document.createElement("button");b.type="button";b.className="btn";b.textContent=SP[o.i].n+" · "+o.n;b.title=o.n+" zones favorables";
      b.onclick=()=>{const c=document.querySelector('#chips button[data-i="'+o.i+'"]');if(c)c.click()};alts.appendChild(b)});
  };
  const key=[st.fetchedAt,st.dataDate,d0,st.rain,st.dt,st.live?1:0].join("|");
  if(EMPTYC.key===key&&EMPTYC.out){show(EMPTYC.out);return}
  const out=[];let k=0;
  const step=()=>{
    if(tok!==st.emptyTok)return;
    const s2=SP[k];
    if(!s2.toxic){let n=0;for(const z of Z)if(score(s2,z,d0).sc>=22)n++;out.push({i:k,n})}
    if(++k<SP.length)setTimeout(step,0);else{EMPTYC={key,out};show(out)}
  };
  setTimeout(step,0);
}
// ---------- Courbes de niveau : tuiles IGN (RGE ALTI, équidistance 5 m), visibles à partir du zoom 11 ----------
let cnvLayer=null,cnvFail=false;
const CNV_MINZ=11;
function cnvNote(){
  const n=$("cnvnote");if(!n)return;
  if(!cnvLayer){n.hidden=true;return}
  if(cnvFail)n.textContent="Courbes de niveau indisponibles pour le moment (service IGN).";
  else if(map.getZoom()<CNV_MINZ)n.textContent="Courbes de niveau : zoomez (niveau "+CNV_MINZ+" ou plus) pour les voir.";
  else n.textContent="Courbes de niveau IGN, tous les 5 m.";
  n.hidden=false;
}
function setContours(on){
  if(cnvLayer){map.removeLayer(cnvLayer);cnvLayer=null}
  cnvFail=false;
  if(on){
    if(!map.getPane("cnv")){map.createPane("cnv");const p=map.getPane("cnv");p.style.zIndex=450;p.style.pointerEvents="none"}
    let ok=0,err=0;
    cnvLayer=L.tileLayer("https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ELEVATION.CONTOUR.LINE&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
      {pane:"cnv",minZoom:CNV_MINZ,maxNativeZoom:18,opacity:.85,attribution:"Courbes de niveau © IGN",errorTileUrl:"data:image/gif;base64,R0lGODlhAQABAAAAACw="}).addTo(map);
    cnvLayer.on("tileload",()=>{ok++;if(cnvFail){cnvFail=false;cnvNote()}});
    cnvLayer.on("tileerror",()=>{err++;if(!ok&&err>=3&&!cnvFail){cnvFail=true;cnvNote()}});
  }
  cnvNote();
}
// ---------- Vos espèces ici + Conditions ici : jauges lisibles, fondées sur les paramètres réels du modèle ----------
const LEVEL_WORD=["Très peu propice","Peu propice","Moyennement propice","Propice","Très propice"];
function lvlWord(f){return f<.34?"Défavorable":f<.67?"Moyen":"Favorable"}
function insertBeforeDetails(el){const det=$("detail").querySelector("details");if(det)det.parentNode.insertBefore(el,det);else $("detail").appendChild(el)}
// segs : [début, fin, classe] avec classe 0 = hors plage, 1 = toléré, 2 = idéal ; le repère marque la valeur actuelle
function gaugeHtml(min,max,segs,val){
  const pct=v=>Math.max(0,Math.min(100,(v-min)/(max-min)*100));
  return `<div class="gauge" aria-hidden="true">${segs.map(g=>`<i class="s${g[2]}" style="flex:${Math.max(.001,g[1]-g[0]).toFixed(3)}"></i>`).join("")}${val!=null?`<b class="mk" style="left:${pct(val).toFixed(1)}%"></b>`:""}</div>`;
}
function condCard(title,sub,val,f,gauge,note){
  const k=f==null?"n":f<.34?"d":f<.67?"m":"f";
  return `<div class="cc cc-${k}"><div class="cct">${title}</div><div class="ccs">${sub}</div><div class="ccv">${val}</div>${f!=null?`<div class="ccl">${lvlWord(f)}</div>`:""}${gauge||""}${note?`<div class="ccn">${note}</div>`:""}</div>`;
}
function rainTotals(z,d){
  const L=z&&(z.L||(st.live&&z.i>=0?st.live[z.i]:null));if(!L||!L.p)return null;
  const e=Math.min((L.off!=null?L.off:st.off)+Math.min(0,d),L.p.length-1);let tot=0,ago=-1;
  for(let k=0;k<14;k++){const i=e-k;if(i<0)break;tot+=Math.max(0,L.p[i]||0);if(ago<0&&(L.p[i]||0)>=8)ago=k}
  return{tot:Math.round(tot),ago};
}
function conditionsHook(sp,z,r,d){
  const w=r.w,fr=n=>String(n).replace(".",","),cards=[],t=sp.t,MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  cards.push(condCard("Température","moyenne des "+(sp.tw||7)+" derniers jours",fr(w.T.toFixed(1))+" °C",r.tf,
    gaugeHtml(t[0]-4,t[3]+4,[[t[0]-4,t[0],0],[t[0],t[1],1],[t[1],t[2],2],[t[2],t[3],1],[t[3],t[3]+4,0]],w.T),"idéal "+t[1]+" à "+t[2]+" °C"));
  if(w.SM!=null){
    const h=sp.hu||[.12,.3],mn=Math.max(0,h[0]-.1),mx=h[1]+.12;
    cards.push(condCard("Humidité du sol","moyenne des 7 derniers jours",Math.round(w.SM*100)+" %",r.rf,
      gaugeHtml(mn,mx,[[mn,h[0],0],[h[0],h[1],1],[h[1],mx,2]],w.SM),"pleinement favorable dès "+Math.round(h[1]*100)+" %"));
  }else{
    cards.push(condCard("Pluie (météo simulée)","décalée de "+(sp.lag||0)+" jours",Math.round(w.R)+" mm",r.rf,
      gaugeHtml(0,sp.ro*4,[[0,sp.ro*.25,0],[sp.ro*.25,sp.ro,1],[sp.ro,sp.ro*4,2]],w.R),"optimum dès "+sp.ro+" mm"));
  }
  if(sp.rr&&w.RL!=null){
    cards.push(condCard("Pluie cumulée","sur "+sp.rw+" jours, fenêtre décalée selon l'espèce",Math.round(w.RL)+" mm",clamp(w.RL/sp.rr),
      gaugeHtml(0,sp.rr*1.5,[[0,sp.rr,1],[sp.rr,sp.rr*1.5,2]],w.RL),"pleine intensité dès "+sp.rr+" mm"));
  }else{
    const rt=rainTotals(z,d);
    if(rt)cards.push(condCard("Pluie récente","cumul des 14 derniers jours",rt.tot+" mm",null,"",
      (rt.ago<0?"aucune pluie d'au moins 8 mm":rt.ago===0?"dernière pluie d'au moins 8 mm : aujourd'hui":"dernière pluie d'au moins 8 mm : il y a "+rt.ago+" j")+" · pour information : cette espèce est jugée sur l'humidité du sol"));
  }
  const gm=Math.max(...sp.gb);
  cards.push(condCard("Saison",MOIS[dateOf(d).getMonth()],Math.round(r.sf*100)+" %",gm>0?clamp(r.sf/gm):0,
    gaugeHtml(0,gm,[[0,gm*.34,0],[gm*.34,gm*.67,1],[gm*.67,gm,2]],Math.min(r.sf,gm)),"poids du mois dans les observations (pic en "+MOIS[sp.gb.indexOf(gm)]+")"));
  const box=document.createElement("section");box.className="cond";
  box.innerHTML=`<h4>Conditions ici</h4><p class="cap">évaluées pour ${sp.n}</p><div class="ccg">${cards.join("")}</div>`;
  insertBeforeDetails(box);
}
function speciesHook(z,d){
  const rows=SP.map((s,i)=>({s,i,sc:s.toxic?-1:score(s,z,d).sc})).filter(x=>x.sc>=0).sort((a,b)=>b.sc-a.sc).slice(0,8);
  const box=document.createElement("section");box.className="sphere";
  const grad="linear-gradient(90deg,var(--line) 0 22%,"+STOPS.map(x=>`rgb(${x[1]},${x[2]},${x[3]}) ${x[0]}%`).join(",")+")";
  box.innerHTML=`<h4>Vos espèces ici</h4><p class="cap">Chaque espèce est jugée sur sa propre échelle. Touchez-en une pour la voir sur la carte.</p>`;
  const ul=document.createElement("ul");
  rows.forEach(x=>{
    const li=document.createElement("li"),b=document.createElement("button");
    b.type="button";b.className="spr"+(x.i===st.sp?" cur":"");b.dataset.i=x.i;if(x.i===st.sp)b.setAttribute("aria-current","true");
    b.innerHTML=`<span class="spn">${x.s.n}</span><span class="spl">${LEVEL_WORD[spLevel(x.sc)]}</span><span class="spv">${x.sc}</span><span class="spg" aria-hidden="true" style="background:${grad}"><b class="mk" style="left:${x.sc}%"></b></span>`;
    b.onclick=()=>{const c=document.querySelector('#chips button[data-i="'+x.i+'"]');if(c)c.click()};
    li.appendChild(b);ul.appendChild(li);
  });
  box.appendChild(ul);insertBeforeDetails(box);
}
// ---------- Pluie des 14 derniers jours (séries déjà chargées) ----------
function rainHook(z,d){
  const L=z&&(z.L||(st.live&&z.i>=0?st.live[z.i]:null)),box=document.createElement("div"),h=document.createElement("h4");
  box.className="rain";h.textContent="Pluie des 14 derniers jours";box.appendChild(h);
  const cap=document.createElement("p");cap.className="cap";box.appendChild(cap);
  if(!L||!L.p){cap.textContent="Pluie réelle indisponible (météo simulée).";$("detail").appendChild(box);return}
  const e=Math.min((L.off!=null?L.off:st.off)+d,L.p.length-1),days=[];
  for(let k=13;k>=0;k--){const i=e-k;if(i<0)continue;days.push({rel:d-k,mm:Math.max(0,L.p[i]||0)})}
  const obs=days.filter(x=>x.rel<=0),tot=Math.round(obs.reduce((t,x)=>t+x.mm,0)),mx=Math.max(10,...days.map(x=>x.mm));
  let ago=-1;for(let k=obs.length-1;k>=0;k--)if(obs[k].mm>=1){ago=obs.length-1-k;break}
  const when=ago<0?"aucune pluie ≥ 1 mm":ago===0?"dernière pluie (≥ 1 mm) : aujourd'hui":ago===1?"dernière pluie (≥ 1 mm) : hier":"dernière pluie (≥ 1 mm) : il y a "+ago+" jours";
  cap.textContent="Cumul observé sur "+obs.length+" jours : "+tot+" mm · "+when+(days.some(x=>x.rel>0)?" · barres claires : prévision":"");
  const W=300,H=72,pt=10,pb=14,bw=W/days.length,fmt=r=>r===0?"auj.":dateOf(r).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
  const bars=days.map((x,i)=>{const hh=x.mm>0.05?Math.max(1.5,x.mm/mx*(H-pt-pb)):.8;
    return `<rect class="rn-b${x.rel>0?" f":""}" x="${(i*bw+1.5).toFixed(1)}" y="${(H-pb-hh).toFixed(1)}" width="${(bw-3).toFixed(1)}" height="${hh.toFixed(1)}" rx="1.5"><title>${fmt(x.rel)} : ${Math.round(x.mm*10)/10} mm</title></rect>`}).join("");
  const svg=`<svg class="cv rn" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pluie quotidienne sur ${days.length} jours : cumul observé ${tot} millimètres, maximum ${Math.round(Math.max(...days.map(x=>x.mm)))} millimètres en un jour">${bars}<text x="2" y="8">${Math.round(mx)} mm</text><text x="2" y="${H-3}">${fmt(days[0].rel)}</text><text x="${W-2}" y="${H-3}" text-anchor="end">${fmt(days[days.length-1].rel)}</text></svg>`;
  box.insertAdjacentHTML("beforeend",svg);$("detail").appendChild(box);
}
// ---------- Sosies dangereux et avertissement (données sourcées : SOSIES, SOURCES dans species.js) ----------
const GRAV={mortel:"Mortel",toxique:"Toxique",nc:"Non comestible"};
function srcLinks(keys){
  const sp=document.createElement("span");sp.className="srcs";sp.append("Sources : ");
  keys.forEach((k,i)=>{const S=SOURCES[k];if(!S)return;if(i)sp.append(" · ");const a=document.createElement("a");a.href=S.u;a.target="_blank";a.rel="noopener";a.textContent=S.t;sp.appendChild(a)});
  return sp;
}
function renderSosies(sp){
  const box=$("spsos");if(!box)return;box.textContent="";
  const h=document.createElement("h4");h.textContent="Sosies dangereux";box.appendChild(h);
  const list=SOSIES[sp.n];
  if(list&&list.length){
    const ul=document.createElement("ul");ul.className="sosl";
    list.forEach(x=>{
      const li=document.createElement("li"),b=document.createElement("b"),g=document.createElement("span"),p=document.createElement("p");
      b.textContent=x.n;g.className="grav g-"+x.g;g.textContent=GRAV[x.g]||x.g;p.textContent=x.c;
      li.append(b," ",g,p,srcLinks(x.s));ul.appendChild(li);
    });
    box.appendChild(ul);
  }else{
    const p=document.createElement("p");p.className="cap";
    p.textContent="Aucun sosie renseigné pour cette espèce dans nos sources. Cela ne veut pas dire qu'il n'en existe pas : faites contrôler votre récolte.";
    box.appendChild(p);
  }
  const w=document.createElement("div");w.className="safe";w.setAttribute("role","note");
  const t=document.createElement("p");
  t.textContent="Cette carte indique où chercher, pas ce qui se mange. Ne ramassez que des champignons que vous connaissez parfaitement, cueillez-les entiers et en bon état, évitez les jeunes spécimens, ne vous fiez pas aux applications de reconnaissance et faites contrôler votre récolte par un pharmacien ou une association mycologique avant de la manger. Symptômes après un repas de champignons : appelez le 15 ou votre centre antipoison.";
  w.append(t,srcLinks(["anses","pqd"]));box.appendChild(w);
}
// ---------- Icônes d'arbres hôtes : feuille de chaque arbre (24x24), toujours accompagnée du nom ----------
// Chaque icône est la silhouette de la FEUILLE (ou des aiguilles) de l'arbre : tracés générés à partir de profils (ovale, lancéolé, denté, lobé, composé), puis figés ici.
const TREE_ICONS={
  chene:{t:"Chêne",c:"f",s:'<path d="M12,22 L12.7,21.7 L13.1,21.4 L13.6,21.1 L14.1,20.9 L14.7,20.6 L15.3,20.3 L15.8,20 L16.3,19.7 L16.6,19.4 L16.8,19.1 L16.8,18.9 L16.7,18.6 L16.5,18.3 L16.2,18 L15.8,17.7 L15.5,17.4 L15.2,17.1 L15,16.9 L15,16.6 L15.1,16.3 L15.4,16 L15.8,15.7 L16.4,15.4 L17,15.1 L17.6,14.9 L18.2,14.6 L18.6,14.3 L18.9,14 L19,13.7 L18.9,13.4 L18.6,13.1 L18.2,12.9 L17.6,12.6 L17,12.3 L16.4,12 L15.9,11.7 L15.4,11.4 L15.2,11.1 L15,10.9 L15.1,10.6 L15.3,10.3 L15.6,10 L16,9.7 L16.4,9.4 L16.8,9.1 L17.2,8.9 L17.4,8.6 L17.5,8.3 L17.4,8 L17.1,7.7 L16.8,7.4 L16.3,7.1 L15.8,6.9 L15.3,6.6 L14.8,6.3 L14.3,6 L14,5.7 L13.7,5.4 L13.6,5.1 L13.5,4.9 L13.5,4.6 L13.6,4.3 L13.6,4 L13.6,3.7 L13.6,3.4 L13.5,3.1 L13.3,2.9 L13,2.6 L12.6,2.3 L12,2 L12,2 L11.7,2.3 L11.5,2.6 L11.3,2.9 L11.1,3.1 L10.8,3.4 L10.4,3.7 L10,4 L9.6,4.3 L9.2,4.6 L8.8,4.9 L8.5,5.1 L8.4,5.4 L8.3,5.7 L8.3,6 L8.5,6.3 L8.7,6.6 L9,6.9 L9.2,7.1 L9.4,7.4 L9.5,7.7 L9.5,8 L9.4,8.3 L9.1,8.6 L8.7,8.9 L8.2,9.1 L7.6,9.4 L7,9.7 L6.4,10 L5.9,10.3 L5.6,10.6 L5.4,10.9 L5.4,11.1 L5.6,11.4 L6,11.7 L6.4,12 L7,12.3 L7.5,12.6 L8,12.9 L8.4,13.1 L8.7,13.4 L8.8,13.7 L8.7,14 L8.4,14.3 L8,14.6 L7.5,14.9 L7,15.1 L6.5,15.4 L6,15.7 L5.7,16 L5.5,16.3 L5.6,16.6 L5.8,16.9 L6.1,17.1 L6.6,17.4 L7.2,17.7 L7.8,18 L8.4,18.3 L9,18.6 L9.4,18.9 L9.7,19.1 L9.9,19.4 L10,19.7 L9.9,20 L9.9,20.3 L9.8,20.6 L9.9,20.9 L10,21.1 L10.3,21.4 L10.8,21.7 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,16L15.6,14M12,16L8.4,14M12,11L15.6,9M12,11L8.4,9"/>'},
  hetre:{t:"Hêtre",c:"f",s:'<path d="M12,22 L13.9,21.3 L14.9,20.7 L15.6,20 L16.3,19.3 L16.9,18.7 L17.2,18 L17.6,17.3 L17.9,16.7 L18.1,16 L18.2,15.3 L18.4,14.7 L18.5,14 L18.3,13.3 L18.3,12.7 L18.4,12 L18.1,11.3 L17.8,10.7 L17.7,10 L17.4,9.3 L17,8.7 L16.8,8 L16.5,7.3 L16,6.7 L15.6,6 L15.2,5.3 L14.6,4.7 L14.1,4 L13.6,3.3 L12.9,2.7 L12,2 L12,2 L11.1,2.7 L10.4,3.3 L9.9,4 L9.4,4.7 L8.8,5.3 L8.4,6 L8,6.7 L7.5,7.3 L7.2,8 L7,8.7 L6.6,9.3 L6.3,10 L6.2,10.7 L5.9,11.3 L5.6,12 L5.7,12.7 L5.7,13.3 L5.5,14 L5.6,14.7 L5.8,15.3 L5.9,16 L6.1,16.7 L6.4,17.3 L6.8,18 L7.1,18.7 L7.7,19.3 L8.4,20 L9.1,20.7 L10.1,21.3 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,18L16.4,14.6M12,18L7.6,14.6M12,14.8L17.3,11.4M12,14.8L6.7,11.4M12,11.6L17.1,8.2M12,11.6L6.9,8.2M12,8.4L16.2,5M12,8.4L7.8,5"/>'},
  chataignier:{t:"Châtaignier",c:"f",s:'<path d="M12,22 L12.5,21.6 L13,21.2 L13.4,20.8 L13.8,20.3 L13.7,19.9 L14.1,19.5 L14.5,19.1 L14.9,18.7 L14.6,18.2 L14.9,17.8 L15.3,17.4 L15.7,17 L16,16.6 L15.5,16.2 L15.8,15.8 L16.2,15.3 L16.5,14.9 L15.8,14.5 L16.1,14.1 L16.4,13.7 L16.7,13.2 L15.9,12.8 L16.2,12.4 L16.4,12 L16.6,11.6 L16.8,11.2 L16,10.8 L16.1,10.3 L16.3,9.9 L16.4,9.5 L15.6,9.1 L15.7,8.7 L15.8,8.2 L15.8,7.8 L15,7.4 L15,7 L15,6.6 L15,6.2 L15,5.8 L14.2,5.3 L14.1,4.9 L14,4.5 L13.9,4.1 L13.2,3.7 L13.1,3.2 L12.9,2.8 L12.6,2.4 L12,2 L12,2 L11.4,2.4 L11.1,2.8 L10.9,3.2 L10.8,3.7 L10.1,4.1 L10,4.5 L9.9,4.9 L9.8,5.3 L9,5.8 L9,6.2 L9,6.6 L9,7 L9,7.4 L8.2,7.8 L8.2,8.2 L8.3,8.7 L8.4,9.1 L7.6,9.5 L7.7,9.9 L7.9,10.3 L8,10.8 L7.2,11.2 L7.4,11.6 L7.6,12 L7.8,12.4 L8.1,12.8 L7.3,13.2 L7.6,13.7 L7.9,14.1 L8.2,14.5 L7.5,14.9 L7.8,15.3 L8.2,15.8 L8.5,16.2 L8,16.6 L8.3,17 L8.7,17.4 L9.1,17.8 L9.4,18.2 L9.1,18.7 L9.5,19.1 L9.9,19.5 L10.3,19.9 L10.2,20.3 L10.6,20.8 L11,21.2 L11.5,21.6 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,19L13.8,16.2M12,19L10.2,16.2M12,16L14.9,13.2M12,16L9.1,13.2M12,13L15.3,10.2M12,13L8.7,10.2M12,10L15.1,7.2M12,10L8.9,7.2M12,7L14.4,4.2M12,7L9.6,4.2"/>'},
  charme:{t:"Charme",c:"f",s:'<path d="M12,22 L13.1,21.6 L13.8,21.2 L14.2,20.8 L14.5,20.5 L15.1,20.1 L15.5,19.7 L15.6,19.3 L15.9,18.9 L16.4,18.5 L16.6,18.2 L16.4,17.8 L16.9,17.4 L17.4,17 L17.2,16.6 L17,16.2 L17.5,15.8 L17.8,15.5 L17.5,15.1 L17.5,14.7 L18,14.3 L17.9,13.9 L17.5,13.5 L17.7,13.2 L18.1,12.8 L17.8,12.4 L17.3,12 L17.7,11.6 L17.9,11.2 L17.4,10.8 L17.1,10.5 L17.4,10.1 L17.4,9.7 L16.8,9.3 L16.7,8.9 L17,8.5 L16.6,8.2 L16.1,7.8 L16.2,7.4 L16.3,7 L15.8,6.6 L15.3,6.2 L15.4,5.8 L15.3,5.5 L14.7,5.1 L14.4,4.7 L14.4,4.3 L14.1,3.9 L13.5,3.5 L13.3,3.2 L13.1,2.8 L12.6,2.4 L12,2 L12,2 L11.4,2.4 L10.9,2.8 L10.7,3.2 L10.5,3.5 L9.9,3.9 L9.6,4.3 L9.6,4.7 L9.3,5.1 L8.7,5.5 L8.6,5.8 L8.7,6.2 L8.2,6.6 L7.7,7 L7.8,7.4 L7.9,7.8 L7.4,8.2 L7,8.5 L7.3,8.9 L7.2,9.3 L6.6,9.7 L6.6,10.1 L6.9,10.5 L6.6,10.8 L6.1,11.2 L6.3,11.6 L6.7,12 L6.2,12.4 L5.9,12.8 L6.3,13.2 L6.5,13.5 L6.1,13.9 L6,14.3 L6.5,14.7 L6.5,15.1 L6.2,15.5 L6.5,15.8 L7,16.2 L6.8,16.6 L6.6,17 L7.1,17.4 L7.6,17.8 L7.4,18.2 L7.6,18.5 L8.1,18.9 L8.4,19.3 L8.5,19.7 L8.9,20.1 L9.5,20.5 L9.8,20.8 L10.2,21.2 L10.9,21.6 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,18.4L15.4,15.6M12,18.4L8.6,15.6M12,15.6L16.4,12.8M12,15.6L7.6,12.8M12,12.8L16.6,10M12,12.8L7.4,10M12,10L16.1,7.2M12,10L7.9,7.2M12,7.2L15.2,4.4M12,7.2L8.8,4.4"/>'},
  orme:{t:"Orme",c:"f",s:'<path d="M12,22 L13.6,21.5 L14.6,21 L15.2,20.5 L15.6,20 L16.3,19.5 L17,19 L17.2,18.5 L17.3,18 L17.8,17.5 L18.3,17 L18.3,16.5 L18.2,16 L18.6,15.5 L19,15 L18.8,14.5 L18.6,14 L18.9,13.5 L19.2,13 L18.8,12.5 L18.4,12 L18.6,11.5 L18.8,11 L18.4,10.5 L17.9,10 L18,9.5 L18,9 L17.5,8.5 L17,8 L17,7.5 L16.9,7 L16.3,6.5 L15.7,6 L15.6,5.5 L15.4,5 L14.8,4.5 L14.2,4 L13.9,3.5 L13.5,3 L12.8,2.5 L12,2 L12,2 L11.5,2.5 L11,3 L10.7,3.5 L10.6,4 L10.2,4.5 L9.7,5 L9.6,5.5 L9.6,6 L9.2,6.5 L8.7,7 L8.7,7.5 L8.8,8 L8.4,8.5 L7.9,9 L8.1,9.5 L8.2,10 L7.8,10.5 L7.4,11 L7.6,11.5 L7.9,12 L7.5,12.5 L7.2,13 L7.5,13.5 L7.8,14 L7.5,14.5 L7.3,15 L7.7,15.5 L8,16 L7.9,16.5 L7.8,17 L8.2,17.5 L8.6,18 L8.6,18.5 L8.7,19 L9.2,19.5 L9.7,20 L9.9,20.5 L10.2,21 L10.9,21.5 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,18L15.7,15M12,18L8.3,15M12,14.4L16.6,11.4M12,14.4L7.4,11.4M12,10.8L16.3,7.8M12,10.8L7.7,7.8M12,7.2L15.1,4.2M12,7.2L8.9,4.2"/>'},
  frene:{t:"Frêne",c:"f",s:'<path d="M12,17.5 L13.2,17.7 L14.1,17.5 L15,17.2 L15.7,16.8 L16.3,16.2 L16.9,15.5 L17.3,14.7 L17.7,13.9 L18,12.8 L18,12.8 L16.9,12.8 L16,13 L15.1,13.2 L14.3,13.6 L13.6,14.1 L13,14.7 L12.5,15.4 L12.1,16.3 L12,17.5ZM12,17.5 L11.9,16.3 L11.5,15.4 L11,14.7 L10.4,14.1 L9.7,13.6 L8.9,13.2 L8,13 L7.1,12.8 L6,12.8 L6,12.8 L6.3,13.9 L6.7,14.7 L7.1,15.5 L7.7,16.2 L8.3,16.8 L9,17.2 L9.9,17.5 L10.8,17.7 L12,17.5ZM12,12 L13.2,12.2 L14.1,12 L15,11.7 L15.7,11.3 L16.3,10.7 L16.9,10 L17.3,9.2 L17.7,8.4 L18,7.3 L18,7.3 L16.9,7.3 L16,7.5 L15.1,7.7 L14.3,8.1 L13.6,8.6 L13,9.2 L12.5,9.9 L12.1,10.8 L12,12ZM12,12 L11.9,10.8 L11.5,9.9 L11,9.2 L10.4,8.6 L9.7,8.1 L8.9,7.7 L8,7.5 L7.1,7.3 L6,7.3 L6,7.3 L6.3,8.4 L6.7,9.2 L7.1,10 L7.7,10.7 L8.3,11.3 L9,11.7 L9.9,12 L10.8,12.2 L12,12ZM12,6.8 L13.2,7 L14.1,6.8 L15,6.5 L15.7,6.1 L16.3,5.5 L16.9,4.8 L17.3,4 L17.7,3.2 L18,2.1 L18,2.1 L16.9,2.1 L16,2.3 L15.1,2.5 L14.3,2.9 L13.6,3.4 L13,4 L12.5,4.7 L12.1,5.6 L12,6.8ZM12,6.8 L11.9,5.6 L11.5,4.7 L11,4 L10.4,3.4 L9.7,2.9 L8.9,2.5 L8,2.3 L7.1,2.1 L6,2.1 L6,2.1 L6.3,3.2 L6.7,4 L7.1,4.8 L7.7,5.5 L8.3,6.1 L9,6.5 L9.9,6.8 L10.8,7 L12,6.8ZM12,6.2 L12.9,5.5 L13.3,4.8 L13.6,4.1 L13.7,3.4 L13.6,2.8 L13.4,2.1 L13.1,1.4 L12.7,0.7 L12,0 L12,0 L11.3,0.7 L10.9,1.4 L10.6,2.1 L10.4,2.8 L10.3,3.4 L10.4,4.1 L10.7,4.8 L11.1,5.5 L12,6.2Z"/><rect x="11.3" y="5" width="1.4" height="17"/>'},
  peuplier:{t:"Peuplier",c:"f",s:'<path d="M12,22 L13.9,21.5 L14.8,21.1 L15.5,20.6 L16.1,20.2 L16.5,19.7 L16.9,19.3 L17.3,18.8 L17.5,18.4 L17.8,17.9 L17.9,17.5 L17.7,17 L17.5,16.5 L17.4,16.1 L17.2,15.6 L17,15.2 L16.8,14.7 L16.7,14.3 L16.5,13.8 L16.3,13.4 L16.1,12.9 L16,12.5 L15.8,12 L15.6,11.5 L15.5,11.1 L15.3,10.6 L15.1,10.2 L14.9,9.7 L14.8,9.3 L14.6,8.8 L14.4,8.4 L14.2,7.9 L14.1,7.5 L13.9,7 L13.7,6.5 L13.6,6.1 L13.4,5.6 L13.2,5.2 L13,4.7 L12.9,4.3 L12.7,3.8 L12.5,3.4 L12.3,2.9 L12.2,2.5 L12,2 L12,2 L11.8,2.5 L11.7,2.9 L11.5,3.4 L11.3,3.8 L11.1,4.3 L11,4.7 L10.8,5.2 L10.6,5.6 L10.4,6.1 L10.3,6.5 L10.1,7 L9.9,7.5 L9.8,7.9 L9.6,8.4 L9.4,8.8 L9.2,9.3 L9.1,9.7 L8.9,10.2 L8.7,10.6 L8.5,11.1 L8.4,11.5 L8.2,12 L8,12.5 L7.9,12.9 L7.7,13.4 L7.5,13.8 L7.3,14.3 L7.2,14.7 L7,15.2 L6.8,15.6 L6.6,16.1 L6.5,16.5 L6.3,17 L6.1,17.5 L6.2,17.9 L6.5,18.4 L6.7,18.8 L7.1,19.3 L7.5,19.7 L7.9,20.2 L8.5,20.6 L9.2,21.1 L10.1,21.5 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,17L16,13.8M12,17L8,13.8M12,13L14.9,9.8M12,13L9.1,9.8"/>'},
  saule:{t:"Saule",c:"f",s:'<path d="M12,22 L12.4,21.5 L12.7,21 L13,20.5 L13.2,20 L13.4,19.5 L13.6,19 L13.8,18.5 L14,18 L14.1,17.5 L14.4,17 L14.3,16.5 L14.6,16 L14.6,15.5 L14.8,15 L14.8,14.5 L14.9,14 L15,13.5 L14.9,13 L15.1,12.5 L14.9,12 L15.1,11.5 L14.9,11 L15,10.5 L14.9,10 L14.8,9.5 L14.8,9 L14.6,8.5 L14.6,8 L14.3,7.5 L14.4,7 L14.1,6.5 L14,6 L13.8,5.5 L13.6,5 L13.4,4.5 L13.2,4 L13,3.5 L12.7,3 L12.4,2.5 L12,2 L12,2 L11.6,2.5 L11.3,3 L11,3.5 L10.8,4 L10.6,4.5 L10.4,5 L10.2,5.5 L10,6 L9.9,6.5 L9.6,7 L9.7,7.5 L9.4,8 L9.4,8.5 L9.2,9 L9.2,9.5 L9.1,10 L9,10.5 L9.1,11 L8.9,11.5 L9.1,12 L8.9,12.5 L9.1,13 L9,13.5 L9.1,14 L9.2,14.5 L9.2,15 L9.4,15.5 L9.4,16 L9.7,16.5 L9.6,17 L9.9,17.5 L10,18 L10.2,18.5 L10.4,19 L10.6,19.5 L10.8,20 L11,20.5 L11.3,21 L11.6,21.5 L12,22Z"/><path class="tw" d="M12,22L12,2.6"/>'},
  verger:{t:"Verger",c:"f",s:'<path d="M12,22 L14,21.3 L14.8,20.7 L15.6,20 L16.1,19.3 L16.6,18.7 L17,18 L17.3,17.3 L17.6,16.7 L17.8,16 L18.1,15.3 L18.1,14.7 L18.3,14 L18.2,13.3 L18.4,12.7 L18.2,12 L18.3,11.3 L18,10.7 L18.1,10 L17.8,9.3 L17.7,8.7 L17.3,8 L17.1,7.3 L16.8,6.7 L16.4,6 L16,5.3 L15.5,4.7 L15,4 L14.3,3.3 L13.6,2.7 L12,2 L12,2 L10.4,2.7 L9.7,3.3 L9,4 L8.5,4.7 L8,5.3 L7.6,6 L7.2,6.7 L6.9,7.3 L6.7,8 L6.3,8.7 L6.2,9.3 L5.9,10 L6,10.7 L5.7,11.3 L5.8,12 L5.6,12.7 L5.8,13.3 L5.7,14 L5.9,14.7 L5.9,15.3 L6.2,16 L6.4,16.7 L6.7,17.3 L7,18 L7.4,18.7 L7.9,19.3 L8.4,20 L9.2,20.7 L10,21.3 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,17L16.6,14.2M12,17L7.4,14.2M12,13L17.3,10.2M12,13L6.7,10.2M12,9L16.8,6.2M12,9L7.2,6.2"/>'},
  feuillus:{t:"Feuillus",c:"f",s:'<path d="M12,22 L13.6,21.3 L14.5,20.7 L15.2,20 L15.8,19.3 L16.3,18.7 L16.7,18 L17,17.3 L17.3,16.7 L17.6,16 L17.7,15.3 L17.9,14.7 L18,14 L18,13.3 L18,12.7 L17.9,12 L17.8,11.3 L17.7,10.7 L17.5,10 L17.3,9.3 L17,8.7 L16.7,8 L16.4,7.3 L16.1,6.7 L15.7,6 L15.2,5.3 L14.7,4.7 L14.2,4 L13.6,3.3 L13,2.7 L12,2 L12,2 L11,2.7 L10.4,3.3 L9.8,4 L9.3,4.7 L8.8,5.3 L8.3,6 L7.9,6.7 L7.6,7.3 L7.3,8 L7,8.7 L6.7,9.3 L6.5,10 L6.3,10.7 L6.2,11.3 L6.1,12 L6,12.7 L6,13.3 L6,14 L6.1,14.7 L6.3,15.3 L6.4,16 L6.7,16.7 L7,17.3 L7.3,18 L7.7,18.7 L8.2,19.3 L8.8,20 L9.5,20.7 L10.4,21.3 L12,22Z"/><path class="tw" d="M12,22L12,2.6M12,17L16.4,14M12,17L7.6,14M12,13L17.1,10M12,13L6.9,10M12,9L16.4,6M12,9L7.6,6"/>'},
  epicea:{t:"Épicéa",c:"c",s:'<path class="nd" d="M12 22V2.5M12 20L7.2,14.3M12 20L16.8,14.3M12 17.2L7.6,12M12 17.2L16.4,12M12 14.5L8,9.7M12 14.5L16,9.7M12 11.8L8.3,7.3M12 11.8L15.7,7.3M12 9L8.7,5M12 9L15.3,5M12 6.2L9,2.7M12 6.2L15,2.7M12 3.5L9.4,0.4M12 3.5L14.6,0.4"/>'},
  sapin:{t:"Sapin",c:"c",s:'<path class="nd" d="M12 22V2.5M12 20L4.5,16M12 20L19.5,16M12 17.6L4.9,13.9M12 17.6L19.1,13.9M12 15.3L5.4,11.8M12 15.3L18.6,11.8M12 12.9L5.9,9.7M12 12.9L18.1,9.7M12 10.6L6.4,7.6M12 10.6L17.6,7.6M12 8.2L6.9,5.5M12 8.2L17.1,5.5M12 5.9L7.3,3.4M12 5.9L16.7,3.4M12 3.5L7.8,1.3M12 3.5L16.2,1.3"/>'},
  coniferes:{t:"Conifères",c:"c",s:'<path class="nd" d="M12 22V2.5M12 20L7.2,14.3M12 20L16.8,14.3M12 17.2L7.6,12M12 17.2L16.4,12M12 14.5L8,9.7M12 14.5L16,9.7M12 11.8L8.3,7.3M12 11.8L15.7,7.3M12 9L8.7,5M12 9L15.3,5M12 6.2L9,2.7M12 6.2L15,2.7M12 3.5L9.4,0.4M12 3.5L14.6,0.4"/>'},
  pin:{t:"Pin",c:"c",s:'<path class="nd" d="M12 22V19M12 20.5L3.8,5.6M12 20.5L5.3,4.9M12 20.5L11,1.5M12 20.5L13,1.5M12 20.5L18.7,4.9M12 20.5L20.2,5.6"/>'},
  souche:{t:"Bois mort, souche",c:"w",s:'<ellipse cx="12" cy="12" rx="9" ry="7"/><ellipse class="tw" cx="12" cy="12" rx="6" ry="4.4"/><ellipse class="tw" cx="12" cy="12" rx="3" ry="2"/>'},
  herbe:{t:"Prairie, pelouse",c:"h",s:'<path d="M12,22 L11.8,21.3 L11.6,20.7 L11.4,20.1 L11.2,19.4 L11,18.8 L10.7,18.2 L10.5,17.6 L10.2,17 L10,16.4 L9.7,15.8 L9.4,15.2 L9.1,14.6 L8.7,14.1 L8.4,13.5 L8.1,12.9 L7.7,12.4 L7.3,11.9 L7,11.3 L6.6,10.8 L6.1,10.3 L5.7,9.8 L5.3,9.3 L4.9,8.8 L4.4,8.3 L4,7.8 L3.5,7.3 L3.5,7.3 L3.7,7.9 L3.9,8.6 L4.1,9.2 L4.3,9.8 L4.5,10.5 L4.8,11.1 L5,11.7 L5.3,12.3 L5.5,12.9 L5.8,13.5 L6.1,14.1 L6.4,14.6 L6.8,15.2 L7.1,15.8 L7.4,16.3 L7.8,16.9 L8.2,17.4 L8.5,18 L8.9,18.5 L9.4,19 L9.8,19.5 L10.2,20 L10.6,20.5 L11.1,21 L11.5,21.5 L12,22Z"/><path d="M12,22 L12,21.2 L12,20.4 L12,19.5 L11.9,18.7 L11.9,17.9 L11.9,17.1 L11.8,16.3 L11.7,15.5 L11.6,14.7 L11.5,13.9 L11.4,13.1 L11.3,12.3 L11.1,11.5 L11,10.7 L10.8,9.9 L10.6,9.1 L10.4,8.3 L10.2,7.5 L9.9,6.8 L9.7,6 L9.4,5.2 L9.2,4.4 L8.9,3.7 L8.6,2.9 L8.3,2.1 L8,1.4 L8,1.4 L8,2.2 L8,3 L8,3.9 L8,4.7 L8.1,5.5 L8.1,6.3 L8.2,7.1 L8.3,7.9 L8.4,8.7 L8.5,9.5 L8.6,10.3 L8.7,11.1 L8.9,11.9 L9,12.7 L9.2,13.5 L9.4,14.3 L9.6,15.1 L9.8,15.8 L10.1,16.6 L10.3,17.4 L10.6,18.2 L10.8,18.9 L11.1,19.7 L11.4,20.5 L11.7,21.2 L12,22Z"/><path d="M12,22 L12.3,21.2 L12.6,20.4 L12.9,19.6 L13.2,18.8 L13.4,18 L13.7,17.1 L13.9,16.3 L14.1,15.5 L14.3,14.7 L14.5,13.9 L14.7,13 L14.9,12.2 L15,11.4 L15.2,10.5 L15.3,9.7 L15.4,8.9 L15.5,8 L15.6,7.2 L15.7,6.3 L15.7,5.5 L15.8,4.6 L15.8,3.8 L15.8,2.9 L15.8,2.1 L15.8,1.2 L15.8,0.3 L15.8,0.3 L15.5,1.1 L15.2,1.9 L14.9,2.8 L14.7,3.6 L14.4,4.4 L14.2,5.2 L13.9,6 L13.7,6.8 L13.5,7.7 L13.3,8.5 L13.1,9.3 L12.9,10.1 L12.8,11 L12.6,11.8 L12.5,12.6 L12.4,13.5 L12.3,14.3 L12.2,15.2 L12.2,16 L12.1,16.9 L12.1,17.7 L12,18.6 L12,19.4 L12,20.3 L12,21.1 L12,22Z"/><path d="M12,22 L12.5,21.5 L12.9,21 L13.4,20.5 L13.8,20 L14.2,19.5 L14.6,19 L15.1,18.5 L15.5,18 L15.8,17.4 L16.2,16.9 L16.6,16.3 L16.9,15.8 L17.2,15.2 L17.6,14.6 L17.9,14.1 L18.2,13.5 L18.5,12.9 L18.7,12.3 L19,11.7 L19.2,11.1 L19.5,10.5 L19.7,9.8 L19.9,9.2 L20.1,8.6 L20.3,7.9 L20.5,7.3 L20.5,7.3 L20,7.8 L19.6,8.3 L19.1,8.8 L18.7,9.3 L18.3,9.8 L17.9,10.3 L17.4,10.8 L17,11.3 L16.7,11.9 L16.3,12.4 L15.9,12.9 L15.6,13.5 L15.3,14.1 L14.9,14.6 L14.6,15.2 L14.3,15.8 L14,16.4 L13.8,17 L13.5,17.6 L13.3,18.2 L13,18.8 L12.8,19.4 L12.6,20.1 L12.4,20.7 L12.2,21.3 L12,22Z"/>'}
};
function hostChips(name){
  const keys=(typeof HOTES!=="undefined"&&HOTES[name])||[];
  if(!keys.length)return"";
  const label=keys.map(k=>TREE_ICONS[k]&&TREE_ICONS[k].t).filter(Boolean).join(", ");
  return `<span class="trees" role="img" aria-label="Arbres hôtes ou appréciés : ${label}">`+keys.filter(k=>TREE_ICONS[k]).map(k=>`<span class="tree tr-${TREE_ICONS[k].c}" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">${TREE_ICONS[k].s}</svg>${TREE_ICONS[k].t}</span>`).join("")+`</span>`;
}
// ---------- Courbes d'optimum : où se situent température, altitude et saison par rapport à ce qu'aime l'espèce ----------
function curveSvg(o){
  const W=300,H=66,pl=4,pr=4,pt=6,pb=16,iw=W-pl-pr,ih=H-pt-pb;
  const X=x=>pl+(x-o.xmin)/(o.xmax-o.xmin)*iw,Y=v=>pt+(1-v)*ih,N=60;
  const pts=[...Array(N+1)].map((_,i)=>{const x=o.xmin+(o.xmax-o.xmin)*i/N;return X(x).toFixed(1)+","+Y(o.f(x)).toFixed(1)});
  let mk="";
  if(o.val!=null&&isFinite(o.val)){
    const v=Math.max(o.xmin,Math.min(o.xmax,o.val));
    mk=`<line class="cv-mk" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${pt}" y2="${Y(0)}"/><circle class="cv-dot" cx="${X(v).toFixed(1)}" cy="${Y(o.f(o.val)).toFixed(1)}" r="3.5"/>`;
  }
  return `<svg class="cv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.aria}"><path class="cv-a" d="M${pl},${Y(0)} L${pts.join(" L")} L${W-pr},${Y(0)}Z"/><polyline class="cv-l" points="${pts.join(" ")}"/>${mk}`+
    `<text x="${pl}" y="${H-3}">${o.xmin} ${o.unit}</text><text x="${W-pr}" y="${H-3}" text-anchor="end">${o.xmax} ${o.unit}</text></svg>`;
}
function seasonSvg(gb,mo,aria){
  const W=300,H=66,pt=6,pb=16,bw=W/12,mx=Math.max(...gb,.01);
  const bars=gb.map((g,i)=>{const hh=Math.max(1,(g/mx)*(H-pt-pb));return `<rect class="cv-b${i===mo?" now":""}" x="${(i*bw+3).toFixed(1)}" y="${(H-pb-hh).toFixed(1)}" width="${(bw-6).toFixed(1)}" height="${hh.toFixed(1)}" rx="2"/><text x="${(i*bw+bw/2).toFixed(1)}" y="${H-3}" text-anchor="middle">${"JFMAMJJASOND"[i]}</text>`}).join("");
  return `<svg class="cv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">${bars}</svg>`;
}
// z, T : point choisi et température du jour (facultatifs) pour placer le repère « ici »
function renderCurves(sp,z,T,d){
  const box=$("spcurves");if(!box)return;
  const al=sp.al.map((v,i)=>i==0&&v==0?-1:v),altF=x=>trap(x,...al),tF=x=>trap(x,...sp.t);
  const altMax=Math.ceil(sp.al[3]*1.15/100)*100,mo=dateOf(d||0).getMonth(),here=z&&isFinite(z.alt);
  const tv=z&&isFinite(T)?T:null;
  const MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const best=sp.gb.indexOf(Math.max(...sp.gb));
  box.innerHTML=
    `<h4>Température moyenne</h4><p class="cap">Idéal ${sp.t[1]} à ${sp.t[2]} °C · toléré ${sp.t[0]} à ${sp.t[3]} °C${tv!=null?" · ici "+Math.round(tv)+" °C ("+Math.round(tF(tv)*100)+" %)":""}</p>`+
    curveSvg({xmin:sp.t[0]-4,xmax:sp.t[3]+4,f:tF,val:tv,unit:"°C",aria:`Courbe de température : idéal ${sp.t[1]} à ${sp.t[2]} degrés, toléré ${sp.t[0]} à ${sp.t[3]}`})+
    `<h4>Altitude</h4><p class="cap">Idéal ${sp.al[1]} à ${sp.al[2]} m · toléré ${Math.max(0,sp.al[0])} à ${sp.al[3]} m${here?" · ici "+Math.round(z.alt)+" m ("+Math.round(altF(z.alt)*100)+" %)":""}</p>`+
    curveSvg({xmin:0,xmax:altMax,f:altF,val:here?z.alt:null,unit:"m",aria:`Courbe d'altitude : idéal ${sp.al[1]} à ${sp.al[2]} mètres, toléré jusqu'à ${sp.al[3]}`})+
    `<h4>Saison</h4><p class="cap">Pic en ${MOIS[best]} · mois affiché en rouge : ${MOIS[mo]}</p>`+
    seasonSvg(sp.gb,mo,`Saison de ${sp.n} : pic en ${MOIS[best]}`);
}
// ---------- Meilleurs coins autour du point : cercle de taille fixe à l'écran ----------
// Le rayon suit l'échelle de la carte : rayon en pixels x mètres par pixel (borné de 150 m à 100 km), donc le cercle garde la même
// taille à l'écran quand on zoome. Petit rayon (<= 2,5 km) : forêt lue à ~10 m (IGN) et altitude à 90-500 m (Open-Meteo), chaque case
// reçoit le score du modèle avec sa propre forêt, altitude, pente et exposition. Grand rayon : valeurs du champ de la carte (blocs de
// forêt de 1,4 km, sol et relief de 2,8 km), donc exactement les couleurs vues à l'écran.
const SPOT_RPX_DESK=120,SPOT_RPX_MOB=80,SPOT_FINE_MAX=2500,SPOT_MIN=150,SPOT_MAX=100000;
let spotLayer=null;
const mPerPx=(lat,z)=>156543.03392*Math.cos(lat*Math.PI/180)/Math.pow(2,z);
function spotRadius(lat){
  const sz=map.getSize(),rpx=Math.round(Math.max(60,Math.min(sz.x<600?SPOT_RPX_MOB:SPOT_RPX_DESK,Math.min(sz.x,sz.y)*.3)));
  st.spRpx=rpx;
  return Math.max(SPOT_MIN,Math.min(SPOT_MAX,rpx*mPerPx(lat,map.getZoom())));
}
const fmtDist=m=>m<950?(Math.round(m/10)*10)+" m":(m<10000?String(Math.round(m/100)/10).replace(".",","):String(Math.round(m/1000)))+" km";
const spLevel=v=>v>=70?4:v>=55?3:v>=35?2:v>=20?1:0;
// Note sur 5 = les 5 niveaux du verdict (1 : très peu propice ... 5 : très propice), jamais pour une espèce toxique
const starsOf=sc=>spLevel(sc)+1;
const starsTxt=n=>"★".repeat(n)+"☆".repeat(5-n);
const starsHtml=n=>`<span class="stars" role="img" aria-label="${n} sur 5">${starsTxt(n)}</span>`;
function forestPx(r,g,b,a){   // même règle que build_forets.py : 0 aucune, 1 feuillus, 2 résineux, 3 mélange
  if(a<128)return 0;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=mx/255,sat=mx?(mx-mn)/mx:0;
  if(sat<.35)return 0;
  let h=0;const d=mx-mn;
  if(d){if(mx==r)h=((g-b)/d)%6;else if(mx==g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}
  if(h>=25&&h<66)return 0;
  if(h>=10&&h<25&&v<.7)return 1;
  if(h>=66&&h<165)return 1;
  if(h>=165&&h<330)return 2;
  return 3;
}
async function jget(url,ms){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}}
async function fetchForestGrid(lat,lon,R){
  if(window.__testForest)return window.__testForest(lat,lon,R);
  const N=200,dla=R/110540*1.05,dlo=R/(111320*Math.cos(lat*Math.PI/180))*1.05,bb=[lat-dla,lon-dlo,lat+dla,lon+dlo];
  const url="https://data.geopf.fr/wms-v/ows?"+new URLSearchParams({SERVICE:"WMS",VERSION:"1.3.0",REQUEST:"GetMap",LAYERS:"LANDCOVER.FORESTINVENTORY.V2",STYLES:"",CRS:"EPSG:4326",BBOX:bb.join(","),WIDTH:N,HEIGHT:N,FORMAT:"image/png",TRANSPARENT:"TRUE"});
  const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);
  try{
    const r=await fetch(url,{signal:c.signal});if(!r.ok)throw new Error(r.status);
    const bmp=await createImageBitmap(await r.blob()),cv=document.createElement("canvas");cv.width=N;cv.height=N;
    const g=cv.getContext("2d");g.drawImage(bmp,0,0,N,N);
    const d=g.getImageData(0,0,N,N).data,cls=new Uint8Array(N*N);
    for(let i=0;i<N*N;i++)cls[i]=forestPx(d[i*4],d[i*4+1],d[i*4+2],d[i*4+3]);
    return{cls,N,bb};
  }finally{clearTimeout(t)}
}
async function fetchElevGrid(lat,lon,R){
  if(window.__testElev)return window.__testElev(lat,lon,R);
  const n=11,step=Math.max(90,R/5),kx=111320*Math.cos(lat*Math.PI/180),ky=110540,pts=[];
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)pts.push([lat+(i-5)*step/ky,lon+(j-5)*step/kx]);
  const e=[];
  for(let c=0;c<pts.length;c+=61){
    const part=pts.slice(c,c+61),o=await jget("https://api.open-meteo.com/v1/elevation?latitude="+part.map(p=>p[0].toFixed(6)).join(",")+"&longitude="+part.map(p=>p[1].toFixed(6)).join(","),12000);
    if(!o.elevation||o.elevation.length!=part.length)throw new Error("altitude");
    e.push(...o.elevation);
  }
  return{n,step,e,lat0:pts[0][0],lon0:pts[0][1]};
}
function loadSpotData(z,R){
  const tok=++st.spTok;
  st.spotData={state:"load",mode:"fine",R,z};st.spots=null;
  Promise.allSettled([fetchForestGrid(z.lat,z.lon,R),fetchElevGrid(z.lat,z.lon,R)]).then(([f,e])=>{
    if(tok!==st.spTok||st.ptZ!==z)return;
    st.spotData={state:"ok",mode:"fine",R,z,forest:f.status=="fulfilled"?f.value:null,elev:e.status=="fulfilled"?e.value:null,err:[f.status=="rejected"?"de la forêt":null,e.status=="rejected"?"de l'altitude":null].filter(Boolean)};
    renderSpots(true);
  });
}
// Recalcule les coins pour le zoom courant : petit rayon = lecture fine (données récupérées si besoin), grand rayon = champ de la carte.
function updateSpots(force){
  const z=st.ptZ;if(!z||!map)return;
  const R=spotRadius(z.lat);st.spR=R;
  if(R<=SPOT_FINE_MAX){
    const D=st.spotData;
    if(force||!D||D.mode!=="fine"||D.z!==z||R>D.R*1.02||R<D.R*.5){loadSpotData(z,R);renderSpots(true);return}
  }else{st.spTok++;st.spotData={state:"ok",mode:"reg",R,z}}
  renderSpots(true);
}
const MUSH=n=>L.divIcon({className:"",iconSize:[30,30],iconAnchor:[15,26],html:`<div class="mush"><svg viewBox="0 0 30 30" width="30" height="30" aria-hidden="true"><path d="M3 15C3 8 8.5 3 15 3s12 5 12 12c0 1.2-.8 2-2 2H5c-1.2 0-2-.8-2-2z" fill="#7b4a22" stroke="#fff" stroke-width="1.5"/><circle cx="9" cy="10" r="1.7" fill="#e3c9a3"/><circle cx="16" cy="7.5" r="1.7" fill="#e3c9a3"/><circle cx="21.5" cy="12" r="1.5" fill="#e3c9a3"/><path d="M11.5 17h7l-1 9.5c-.1.8-.7 1.3-1.5 1.3h-2c-.8 0-1.4-.5-1.5-1.3z" fill="#c9a074" stroke="#fff" stroke-width="1.2"/></svg><b>${n}</b></div>`});
function thumbIcon(i,c){
  const P=PHOTOS[st.sp],src=P&&P.thumb;
  if(!src)return MUSH(i+1);
  return L.divIcon({className:"",iconSize:[46,46],iconAnchor:[23,23],html:`<div class="spthumb l${spLevel(c.sc)}"><img src="${src}" alt="" draggable="false"><span class="rk">${i+1}</span></div>`});
}
const SPDIRS=["nord","nord-est","est","sud-est","sud","sud-ouest","ouest","nord-ouest"];
function describeSpot(c){
  c.dist=c.d;c.dir=c.d<30?"(sur place)":SPDIRS[Math.round(((Math.atan2(c.dx,c.dy)*180/Math.PI+360)%360)/45)%8];
  const typ=c.nf?(c.open=="clair"?"clairière ou lisière":c.open=="prairie"?"prairie ou milieu ouvert":"terrain ouvert"):(c.sparse?"lisière ou bois épars":"forêt")+(c.nf?"":c.fo=="f"?" de feuillus":c.fo=="r"?" de résineux":" mixte");
  c.desc=typ+(c.north>.25?" · versant nord":c.north<-.25?" · versant sud":"")+" · "+Math.round(c.e)+" m · pente "+Math.round(c.slope)+"°";
}
function pickTop(cand,minSep){
  cand.sort((a,b)=>b.sc-a.sc);
  const top=[];
  for(const c of cand){if(c.sc<5||top.length>=5)break;if(top.every(t=>Math.hypot(t.dx-c.dx,t.dy-c.dy)>=minSep))top.push(c)}
  return top;
}
// Grand rayon : on lit directement le champ de la carte (même valeur que les couleurs), sans appel réseau.
function regionalSpots(z,R){
  const F=st.F;if(!F||!heatGeom)return[];
  const ky=110540,kx=111320*Math.cos(z.lat*Math.PI/180),step=Math.max(R/22,700),hg=heatGeom,cand=[];
  for(let dy=-R;dy<=R;dy+=step)for(let dx=-R;dx<=R;dx+=step){
    const d=Math.hypot(dx,dy);if(d>R)continue;
    const la=z.lat+dy/ky,lo=z.lon+dx/kx;
    let cls=0,urb=false;
    if(FINE){const fy=Math.floor((la-(hg.la0-hg.dLat/2))/(hg.dLat/FINE.K)),fx=Math.floor((lo-(hg.lo0-hg.dLon/2))/(hg.dLon/FINE.K));
      if(fy>=0&&fx>=0&&fy<FINE.FH&&fx<FINE.FW){cls=FINE.cls[fy*FINE.FW+fx];urb=!!(FINE.urb&&FINE.urb[fy*FINE.FW+fx])}}
    if(urb||nearRoad(la,lo,140))continue;
    const v=fieldAt(F,la,lo);if(v<5)continue;
    const t=cls>3?cls-3:cls,br=blockRelief(la,lo);
    cand.push({la,lo,dx,dy,d,sc:Math.round(v),nf:cls==0,open:cls==0?"autre":null,sparse:cls>3,fo:t==1?"f":t==2?"r":"m",
      e:br?br.elev:(z.alt||0),slope:br?br.slope:0,north:br?br.north:0});
  }
  const top=pickTop(cand,Math.max(R/5,1400));top.forEach(describeSpot);return top;
}
// Petit rayon : forêt à ~10 m et relief local, score recalculé case par case avec la météo et le sol du point.
function fineSpots(z,R,sp,D){
  const E=D.elev,F=D.forest,ky=110540,kx=111320*Math.cos(z.lat*Math.PI/180),off=E?Math.max(45,E.step/2):100;
  const elevAt=(la,lo)=>{
    if(!E)return z.alt;
    const fi=Math.max(0,Math.min(E.n-1.001,(la-E.lat0)*ky/E.step)),fj=Math.max(0,Math.min(E.n-1.001,(lo-E.lon0)*kx/E.step)),i=Math.floor(fi),j=Math.floor(fj),a=fi-i,b=fj-j,n=E.n,e=E.e;
    return e[i*n+j]*(1-a)*(1-b)+e[i*n+j+1]*(1-a)*b+e[(i+1)*n+j]*a*(1-b)+e[(i+1)*n+j+1]*a*b;
  };
  const forestAt=(la,lo,r)=>{   // part de pixels boisés et classe dominante dans une fenêtre de (2r+1)² pixels
    const N=F.N,x=Math.floor((lo-F.bb[1])/(F.bb[3]-F.bb[1])*N),y=Math.floor((F.bb[2]-la)/(F.bb[2]-F.bb[0])*N),cnt=[0,0,0,0];let n=0;
    for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++){if(yy<0||xx<0||yy>=N||xx>=N)continue;cnt[F.cls[yy*N+xx]]++;n++}
    if(!n)return{frac:0,cls:0};
    const f=(cnt[1]+cnt[2]+cnt[3])/n;return{frac:f,cls:cnt[1]>=cnt[2]&&cnt[1]>=cnt[3]?1:cnt[2]>=cnt[3]?2:3};
  };
  const hg=heatGeom,altS=z.altS!=null?z.altS:z.alt,cand=[],step=Math.max(40,R/20),r1=Math.max(1,Math.round(R/100/ (R/100)*2)),rOpen=Math.max(3,Math.round(7));
  for(let dy=-R;dy<=R;dy+=step)for(let dx=-R;dx<=R;dx+=step){
    const d=Math.hypot(dx,dy);if(d>R)continue;
    const la=z.lat+dy/ky,lo=z.lon+dx/kx;
    if(FINE&&FINE.urb&&hg){const fy=Math.floor((la-(hg.la0-hg.dLat/2))/(hg.dLat/FINE.K)),fx=Math.floor((lo-(hg.lo0-hg.dLon/2))/(hg.dLon/FINE.K));if(fy>=0&&fx>=0&&fy<FINE.FH&&fx<FINE.FW&&FINE.urb[fy*FINE.FW+fx])continue}
    if(nearRoad(la,lo,Math.min(90,Math.max(40,R/10))))continue;
    const e=E?elevAt(la,lo):z.alt;
    let slope=z.rel?z.rel.slope:0,north=z.rel?z.rel.north:0,tpi=z.rel?z.rel.tpi||0:0;
    if(E){
      const gx=(elevAt(la,lo+off/kx)-elevAt(la,lo-off/kx))/(2*off),gn=(elevAt(la+off/ky,lo)-elevAt(la-off/ky,lo))/(2*off),mag=Math.hypot(gx,gn);
      slope=Math.atan(mag)*180/Math.PI;north=mag>1e-6?(-gn/mag)*Math.min(slope,30)/30:0;
      let sm=0;for(let a=0;a<8;a++){const an=a*Math.PI/4;sm+=elevAt(la+off*3*Math.sin(an)/ky,lo+off*3*Math.cos(an)/kx)}tpi=e-sm/8;
    }
    let nf=z.nf,open=z.open,sparse=z.sparse,fo=z.fo||"m";
    if(F){
      const w=forestAt(la,lo,2);
      if(w.frac>=.25){nf=false;open=null;fo=w.cls==1?"f":w.cls==2?"r":"m";sparse=w.frac<.6}
      else{nf=true;sparse=false;const w2=forestAt(la,lo,7);open=w2.frac>=.2?"clair":(z.blk==7?"prairie":"autre")}
    }
    const zc={i:-1,lat:la,lon:lo,alt:e,so:z.so,fo,nf,open,sparse,urb:false,sol:z.sol,rel:{slope,north,tpi},L:z.L,dT:-.0065*(e-altS),mi:z.mi,n:"",src:{}};
    cand.push({la,lo,dx,dy,d,sc:viewScore(sp,zc,true).sc,e,slope,north,fo,nf,open,sparse});
  }
  const top=pickTop(cand,Math.max(250,R/4));top.forEach(describeSpot);return top;
}
function refreshSpotsBox(){
  const el=$("detail").querySelector(".spotsbox");
  if(el)el.outerHTML=spotsHtml();else renderDetail();
}
function renderSpots(soft){
  if(spotLayer){spotLayer.remove();spotLayer=null}
  st.spots=null;
  const z=st.ptZ,D=st.spotData;
  if(!z||!D||!map){soft?refreshSpotsBox():renderDetail();return}
  const R=D.R||st.spR||SPOT_MIN,sp=SP[st.sp];
  const layers=[L.circle([z.lat,z.lon],{radius:R,color:"#4a148c",weight:1.6,dashArray:"6 6",fillColor:"#4a148c",fillOpacity:.035,interactive:false})];
  if(D.state!=="ok"){spotLayer=L.layerGroup(layers).addTo(map);soft?refreshSpotsBox():renderDetail();return}
  const useFine=D.mode==="fine"&&D.forest;
  const top=useFine?fineSpots(z,R,sp,D):regionalSpots(z,R);
  st.spotMode=useFine?"fine":"reg";st.spots=top;
  top.forEach((c,i)=>layers.push(L.marker([c.la,c.lo],{icon:thumbIcon(i,c),title:"Coin "+(i+1)+" : "+c.sc+"/100",riseOnHover:true})
    .bindTooltip("Coin "+(i+1)+" · "+c.sc+"/100 · "+fmtDist(c.dist)+" "+c.dir+"<br>"+c.desc)
    .on("click",()=>goSpot(c))));
  spotLayer=L.layerGroup(layers).addTo(map);
  soft?refreshSpotsBox():renderDetail();
}
function goSpot(c){   // juger ce coin : on y centre un nouveau point, en zoomant un peu
  if(!map)return;
  map.flyTo([c.la,c.lo],Math.min(17,Math.max(map.getZoom()+2,12)),{duration:.7});
  setPoint(c.la,c.lo,false);
}
function spotsHtml(){
  if(!st.ptZ)return "";
  const D=st.spotData,sp=SP[st.sp],R=(D&&D.R)||st.spR||0;
  const head=`<b>Meilleurs coins autour de ce point</b> <span class="sub">cercle de ${fmtDist(R)} de rayon${R>=SPOT_MAX?" (plafonné)":""}</span>`;
  const circ=`Le cercle garde la même taille à l'écran : son rayon grandit quand vous dézoomez.`;
  if(!D||D.state==="load")return `<div class="spotsbox">${head}<p class="note" style="margin:6px 0 0">Recherche en cours…</p></div>`;
  const Ls=st.spots||[];
  const errs=D.err&&D.err.length?` Lecture ${D.err.join(" et ")} indisponible : estimation moins précise.`:"";
  const meth=st.spotMode==="fine"?`Forêt lue à environ ${Math.max(5,Math.round(R/100))} m (IGN), altitude et relief à ${Math.round(D.elev?D.elev.step:90)} m. Météo et sol : ceux du point.${errs}`
    :`Vue régionale : valeurs de la carte (forêt par blocs de 1,4 km, sol et relief par blocs de 2,8 km). Zoomez au-delà du zoom 12 pour une lecture à 10 m.`;
  if(!Ls.length)return `<div class="spotsbox">${head}<p class="note" style="margin:6px 0 0">Aucun coin propice dans ce cercle pour ${sp.det} (habitat ou conditions défavorables). Dézoomez pour élargir la recherche.</p><p class="note small">${meth}</p></div>`;
  const P=PHOTOS[st.sp],src=P&&P.thumb;
  return `<div class="spotsbox">${head}<ol class="spots">${Ls.map((c,i)=>`<li data-i="${i}"><span class="spthumb sm l${spLevel(c.sc)}">${src?`<img src="${src}" alt="" draggable="false">`:""}<span class="rk">${i+1}</span></span><span class="tx"><b>${c.sc}/100</b> <span class="lv">${tipLabel(c.sc)}</span><br>${fmtDist(c.dist)} ${c.dir}<br><span class="sub">${c.desc}</span></span></li>`).join("")}</ol><p class="note small">Touchez un coin, sur la carte ou dans la liste, pour le juger. ${circ}</p><p class="note small">${meth}</p></div>`;
}
// ---------- Point GPS précis ----------
function renderPointMarker(){
  if(selMarker){selMarker.remove();selMarker=null}
  if(st.pt)selMarker=L.marker([st.pt.lat,st.pt.lon],{interactive:false,zIndexOffset:2000,icon:L.divIcon({className:"",html:`<div class="selpin" style="width:38px;height:38px"><div class="ring"></div><div class="dot"></div></div>`,iconSize:[38,38],iconAnchor:[19,19]})}).addTo(map);
}
// Position de l'appareil : un point comme un autre, avec contrôle que l'on est bien en France métropolitaine.
function locateMe(){
  const say=t=>{const h=document.querySelector("#detail .hint");if(h)h.textContent=t};
  if(!navigator.geolocation){say("Géolocalisation indisponible sur cet appareil : touchez la carte pour choisir un endroit.");return}
  say("Recherche de votre position…");
  navigator.geolocation.getCurrentPosition(p=>{
    const la=p.coords.latitude,lo=p.coords.longitude;
    if(!(la>=41&&la<=51.5&&lo>=-5.5&&lo<=10)){say("Votre position est hors de la France métropolitaine : touchez la carte pour choisir un endroit.");return}
    setPoint(la,lo,true);
  },()=>say("Position refusée ou introuvable : touchez la carte pour choisir un endroit."),{timeout:12000});
}
function setPoint(lat,lon,fly){
  {const b=$("emptymap");if(b&&!b.hidden){st.emptyHide=SP[st.sp].n+"|"+st.view+"|"+st.day;b.hidden=true}}   // le message gênerait la carte une fois un point choisi
  if(!(lat>=41&&lat<=51.5&&lon>=-5.5&&lon<=10))return;
  st.pt={lat,lon};st.ptZ=makeZone(lat,lon);
  try{history.replaceState(null,"","#p="+lat.toFixed(5)+","+lon.toFixed(5))}catch(e){}
  if(fly&&map)map.flyTo([lat,lon],Math.max(map.getZoom(),9),{duration:.8});
  if(spotLayer){spotLayer.remove();spotLayer=null}
  renderPointMarker();renderDetail();scrollToDetail();savePrefs();refinePoint(st.ptZ);updateSpots(true);
  if(mqMobile.matches){if(st.sheet==="peek")setSheet("half");setTimeout(ensureVisible,fly?900:60)}
}
// Zone « virtuelle » au point : météo interpolée entre les 4 mailles voisines, terrain de la maille ou du bloc forestier.
function makeZone(lat,lon){
  const base={i:-1,lat,lon,n:"Point "+fmtCoord(lat,lon),src:{w:"normales de saison (simulée)",a:"de la maille",f:"de la maille (17 km)",s:"de la maille (17 km)"}};
  if(!st.live||!heatGeom||!st.cellMap){
    let b=null,bk=1e9;Z.forEach(z=>{const k=km(lat,lon,z.lat,z.lon);if(k<bk){bk=k;b=z}});
    return Object.assign({},b,base,{near:b?b.n:""});
  }
  const{la0,lo0,dLat,dLon}=heatGeom,fi=(lat-la0)/dLat,fj=(lon-lo0)/dLon,i0=Math.floor(fi),j0=Math.floor(fj),a=fi-i0,b=fj-j0;
  let ws=[[i0,j0,(1-a)*(1-b)],[i0,j0+1,(1-a)*b],[i0+1,j0,a*(1-b)],[i0+1,j0+1,a*b]].map(([i,j,w])=>[st.cellMap.get(i+","+j),w]).filter(x=>x[0]&&x[1]>0);
  if(!ws.length){let bz=null,bk=1e9;Z.forEach(z=>{const k=km(lat,lon,z.lat,z.lon);if(k<bk){bk=k;bz=z}});ws=[[bz,1]]}
  const tot=ws.reduce((s,x)=>s+x[1],0),nz=[...ws].sort((x,y)=>y[1]-x[1])[0][0],N=st.live[nz.i].p.length;
  const mix=key=>{if(!st.live[nz.i][key])return null;const o=new Array(N).fill(0);ws.forEach(([z,w])=>{const arr=st.live[z.i][key];if(arr)for(let k=0;k<N;k++)o[k]+=(arr[k]||0)*w/tot});return o};
  const z=Object.assign({},nz,base,{near:nz.n,alt:Math.round(ws.reduce((s,x)=>s+x[0].alt*x[1],0)/tot),
    L:{p:mix("p"),t:mix("t"),tn:mix("tn"),sm:mix("sm"),et:mix("et"),off:st.off}});
  z.src={w:"interpolée entre "+ws.length+" mailles de 17 km",a:"interpolée (17 km)",f:"de la maille (17 km)",s:"de la maille (17 km)"};
  if(FINE){
    const{K,FW,FH,cls}=FINE,fy=Math.floor((lat-(la0-dLat/2))/(dLat/K)),fx=Math.floor((lon-(lo0-dLon/2))/(dLon/K));
    if(fy>=0&&fx>=0&&fy<FH&&fx<FW){const c=cls[fy*FW+fx],t=c>3?c-3:c;z.blk=c;z.nf=(c==0||c==7);z.urb=false;z.sparse=c>3&&c<7;z.open=c==7?"prairie":"autre";if(c&&c<7)z.fo=t==1?"f":t==2?"r":"m";z.src.f="bloc de 1,4 km (IGN) : "+(c==0?"pas de forêt":c==7?"prairie ou milieu ouvert (CORINE)":c>3?"bois épars":"forêt");
      if(FINE.urb[fy*FW+fx]){z.anth="ville";z.src.f="agglomération (CORINE 2018)"}}
  }
  if(SOL){const bs=blockSoil(lat,lon);if(bs){z.sol=bs;z.src.s="SoilGrids (bloc de 2,8 km)"}}
  if(RLF){const br=blockRelief(lat,lon);if(br){const aw=z.alt;z.altS=aw;z.rel=br;z.alt=Math.round(br.elev);z.dT=-.0065*(br.elev-aw);z.src.a="bloc de 2,8 km (relief)";z.src.r="bloc de 2,8 km"}}
  if(!z.anth&&nearRoad(lat,lon,140)){z.anth="route";z.src.f="axe routier principal (BD TOPO)"}
  return z;
}
// Données exactes au point, depuis le navigateur (IGN, Open-Meteo, SoilGrids acceptent les appels depuis une page web).
async function refinePoint(z){
  const tok=++st.ptTok,ok=()=>tok===st.ptTok&&st.ptZ===z;
  const J=async(url,ms)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}};
  const f=a=>(a||[]).map(v=>typeof v=="number"?v:0);
  const tasks=[
    (async()=>{try{   // pente et exposition exactes : altitude aux quatre points cardinaux à environ 100 m
      const d=.0009,la=z.lat,lo=z.lon,kx=Math.cos(la*Math.PI/180)*111320,ky=110540;
      const o=await J("https://api.open-meteo.com/v1/elevation?latitude="+[la,la,la+d,la-d].join(",")+"&longitude="+[lo+d,lo-d,lo,lo].join(","),12000);
      if(!ok()||!o.elevation||o.elevation.length<4)return;
      const[e,wv,n,sv]=o.elevation,gx=(e-wv)/(2*d*kx),gn=(n-sv)/(2*d*ky),mag=Math.hypot(gx,gn),slope=Math.atan(mag)*180/Math.PI;
      z.rel=Object.assign(z.rel||{tpi:0},{slope,north:mag>1e-6?(-gn/mag)*Math.min(slope,30)/30:0});
      z.src.r="pente et exposition exactes au point (modèle d'altitude 90 m)";renderDetail();
    }catch(e){}})(),
    (async()=>{try{
      const o=await J("https://api.open-meteo.com/v1/forecast?latitude="+z.lat+"&longitude="+z.lon+"&daily=precipitation_sum,temperature_2m_mean,temperature_2m_min,soil_moisture_0_to_10cm_mean,et0_fao_evapotranspiration&past_days="+st.past+"&forecast_days=8&timezone=Europe%2FParis",15000);
      if(!ok())return;const d=o.daily;
      z.L={p:f(d.precipitation_sum),t:f(d.temperature_2m_mean),tn:f(d.temperature_2m_min),sm:f(d.soil_moisture_0_to_10cm_mean),et:f(d.et0_fao_evapotranspiration),off:st.past};
      if(typeof o.elevation=="number")z.alt=Math.round(o.elevation);
      z.dT=0;z.altS=z.alt;z.src.w="exacte au point (Open-Meteo)";z.src.a="exacte au point";renderDetail();renderSpots();
    }catch(e){}})(),
    (async()=>{try{
      const dd=.0008,o=await J("https://data.geopf.fr/wms-v/ows?"+new URLSearchParams({SERVICE:"WMS",VERSION:"1.3.0",REQUEST:"GetFeatureInfo",LAYERS:"LANDCOVER.FORESTINVENTORY.V2",QUERY_LAYERS:"LANDCOVER.FORESTINVENTORY.V2",CRS:"EPSG:4326",BBOX:[z.lat-dd,z.lon-dd,z.lat+dd,z.lon+dd].join(","),WIDTH:10,HEIGHT:10,I:5,J:5,INFO_FORMAT:"application/json"}),15000);
      if(!ok())return;
      const ft=(o.features||[])[0];
      if(!ft){z.nf=true;z.urb=false;z.sparse=false;z.open=(z.blk>0&&z.blk<7)?"clair":(z.blk==7?"prairie":"autre");z.src.f="IGN au point : pas de forêt"+(z.open=="clair"?" (clairière ou lisière dans un bloc boisé)":"");renderDetail();renderSpots();return}
      const pr=ft.properties||{},txt=((pr.tfv_g11||"")+" "+(pr.tfv||"")+" "+(pr.essence||"")).toLowerCase();
      z.nf=false;z.urb=false;z.sparse=false;z.fo=txt.includes("mixte")?"m":txt.includes("feuillus")?"f":/conif|pin|sapin|epicea|épicéa/.test(txt)?"r":"m";
      z.src.f="IGN au point : "+(pr.tfv||pr.essence||"forêt");renderDetail();
    }catch(e){}})(),
    (async()=>{try{
      if(SOL)return;   // sol déjà connu par bloc de 2,8 km ; le service REST de SoilGrids met 20 à 30 s à répondre
      const o=await J("https://rest.isric.org/soilgrids/v2.0/properties/query?lon="+z.lon+"&lat="+z.lat+"&property=phh2o&depth=0-5cm&value=mean",9000);
      if(!ok())return;
      const v=o.properties.layers[0].depths[0].values.mean;
      if(typeof v=="number"){z.ph=Math.round(v)/10;z.so=z.ph<5.5?"a":z.ph>6.8?"c":"n";z.sol=Object.assign(z.sol||{},{ph:z.ph});z.src.s="SoilGrids au point (pH) et bloc de 2,8 km (texture)";renderDetail()}
    }catch(e){}})()
  ];
  await Promise.all(tasks);
}
// Avis sur le lieu : niveau, comparaison avec le reste de la France, lieu vs conditions du moment, frein principal, tendance.
function verdictHtml(sp,z,r,rv,arr,d){
  if(z.anth){
    const w=z.anth=="ville"?"une agglomération":"un axe routier principal";
    return `<div class="verdict v0"><b class="lab">Non propice</b><p>Ce point se trouve sur ${w} : aucune présence ${sp.du} n'est possible ici. Cherchez dans la forêt voisine.</p></div>`;
  }
  const v=rv.sc,lvl=v>=70?4:v>=55?3:v>=35?2:v>=20?1:0;
  const lab=["Très peu propice","Peu propice","Moyennement propice","Propice","Très propice"][lvl];
  const S=st.view==="all"?null:st.scoreSorted;let pct=null;   // en vue « toutes », le rang parmi toutes les espèces n'a pas de sens pour une seule
  if(S&&S.length){let lo=0,hi=S.length;while(lo<hi){const m=(lo+hi)>>1;if(S[m]<v)lo=m+1;else hi=m}pct=Math.round(100*lo/S.length)}
  const hab=habOnly(sp,z).sc,cond=Math.round(100*(r.M||0));
  const fac=[["le sol",r.so],["la forêt",r.fo],["l'altitude",r.al],["la température",r.tf],["l'humidité",r.rf],["la saison",r.sf]].sort((a,b)=>a[1]-b[1])[0];
  const early=(arr[0]+arr[1]+arr[2])/3,late=(arr[5]+arr[6]+arr[7])/3,tr=late-early>=6?"en hausse":late-early<=-6?"en baisse":"stable";
  const best=arr.indexOf(Math.max(...arr)),bd=dateOf(best).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const lieu=hab>=70?"très adapté":hab>=45?"adapté":hab>=20?"peu adapté":"inadapté";
  const cnd=cond>=70?"très favorables":cond>=45?"correctes":cond>=20?"médiocres":"défavorables";
  const nf=z.nf?" Pas de forêt à cet endroit : cherchez le massif le plus proche.":"";
  return `<div class="verdict v${lvl}"><b class="lab">${lab}</b> ${sp.toxic?"":starsHtml(lvl+1)} <span class="sub">à cet endroit pour ${sp.det} (${v}/100)</span>
  <p>${pct!=null?`Mieux que ${pct} % des zones de France sur cette vue. `:""}Lieu <b>${lieu}</b> (sol, forêt, altitude : ${hab}/100) ; conditions du moment <b>${cnd}</b> (${cond}/100).${fac[1]<.6?` Principal frein : ${fac[0]} (${Math.round(fac[1]*100)} %).`:""}${nf}</p>
  <p>Tendance sur 8 jours : <b>${tr}</b>${arr[best]>arr[d]+4?` ; meilleur jour : ${bd} (${arr[best]}).`:"."}</p></div>`;
}
function reliefLine(z,sp,r){
  const rl=z.rel;if(!rl)return "";
  const t=r.tfx,expo=rl.north>.25?"versant nord":rl.north<-.25?"versant sud":"exposition neutre",pos=rl.tpi<-15?"fond de vallon ou dépression":rl.tpi>15?"crête ou sommet":"position intermédiaire";
  const eff=t?`humidité ${t.fm>=1?"+":"−"}${Math.abs(Math.round((t.fm-1)*100))} % en période sèche · pente ${Math.round((t.fs-1)*100)} %`:"";
  const dt=z.dT?` · température corrigée de ${z.dT>0?"+":"−"}${fr1(Math.abs(z.dT))} °C par rapport à la maille`:"";
  return `<p class="prov"><b>Relief</b> (${(z.src&&z.src.r)||"bloc de 2,8 km"}) — altitude ${z.alt} m · pente ${Math.round(rl.slope)}° · ${expo} · ${pos}${dt}.<br>Effet pour ${sp.det} : ${eff}.</p>`;
}
function soilLine(z,sp,r){
  const s=z.sol;
  if(!s)return `<p class="prov"><b>Sol</b> — catégorie ${SOIL[z.so]} (pas de mesure fine disponible).</p>`;
  const tx=texClass(s.sand,s.clay),dr=drainClass(s.sand,s.clay),f=r.sfx;
  const mes=[s.ph!=null?"pH "+fr1(s.ph):null,s.sand!=null?"sable "+Math.round(s.sand)+" %":null,s.clay!=null?"argile "+Math.round(s.clay)+" %":null,s.soc!=null?"carbone organique "+Math.round(s.soc)+" g/kg":null].filter(Boolean).join(" · ");
  const fac=f?`pH ${Math.round(f.fp*100)} % · drainage ${Math.round(f.fd*100)} %${sp.soc?" · humus "+Math.round(f.fo*100)+" %":""}`:"";
  return `<p class="prov"><b>Sol</b> (${(z.src&&z.src.s)||"maille"}) — ${mes}${tx?" · texture "+tx:""}${dr?" · drainage "+dr:""} (déduit de la texture seule).${fac?`<br>Adéquation pour ${sp.det} : ${fac}.`:""}</p>`;
}
function renderDetail(){
  updateActions();
  const sp=SP[st.sp],d=st.day,zsel=st.ptZ;
  if(!zsel){
    $("detail").innerHTML=`<h2>Un endroit à juger ?</h2><p class="sub" style="margin:0">Touchez la carte pour savoir si l'endroit est propice à ${sp.det} : météo, forêt, sol et relief y sont interrogés exactement.</p><div class="cta"><button class="btn" id="ctame" type="button">Ma position</button></div><p class="hint">Astuce : survolez la carte pour voir le niveau de propice, déplacez-vous au zoom 10 ou plus pour voir les petits massifs.</p>`;
    $("ctame").onclick=locateMe;
    return;
  }
  const r=score(sp,zsel,d),rv=viewScore(sp,zsel,true);
  const arr=[...Array(8)].map((_,k)=>score(sp,zsel,k).sc);
  const bar=(l,v)=>`<div class="m"><span>${l}</span><i><span style="width:${Math.round(v*100)}%"></span></i><b>${Math.round(v*100)}</b></div>`;
  const src=zsel.src||{};
  const sparkHtml=`<div class="spark" role="img" aria-label="Score des 8 prochains jours : ${arr.join(", ")} sur 100">${arr.map((v,k)=>`<div class="${k==d?"sel":""}" title="${v}"><i style="height:${Math.max(2,v*.34)}px;background:${v<22?"var(--line)":gC(v)}"></i>${k==0?"auj.":"J+"+k}</div>`).join("")}</div>`;
  $("detail").innerHTML=`<h2>${zsel.near?nearT(zsel.near):zsel.n}</h2>${zsel.near?`<div class="sub">${zsel.n}</div>`:""}${verdictHtml(sp,zsel,r,rv,arr,d)}${sp.toxic?`<p class="toxnote">⚠ Espèce toxique : ce résultat indique où elle peut pousser, pas où la cueillir pour la consommer.</p>`:""}${sparkHtml}${spotsHtml()}<details class="why"><summary>Pourquoi ce score ? (détail du calcul)</summary><div class="sub" style="margin:8px 0 6px">${sp.n} : <b style="color:${col(r.sc)}">${r.sc}/100</b>${st.view!="day"?` · vue « ${VIEWS.find(v=>v.k==st.view).t} » : <b style="color:${col(rv.sc)}">${rv.sc}</b>`:""} · ${zsel.alt} m · sol ${SOIL[zsel.so]}${zsel.ph?" (pH "+zsel.ph+")":""} · ${zsel.urb?"zone urbanisée / sans forêt":zsel.nf?"pas de forêt ici":FOR[zsel.fo]}${r.w.frostHard?" · ⚠ gel fort récent":r.w.frostLight?" · gelée légère récente":""}</div>
  ${bar("Sol",r.so)}${bar("Forêt",r.fo)}${bar("Altitude",r.al)}${bar("Température",r.tf)}${bar("Humidité",r.rf)}${bar("Saison",r.sf)}
  <div class="sub">Pluie 14 j : ${Math.round(r.w.R)} mm${r.w.RL!=null?" · "+sp.rw+" j : "+Math.round(r.w.RL)+" mm":""} · température moyenne : ${r.w.T.toFixed(1)} °C</div>
  ${soilLine(zsel,sp,r)}
  ${reliefLine(zsel,sp,r)}
  <p class="prov"><b>Origine des données</b> — météo : ${src.w||"de la maille"} · altitude : ${src.a||"de la maille"} · forêt : ${src.f||"de la maille"} · sol : ${src.s||"de la maille"}.</p>
  <p class="note">Solidité des paramètres de ${sp.n} : ${["estimés avec prudence (peu d'études directes)","partiellement documentés","appuyés sur des études de terrain (souvent hors France)"][sp.ev||0]}.</p></details>`;
  mySpotsHook();
  rainHook(zsel,d);
  speciesHook(zsel,d);
  conditionsHook(sp,zsel,r,d);
  cmpHook();
  renderCurves(sp,zsel,r.w&&r.w.T,d);
}
// ---------- Comparateur : deux espèces côte à côte sur le point choisi ----------
function cmpHook(){
  const z=st.ptZ;if(!z)return;
  const box=document.createElement("div");box.className="cmp";
  let html=`<label class="opt">Comparer avec <select id="cmpsel" aria-label="Espèce à comparer"><option value="-1">—</option>${SP.map((s,i)=>i===st.sp?"":`<option value="${i}"${i===st.cmp?" selected":""}>${s.n}</option>`).join("")}</select></label>`;
  if(st.cmp>=0&&st.cmp!==st.sp&&SP[st.cmp]){
    const A=SP[st.sp],B=SP[st.cmp],d=st.day,ra=score(A,z,d),rb=score(B,z,d);
    const best=s=>{const a=[...Array(8)].map((_,k)=>score(s,z,k).sc),m=Math.max(...a);return{m,k:a.indexOf(m)}};
    const ba=best(A),bb=best(B),lb=k=>k==0?"auj.":"J+"+k;
    const row=(l,a,b)=>`<tr><th>${l}</th><td class="${a>b?"win":""}">${a}</td><td class="${b>a?"win":""}">${b}</td></tr>`;
    const fac=[["Sol","so"],["Forêt","fo"],["Altitude","al"],["Température","tf"],["Humidité","rf"],["Saison","sf"]].map(([l,k])=>row(l,Math.round(ra[k]*100),Math.round(rb[k]*100))).join("");
    html+=`<table class="cmpt"><thead><tr><th></th><th>${A.n}</th><th>${B.n}</th></tr></thead><tbody>${row("Note sur 5",starsOf(ra.sc),starsOf(rb.sc))}${row("Score ce jour",ra.sc,rb.sc)}${row("Meilleur score sur 8 j",ba.m,bb.m)}${fac}</tbody></table><p class="sub">Meilleur jour : ${A.n} ${lb(ba.k)} · ${B.n} ${lb(bb.k)}</p>${A.toxic||B.toxic?`<p class="toxnote">⚠ Espèce toxique : ce résultat indique où elle peut pousser, pas où la cueillir pour la consommer.</p>`:""}`;
  }
  box.innerHTML=html;$("detail").appendChild(box);
  $("cmpsel").onchange=e=>{st.cmp=+e.target.value;renderDetail()};
}
// ---------- Ce qui sort ici : les espèces les plus favorables autour du centre de la carte ----------
function renderNow(){
  const box=$("nowg"),ul=$("nowl"),msg=$("nowmsg");if(!box||!ul)return;
  ul.textContent="";msg.hidden=true;$("nowwhere").textContent="";
  if(!st.live||!map||!box.open)return;
  const c=map.getCenter(),say0=t=>{msg.textContent=t;msg.hidden=false};
  if(!(c.lat>=41&&c.lat<=51.5&&c.lng>=-5.5&&c.lng<=10))return say0("Centrez la carte sur la France pour voir les espèces du moment.");
  const z=makeZone(c.lat,c.lng);
  if(z.anth)return say0("Zone urbanisée ou routière : déplacez la carte vers la forêt.");
  $("nowwhere").textContent="· "+nearInline(z.near);
  const rows=SP.map((s,i)=>{
    if(s.toxic)return null;
    const a=[...Array(8)].map((_,d)=>score(s,z,d).sc),m=Math.max(...a);
    return{i,n:s.n,t:a[0],m,k:a.indexOf(m)};
  }).filter(r=>r&&spLevel(Math.max(r.t,r.m))>0).sort((x,y)=>y.t-x.t||y.m-x.m).slice(0,5);
  if(!rows.length)return say0("Aucune espèce favorable ici dans les 8 prochains jours. Déplacez la carte.");
  rows.forEach(r=>{
    const li=document.createElement("li"),b=document.createElement("button");
    li.className="l"+spLevel(r.t);b.type="button";b.className="btn";
    const n=document.createElement("span"),sc=document.createElement("span");
    n.textContent=r.n;sc.className="sc";sc.textContent=starsTxt(starsOf(r.t))+" "+r.t+"/100"+(r.k>0&&r.m>r.t?" · pic J+"+r.k:"");
    b.append(n,sc);
    b.onclick=()=>{const t=document.querySelector('#chips button[data-i="'+r.i+'"]');if(t)t.click()};
    li.appendChild(b);ul.appendChild(li);
  });
}
function scheduleNow(){clearTimeout(st.nowT);st.nowT=setTimeout(renderNow,300)}
// ---------- Mes spots : points enregistrés sur l'appareil (localStorage) ----------
const SPOTS_KEY="cm:spots:v1";
function spotsLoad(){try{const a=JSON.parse(localStorage.getItem(SPOTS_KEY)||"[]");return Array.isArray(a)?a.filter(s=>s&&isFinite(s.lat)&&isFinite(s.lon)):[]}catch(e){return[]}}
function spotsSave(a){try{localStorage.setItem(SPOTS_KEY,JSON.stringify(a.slice(0,50)))}catch(e){}}
const spotNear=(a,lat,lon)=>a.findIndex(s=>Math.abs(s.lat-lat)<.001&&Math.abs(s.lon-lon)<.001);
function mySpotsHook(){
  const z=st.pt;if(!z)return;
  const w=document.createElement("div"),nv=document.createElement("a");w.className="cta";
  nv.className="btn";nv.textContent="Y aller";nv.href=navUrl(z.lat,z.lon);nv.target="_blank";nv.rel="noopener";
  w.append(nv);$("detail").appendChild(w);
}
// ---------- Barre fixe du tiroir : « Enregistrer ce spot » et « J'ai trouvé ici » ----------
function updateActions(){
  const bar=$("actions");if(!bar)return;
  bar.hidden=!st.pt;if(!st.pt)return;
  const saved=spotNear(spotsLoad(),st.pt.lat,st.pt.lon)>=0;
  $("actSave").textContent=saved?"★ Spot enregistré · retirer":"Enregistrer ce spot";
  $("actSave").setAttribute("aria-pressed",saved);
}
function toggleSpotAtPoint(){
  const z=st.pt;if(!z)return;
  const a=spotsLoad(),i=spotNear(a,z.lat,z.lon);
  if(i>=0)a.splice(i,1);
  else{
    const def=(st.ptZ&&st.ptZ.near)?nearT(st.ptZ.near):"Point "+fmtCoord(z.lat,z.lon);
    let n=def;try{const r=window.prompt("Nom du spot",def);if(r===null)return;n=r.trim().slice(0,60)||def}catch(e){}
    a.unshift({lat:+z.lat.toFixed(5),lon:+z.lon.toFixed(5),name:n,ts:Date.now()});
  }
  spotsSave(a);renderMySpots();renderDetail();
}
// Enregistre une trouvaille ; crée le spot s'il n'existe pas encore à cet endroit (un seul geste depuis la carte).
function recordFind(lat,lon,spName,iso,q){
  const a=spotsLoad();let i=spotNear(a,lat,lon);
  if(i<0){
    const z=st.ptZ&&st.pt&&Math.abs(st.pt.lat-lat)<.001&&Math.abs(st.pt.lon-lon)<.001?st.ptZ:null;
    a.unshift({lat:+(+lat).toFixed(5),lon:+(+lon).toFixed(5),name:(z&&z.near)?nearT(z.near):"Point "+fmtCoord(lat,lon),ts:Date.now()});i=0;
  }
  const day=(iso&&iso<=isoDay(Date.now()))?iso:isoDay(Date.now()),o={ts:new Date(day+"T12:00:00").getTime(),d:day,sp:spName,q:String(q||"").trim().slice(0,40)},m=findSnapshot(a[i],spName,day);
  if(m)o.m=m;
  a[i].finds=[o].concat(a[i].finds||[]).sort((x,y)=>y.ts-x.ts).slice(0,100);
  spotsSave(a);renderMySpots();renderDetail();return{spot:a[i],find:o};
}
function openFindQ(){
  if(!st.pt)return;
  const sel=$("fqSp");
  if(!sel.options.length)SP.forEach(x=>{const o=document.createElement("option");o.value=x.n;o.textContent=x.n;sel.appendChild(o)});
  sel.value=SP[st.sp].n;$("fqDate").value=isoDay(Date.now());$("fqDate").max=$("fqDate").value;$("fqQty").value="";
  $("findq").hidden=false;try{sel.focus()}catch(e){}
}
function closeFindQ(){$("findq").hidden=true;try{$("actFind").focus()}catch(e){}}
// ---------- Tiroir mobile : trois crans (réduit, moyen, plein), glissé depuis la poignée ----------
function setSheet(n){
  st.sheet=n;document.documentElement.style.setProperty("--sheet-h",sheetPx(n)+"px");
  document.documentElement.dataset.sheet=n;
  const g=$("grab");if(g){g.setAttribute("aria-expanded",n!=="peek");g.dataset.state=n}
  applyBounds();
}
// cran visé après un glissement : le plus proche, ou le suivant dans le sens du geste si celui-ci est franc (> 60 px)
function snapSheet(h,dy){
  let n=["peek","half","full"].map(k=>[k,Math.abs(sheetPx(k)-h)]).sort((x,y)=>x[1]-y[1])[0][0];
  if(Math.abs(dy)>60)n=dy>0?(n==="peek"?"half":"full"):(n==="full"?"half":"peek");
  return n;
}
function ensureVisible(){   // garde le point choisi visible au-dessus du tiroir
  if(!mqMobile.matches||!st.pt||!map)return;
  const sz=map.getSize(),vis=sz.y-sheetPx(st.sheet||"half"),p=map.latLngToContainerPoint([st.pt.lat,st.pt.lon]);
  if(p.y>vis-50||p.y<50)map.panBy([0,p.y-vis/2],{animate:true});
}
// Le nom de lieu est parfois déjà une phrase (« Secteur Landes… », « À 105 km au nord de… ») : on n'y ajoute pas « près de »
const nearPhrase=n=>/^(Secteur|À) /.test(n);
const nearT=n=>nearPhrase(n)?n:"Près de "+n;
const nearInline=n=>nearPhrase(n)?n.charAt(0).toLowerCase()+n.slice(1):"près de "+n;
const fmtCoord=(lat,lon,dec=2)=>Math.abs(lat).toFixed(dec).replace(".",",")+" °"+(lat>=0?"N":"S")+", "+Math.abs(lon).toFixed(dec).replace(".",",")+" °"+(lon>=0?"E":"O");
const navUrl=(lat,lon)=>"https://www.google.com/maps/dir/?api=1&destination="+lat+","+lon+"&travelmode=driving";
const fmtDay=ts=>new Date(ts).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
const spotSay=m=>{try{say(m)}catch(e){}};
// Prévision d'un spot pour l'espèce choisie : zone reconstruite hors-ligne depuis la grille, comme pour un point touché sur la carte.
function spotForecast(s){
  if(!st.live)return null;
  try{
    const sp=SP[st.sp],z=makeZone(s.lat,s.lon);
    if(z.anth)return{t:0,m:0,k:0};
    const a=[...Array(8)].map((_,d)=>score(sp,z,d).sc),m=Math.max(...a);
    return{t:a[0],m,k:a.indexOf(m)};
  }catch(e){return null}
}
function spotsExport(){
  const b=new Blob([JSON.stringify({v:1,spots:spotsLoad()},null,1)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download="mes-spots-champignons.json";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
// ---------- Trouvailles contre modèle ----------
// Le score du modèle est calculé AU MOMENT où la trouvaille est enregistrée (la grille météo ne garde que ~40 jours d'historique) et conservé avec elle.
const isoDay=ts=>{const x=new Date(ts);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const daysAgo=iso=>{const a=new Date(iso+"T12:00:00"),b=new Date();b.setHours(12,0,0,0);return Math.round((b-a)/864e5)};
function findSnapshot(spot,spName,iso){
  const k=daysAgo(iso),sp=SP.find(x=>x.n===spName);
  if(!sp||sp.toxic||!st.live||!(k>=0)||k>st.off)return null;
  try{
    const z=makeZone(spot.lat,spot.lon);if(z.anth)return null;
    const r=score(sp,z,-k),days=[];
    for(let d=Math.max(-st.off,-k-29);d<=-k;d++)days.push(score(sp,z,d).sc);
    const below=days.filter(v=>v<r.sc).length;
    return{sc:Math.round(r.sc),k,n:days.length,pct:days.length>=10?Math.round(100*below/days.length):null,part:k>st.off-26,
      f:{so:Math.round(r.so*100),fo:Math.round(r.fo*100),al:Math.round(r.al*100),tf:Math.round(r.tf*100),rf:Math.round(r.rf*100),sf:Math.round(r.sf*100)}};
  }catch(e){return null}
}
// Bilan : AUCUN ajustement du modèle sous 8 trouvailles évaluées réparties sur au moins 3 jours (trop peu pour distinguer le modèle du hasard).
function calibSummary(finds){
  const ms=finds.filter(f=>f&&f.m&&isFinite(f.m.sc)),n=ms.length,days=new Set(ms.map(f=>f.d||isoDay(f.ts))).size;
  const sc=ms.map(f=>f.m.sc).sort((x,y)=>x-y),med=n?(n%2?sc[(n-1)/2]:(sc[n/2-1]+sc[n/2])/2):null;
  const pc=ms.map(f=>f.m.pct).filter(v=>v!=null).sort((x,y)=>x-y),pmed=pc.length?pc[Math.floor(pc.length/2)]:null;
  const hi=ms.filter(f=>f.m.sc>=55).length;
  let verdict="insuffisant";
  if(n>=8&&days>=3)verdict=med>=55?"coherent":med>=35?"prudent":"tresprudent";
  return{n,days,med,pmed,hi,verdict};
}
function renderFinds(a){
  const box=$("myfinds");if(!box)return;box.textContent="";
  const all=[];a.forEach(s=>(s.finds||[]).forEach(f=>all.push({s,f})));
  if(!all.length)return;
  all.sort((x,y)=>y.f.ts-x.f.ts);
  const h=document.createElement("h4"),ul=document.createElement("ul"),sm=calibSummary(all.map(x=>x.f)),p=document.createElement("p");
  h.textContent="Trouvailles et modèle";ul.className="finl";
  all.slice(0,6).forEach(({s,f})=>{
    const li=document.createElement("li"),m=f.m,l1=document.createElement("div"),l2=document.createElement("div");
    l1.textContent=fmtDay(f.ts)+" · "+f.sp+(f.q?" ("+f.q+")":"")+" · "+s.name;
    l2.className="fc";
    l2.textContent=m?"Modèle ce jour-là : "+m.sc+"/100 "+starsTxt(starsOf(m.sc))+(m.pct!=null?" · meilleur que "+m.pct+" % des 30 jours précédents":"")+(m.part?" (historique partiel)":""):"Modèle non évalué (trouvaille trop ancienne, espèce inconnue ou zone urbaine).";
    li.append(l1,l2);ul.appendChild(li);
  });
  p.className="fc";
  if(sm.verdict==="insuffisant")p.textContent="Bilan : "+sm.n+" trouvaille"+(sm.n>1?"s":"")+" évaluée"+(sm.n>1?"s":"")+" sur "+sm.days+" jour"+(sm.days>1?"s":"")+". Trop peu de trouvailles pour conclure : il en faut au moins 8, sur au moins 3 jours différents. Le modèle n'est pas modifié.";
  else p.textContent="Bilan sur "+sm.n+" trouvailles ("+sm.days+" jours) : score médian "+sm.med+"/100, "+sm.hi+" sur "+sm.n+" au niveau « propice » ou mieux"+(sm.pmed!=null?", rang médian "+sm.pmed+" %":"")+". "+
    (sm.verdict==="coherent"?"Le modèle est cohérent avec tes trouvailles.":sm.verdict==="prudent"?"Le modèle est plutôt prudent pour toi : tes trouvailles ont lieu à des scores moyens.":"Le modèle semble très prudent pour toi : tes trouvailles ont lieu à des scores bas. Cela justifierait un ajustement ; il n'est pas appliqué automatiquement.");
  box.append(h,ul,p);
}
function spotsImport(file){
  const r=new FileReader();
  r.onload=()=>{try{
    const j=JSON.parse(r.result),inc=(Array.isArray(j)?j:j.spots)||[],a=spotsLoad();let n=0;
    inc.forEach(x=>{if(x&&isFinite(x.lat)&&isFinite(x.lon)&&spotNear(a,+x.lat,+x.lon)<0){
      a.push({lat:+x.lat,lon:+x.lon,name:String(x.name||"Spot").slice(0,60),ts:+x.ts||Date.now(),
        finds:(Array.isArray(x.finds)?x.finds:[]).slice(0,100).map(f=>{const ts=+f.ts||Date.now(),o={ts,d:/^\d{4}-\d{2}-\d{2}$/.test(f.d||"")?f.d:isoDay(ts),sp:String(f.sp||"").slice(0,60),q:String(f.q||"").slice(0,40)};if(f.m&&isFinite(f.m.sc)&&f.m.sc>=0&&f.m.sc<=100)o.m={sc:Math.round(+f.m.sc),k:+f.m.k||0,n:+f.m.n||0,pct:isFinite(f.m.pct)?Math.round(+f.m.pct):null,part:!!f.m.part};return o})});n++}});
    spotsSave(a);renderMySpots();spotSay(n+" spot"+(n>1?"s":"")+" importé"+(n>1?"s":""));
  }catch(e){spotSay("Fichier illisible : choisissez une sauvegarde exportée depuis cette carte.")}};
  r.readAsText(file);
}
function renderMySpots(){
  const a=spotsLoad(),box=$("myspots"),ul=$("myspl");if(!box||!ul)return;
  $("myspn").textContent=a.length?"("+a.length+")":"";$("myspempty").hidden=!!a.length;ul.textContent="";
  if(!box.open)return;   // les prévisions ne sont calculées que carte ouverte
  const sp=SP[st.sp];
  a.forEach(s=>{
    const li=document.createElement("li"),row=document.createElement("div"),go=document.createElement("button"),nav=document.createElement("a"),
      fb=document.createElement("button"),del=document.createElement("button"),fc=document.createElement("div");
    row.className="row";
    go.type=fb.type=del.type="button";go.className="btn go";go.textContent=s.name;go.title=fmtCoord(s.lat,s.lon,4);
    go.onclick=()=>{setPoint(s.lat,s.lon,true)};
    nav.className="btn";nav.textContent="Y aller";nav.href=navUrl(s.lat,s.lon);nav.target="_blank";nav.rel="noopener";nav.setAttribute("aria-label","Itinéraire vers "+s.name);
    fb.className="btn";fb.textContent="🧺";fb.setAttribute("aria-label","Noter une trouvaille à "+s.name);
    del.className="btn del";del.textContent="✕";del.setAttribute("aria-label","Retirer "+s.name);
    del.onclick=()=>{const b=spotsLoad(),i=spotNear(b,s.lat,s.lon);if(i>=0){b.splice(i,1);spotsSave(b)}renderMySpots();if(st.pt)renderDetail()};
    row.append(go,nav,fb,del);li.appendChild(row);
    const f=spotForecast(s);fc.className="fc";
    if(f){
      const lv=spLevel(f.t);
      fc.textContent=sp.n+(sp.toxic?"":" "+starsTxt(starsOf(f.t)))+" : "+f.t+"/100 aujourd'hui"+(f.k>0&&f.m>f.t?" · pic "+f.m+" (J+"+f.k+")":"");
      if(lv>=3){const bd=document.createElement("b");bd.className="ok";bd.textContent="Bon moment";fc.append(" ",bd)}
      li.appendChild(fc);
    }
    const fl=(s.finds||[]);
    if(fl.length){const p=document.createElement("div");p.className="fc";p.textContent="🧺 "+fl.length+" trouvaille"+(fl.length>1?"s":"")+" · dernière le "+fmtDay(fl[0].ts)+" ("+fl[0].sp+(fl[0].q?", "+fl[0].q:"")+")"+(fl[0].m?" · modèle : "+fl[0].m.sc+"/100":"");li.appendChild(p)}
    // formulaire de trouvaille
    const form=document.createElement("div"),sel=document.createElement("select"),q=document.createElement("input"),dt=document.createElement("input"),ad=document.createElement("button");
    form.className="finform";form.hidden=true;sel.setAttribute("aria-label","Espèce trouvée");
    SP.forEach((x,i)=>{const o=document.createElement("option");o.value=x.n;o.textContent=x.n;if(i===st.sp)o.selected=true;sel.appendChild(o)});
    dt.type="date";dt.value=isoDay(Date.now());dt.max=dt.value;dt.setAttribute("aria-label","Date de la trouvaille");
    q.type="text";q.maxLength=40;q.placeholder="Quantité";q.setAttribute("aria-label","Quantité");
    ad.type="button";ad.className="btn";ad.textContent="Ajouter";
    ad.onclick=()=>{const b=spotsLoad(),i=spotNear(b,s.lat,s.lon);if(i<0)return;
      recordFind(s.lat,s.lon,sel.value,dt.value,q.value)};
    fb.onclick=()=>{form.hidden=!form.hidden};
    form.append(sel,dt,q,ad);li.appendChild(form);ul.appendChild(li);
  });
  renderFinds(a);
}
renderMySpots();
$("myspots").addEventListener("toggle",renderMySpots);
$("nowg").addEventListener("toggle",renderNow);
$("spexp").onclick=spotsExport;$("spimp").onclick=()=>$("spfile").click();
$("spfile").onchange=e=>{if(e.target.files[0])spotsImport(e.target.files[0]);e.target.value=""};
// ---------- Données quotidiennes (data.json produit par build_data.py) ----------
async function loadLive(){
  try{
    const r=await fetch("data.json",{cache:"no-cache"});if(!r.ok)return;
    const j=await r.json();if(!j.cells||!j.cells.length)return;
    // terrain.json (optionnel) : pH du sol et forêt réels par maille
    let terrain={};
    try{const t=await fetch("terrain.json",{cache:"no-cache"});if(t.ok)terrain=await t.json()}catch(e){}
    const phToSoil=ph=>ph==null?null:ph<5.5?"a":ph>6.8?"c":"n";
    const t0=new Date(j.start+"T12:00:00"),t1=new Date();t1.setHours(12,0,0,0);
    st.off=Math.round((t1-t0)/864e5);
    {const dd=new Date(t0);dd.setDate(dd.getDate()+(j.cells[0][3].length-8));st.dataDate=dd.toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}   // jour de la collecte (la série commence 40 jours avant)
    const REFZ=REF;
    Z=j.cells.map((c,i)=>{
      let best=null,bd=1e9;REFZ.forEach(q=>{const k=km(c[0],c[1],q.lat,q.lon);if(k<bd){bd=k;best=q}});
      const tr=terrain[ckey(c[0],c[1])]||{};
      const so=phToSoil(tr.ph)||best.so;
      const fo=tr.fo||best.fo;
      const noForest=("fo" in tr)&&!tr.fo; // IGN consulté : pas de forêt ici
      // nom honnête : le massif seulement s'il est vraiment proche
      let nc=null,bc=1e9;for(const cn in CITIES){const k=km(c[0],c[1],CITIES[cn][0],CITIES[cn][1]);if(k<bc){bc=k;nc=cn}}
      const r5=v=>Math.max(5,Math.round(v/5)*5);
      // direction du repère vers la maille : « À 40 km au nord-est de Toulouse »
      const dirTo=(la,lo)=>{const a=(Math.atan2((c[1]-lo)*Math.cos(la*Math.PI/180),c[0]-la)*180/Math.PI+360)%360,i=Math.round(a/45)%8;return["au nord","au nord-est","à l'est","au sud-est","au sud","au sud-ouest","à l'ouest","au nord-ouest"][i]};
      const nom=bd<=25?"Secteur "+best.n:bc<=25?"Autour de "+nc:bd<=bc?"À "+r5(bd)+" km "+dirTo(best.lat,best.lon)+" de "+best.n:"À "+r5(bc)+" km "+dirTo(CITIES[nc][0],CITIES[nc][1])+" de "+nc;
      const urb=noForest&&("ph" in tr)&&tr.ph==null; // SoilGrids sans valeur et pas de forêt : urbain, eau ou très artificialisé
      return{i,n:nom,lat:c[0],lon:c[1],alt:c[2],so,fo,mi:best.mi,nf:noForest,urb,ph:tr.ph};
    });
    st.live=j.cells.map(c=>({p:c[3],t:c[4],tn:c[5],sm:c[6],et:c[7]}));
    st.past=Math.max(1,j.cells[0][3].length-8);
    if(j.generated){const g=new Date(j.generated);st.fetchedAt=g.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})+" à "+g.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
    st.pt=null;st.ptZ=null;
    buildHeat();indexCells();
    render();
    await Promise.all([loadForets(),loadMasks(),loadSol(),loadRelief()]);
    applySol();
    applyRelief();
    buildFineGrid();
    if(FINE||SOL||RLF)render();
    applyHash();
  }catch(e){}
}
// Axes routiers principaux : tronçons simplifiés, indexés par cases d'environ 1 km ; sert à ôter les points sur la chaussée.
let ROADS=null;
function buildRoads(j){
  const u=j.u||1000,grid=new Map();
  const put=(la,lo,seg)=>{const k=Math.floor(la*100)*100000+Math.floor(lo*100);let a=grid.get(k);if(!a){a=[];grid.set(k,a)}if(a[a.length-1]!==seg)a.push(seg)};
  (j.lines||[]).forEach(l=>{
    let la=l[0]/u,lo=l[1]/u;
    for(let i=2;i<l.length;i+=2){
      const la2=la+l[i]/u,lo2=lo+l[i+1]/u,seg=[la,lo,la2,lo2],n=Math.max(1,Math.ceil(Math.max(Math.abs(la2-la),Math.abs(lo2-lo))/.005));
      for(let t=0;t<=n;t++)put(la+(la2-la)*t/n,lo+(lo2-lo)*t/n,seg);
      la=la2;lo=lo2;
    }
  });
  ROADS={grid};
}
function nearRoad(lat,lon,m){
  if(!ROADS)return false;
  const gi=Math.floor(lat*100),gj=Math.floor(lon*100),kx=Math.cos(lat*Math.PI/180)*111320,ky=110540;
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
    const a=ROADS.grid.get((gi+di)*100000+gj+dj);if(!a)continue;
    for(const g of a){
      const x1=(g[1]-lon)*kx,y1=(g[0]-lat)*ky,x2=(g[3]-lon)*kx,y2=(g[2]-lat)*ky,dx=x2-x1,dy=y2-y1,n=dx*dx+dy*dy;
      const t=n?Math.max(0,Math.min(1,-(x1*dx+y1*dy)/n)):0,px=x1+t*dx,py=y1+t*dy;
      if(px*px+py*py<m*m)return true;
    }
  }
  return false;
}
async function loadMasks(){
  const get=async f=>{try{const r=await fetch(f,{cache:"no-cache"});return r.ok?await r.json():null}catch(e){return null}};
  const [u,r]=await Promise.all([get("urbain.json"),get("routes.json")]);
  if(u&&u.cells&&u.K)st.urbain=u;
  if(r&&r.lines)buildRoads(r);
}
async function loadForets(){
  try{
    const r=await fetch("forets.json",{cache:"no-cache"});if(!r.ok)return;
    const j=await r.json();if(!j.cells||!j.K)return;
    st.forets=j;
  }catch(e){}
}
function applyHash(){
  const m=/[#&]p=(-?[\d.]+),(-?[\d.]+)/.exec(INIT_HASH);
  if(m)setPoint(parseFloat(m[1]),parseFloat(m[2]),true);
}
if(typeof L=="undefined"){
  $("map").innerHTML='<p style="padding:20px;color:var(--mute)">La bibliothèque de carte (Leaflet) n\'a pas pu être chargée. Vérifiez la connexion internet puis rechargez la page.</p>';
  build();render=()=>{};
}else{
  initMap();build();loadPrefs();buildHeat();render();loadLive();
}
