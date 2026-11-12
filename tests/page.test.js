// Test de la page complète dans un navigateur simulé (jsdom) avec les vraies données du dépôt.
// Réseau simulé : Wikipédia, Open-Meteo, IGN, SoilGrids. Usage : npm test   (code de sortie 1 au moindre échec)
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const errors = [], fails = [];
const check = (nom, ok, detail = '') => { console.log((ok ? '  ok   ' : '  ÉCHEC ') + nom + (ok ? '' : '  ' + detail)); if (!ok) fails.push(nom); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const html0 = read('index.html');
let html = read('index.html')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>' + read('style.css') + '</style>')
  .replace(/<script src="https:\/\/unpkg.com\/leaflet[^>]*><\/script>/, '')
  .replace(/<link[^>]*(unpkg|fonts)[^>]*>/g, '');
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message).split('\n').slice(0, 3).join(' | ')));
vc.on('error', e => errors.push('console.error: ' + e));
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://mehdizaim0-hub.github.io/Carte-Champignon/', virtualConsole: vc });
const w = dom.window;
Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 1000 } });
Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 700 } });
const ctx2d = () => ({ fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, setTransform() {}, beginPath() {}, arc() { w.__arcs = (w.__arcs || 0) + 1 }, fill() {}, clearRect() {}, createImageData: (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) }), putImageData() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, save() {}, restore() {}, scale() {}, translate() {}, rect() {}, clip() {}, drawImage() {}, fillRect() {}, measureText: () => ({ width: 0 }), setLineDash() {}, fillText() {} });
w.HTMLCanvasElement.prototype.getContext = function () { return ctx2d() };
w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
w.matchMedia = q => ({ matches: false, media: q, addListener() {}, addEventListener() {} });
w.requestAnimationFrame = cb => setTimeout(cb, 0);
w.Element.prototype.scrollTo = function () {};
w.Element.prototype.scrollIntoView = function () {};

const files = { 'data.json': 'data.json', 'terrain.json': 'terrain.json', 'forets.json': 'forets.json', 'urbain.json': 'urbain.json', 'routes.json': 'routes.json', 'sol.json': 'sol.json', 'relief.json': 'relief.json' };
w.fetch = async u => {
  u = String(u);
  for (const k in files) if (u.endsWith(k)) return { ok: true, status: 200, json: async () => JSON.parse(read(files[k])) };
  if (u.includes('wikipedia.org/api/rest_v1')) return { ok: true, json: async () => ({ thumbnail: { source: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Boletus_edulis_0.jpg/330px-Boletus_edulis_0.jpg?x=1' } }) };
  if (u.includes('commons.wikimedia.org/w/api.php')) return { ok: true, json: async () => ({ query: { pages: { 1: { imageinfo: [{ extmetadata: { Artist: { value: '<a>Auteur Test</a>' }, LicenseShortName: { value: 'CC BY 4.0' } } }] } } } }) };
  if (u.includes('v1/elevation')) return { ok: true, json: async () => ({ elevation: [1042, 1018, 1056, 1031] }) };
  if (u.includes('open-meteo')) { const d = JSON.parse(read('data.json')).cells[100]; return { ok: true, json: async () => ({ elevation: 151, daily: { precipitation_sum: d[3], temperature_2m_mean: d[4], temperature_2m_min: d[5], soil_moisture_0_to_10cm_mean: d[6], et0_fao_evapotranspiration: d[7] } }) } }
  if (u.includes('geopf')) return { ok: true, json: async () => ({ features: [{ properties: { tfv: 'Forêt fermée de feuillus purs', tfv_g11: 'Feuillus' } }] }) };
  if (u.includes('isric')) return { ok: true, json: async () => ({ properties: { layers: [{ depths: [{ values: { mean: 62 } }] }] } }) };
  return { ok: false, status: 404, json: async () => ({}) };
};
w.eval(read('node_modules/leaflet/dist/leaflet.js'));
const appSrc = read('species.js') + '\n' + read('app.js');
w.addEventListener('error', e => errors.push('window.error: ' + e.message + ' @' + e.lineno));
try { w.eval(appSrc + '\n;window.__st=st;window.__cnv=()=>cnvLayer;window.__stars=starsOf;window.__fine=()=>FINE;window.__sp=SP;window.__score=score;window.__sos=SOSIES;window.__src=SOURCES;window.__fmt=fmtCoord;window.__nearT=nearT;window.__nearI=nearInline;window.__trees=TREE_ICONS;window.__iso=isoDay;window.__sheetPx=sheetPx;window.__mq=mqMobile;window.__map=()=>map;window.__Z=()=>Z;window.__hotes=HOTES;') } catch (e) { errors.push('eval: ' + e.stack.split('\n').slice(0, 4).join(' | ')) }

(async () => {
  const doc = w.document, $ = id => doc.getElementById(id), txt = id => ($(id).textContent || '').replace(/\s+/g, ' ');
  await sleep(3000);
  const st = w.__st;
  console.log('Chargement');
  check('données quotidiennes chargées (2400+ mailles)', st.live && st.live.length > 2400, String(st.live && st.live.length));
  check('forêt fine chargée', !!w.__fine());
  check('bandeau de fraîcheur affiché', /Météo réelle|anciennes/.test(txt('status')), txt('status'));
  check('20 espèces proposées, en 3 groupes d\'habitat', doc.querySelectorAll('#chips button').length === 20 && doc.querySelectorAll('#chips .glab').length === 3);
  check('5 vues proposées (dont « Toutes les espèces »)', doc.querySelectorAll('#views button').length === 5);
  check('jours proposés : la veille et 8 jours (J à J+7)', doc.querySelectorAll('#days button').length === 9 && [...doc.querySelectorAll('#days button')].map(x => x.dataset.d).join() === '-1,0,1,2,3,4,5,6,7');
  check('section « Où chercher » supprimée', !$('rad') && !$('gps') && !$('near') && !/Où chercher \?/.test(txt('side')));
  // vue Habitat : indépendante de la météo du jour, donc stable d'une saison à l'autre
  doc.querySelectorAll('#views button')[3].click(); await sleep(500);
  check('nuage de points tracé (vue Habitat)', (w.__arcs || 0) > 100, String(w.__arcs));
  doc.querySelectorAll('#views button')[1].click(); await sleep(200);
  check('état vide : invitation à toucher la carte', /Touchez la carte/.test(txt('detail')) && !!$('ctame') && !$('ctabest'));
  check('fiche espèce : nom, latin, rubriques', txt('spsumn').length > 3 && txt('splat').length > 3 && $('spdl').querySelectorAll('dt').length + $('spmodel').querySelectorAll('dt').length >= 7);
  check('fiche espèce : photo et crédit', /Auteur Test/.test(txt('spcap')) && /500px/.test($('spimg').src));
  check('légende sur la carte', !!$('maplegend') && !!$('legbody'));

  console.log('Espèces');
  const SPs = w.__sp, mono = a => a.every((v, i) => i === 0 || v >= a[i - 1]);
  const need = ['n', 'grp', 'lat', 'wiki', 'det', 'du', 'hote', 'sol', 'saison', 'alt', 'id', 'txt', 'so', 'fo', 'al', 't', 'ro', 'lag', 'hu', 'gb', 'ph', 'pf', 'wc', 'ws'];
  const bad = SPs.filter(sp => need.some(k => sp[k] === undefined) || sp.gb.length !== 12 || Math.max(...sp.gb) !== 1 || sp.gb.some(v => v < 0 || v > 1) || !mono(sp.t) || !mono(sp.al) || !mono(sp.ph) || sp.id.length < 60 || !['foret', 'prairie', 'bois'].includes(sp.grp)).map(sp => sp.n);
  check('20 espèces complètes et cohérentes (saison, température, altitude, pH, fiche)', SPs.length === 20 && bad.length === 0, bad.join(', '));
  const dup = SPs.map(x => x.n).filter((n, i, a) => a.indexOf(n) !== i);
  check('noms d\'espèces uniques', dup.length === 0, dup.join(', '));
  const z = st.live && w.__fine() ? null : null;
  let nonfin = 0; for (const sp of SPs) { const r = w.__score(sp, { i: 100, lat: 44, lon: 2, alt: 400, so: 'n', fo: 'f', mi: 0, nf: false }, 0); if (!Number.isFinite(r.sc)) nonfin++ }
  check('score fini pour chaque espèce', nonfin === 0, String(nonfin));
  const risky = SPs.filter(sp => /Confusion|Écarter|Toxique|toxique|mortel/.test(sp.id)).length;
  check('mises en garde dans les fiches des espèces à sosies dangereux', risky >= 10, String(risky));

  // espèce toxique : signalée partout, jamais recommandée
  const tox = SPs.filter(sp => sp.toxic), ti = SPs.findIndex(sp => sp.toxic);
  if (tox.length) {
    check('au moins une espèce toxique (bolet de Satan) avec avertissement dans la fiche', tox.length >= 1 && tox.every(sp => /TOXIQUE/.test(sp.id)), tox.map(sp => sp.n).join(','));
    doc.querySelector('#chips button[data-i="' + ti + '"]').click(); await sleep(200);
    check('espèce toxique : puce marquée, bandeau et mention dans la fiche', doc.querySelector('#chips button[data-i="' + ti + '"]').classList.contains('tox') && !$('toxban').hidden && /TOXIQUE/.test(txt('spsuml')) && $('spwarn').hidden);
    w.setPoint(47.0, 4.0, false); await sleep(900);
    check('espèce toxique : avertissement dans le résultat et absente des meilleures espèces', /Espèce toxique/.test(txt('detail')) && !/Bolet de Satan/.test((doc.querySelector('#detail .sphere') || { textContent: '' }).textContent), txt('detail').slice(0, 200));
    doc.querySelector('#chips button[data-i="0"]').click(); await sleep(150);
    check('espèce comestible : bandeau toxique masqué', $('toxban').hidden && !$('spwarn').hidden);
  } else check('aucune espèce toxique au catalogue : mécanisme d\'avertissement inactif', true);

  console.log('Point GPS');
  w.setPoint(44.2, -0.9, false); await sleep(1200);
  const d = txt('detail');
  check('avis sur le point (niveau, score, comparaison)', /propice/i.test(d) && /Mieux que \d+ %/.test(d), d.slice(0, 160));
  check('calcul détaillé repliable', !!$('detail').querySelector('details.why'));
  check('sol, relief et origine des données indiqués', /Sol/.test(d) && /Relief/.test(d) && /Origine des données/.test(d));
  check('lien partageable (hash e, v, p)', /e=\d/.test(w.location.hash) && /p=44\.2/.test(w.location.hash), w.location.hash);
  w.setPoint(43.6, 1.44, false); await sleep(500);
  check('agglomération : non propice', /Non propice/.test(txt('detail')), txt('detail').slice(0, 120));
  w.setPoint(10, 10, false);
  check('point hors de France métropolitaine ignoré', !st.pt || st.pt.lat !== 10);

  console.log('Interactions');
  const sel = $('mode'); sel.value = 'flat'; sel.dispatchEvent(new w.Event('change')); sel.value = 'dots'; sel.dispatchEvent(new w.Event('change'));
  doc.querySelectorAll('#views button').forEach((b, i) => { if (i === 3) b.click() });
  check('changement de vue pris en compte', st.view === 'hab');
  // surbrillance de l'espèce choisie : une seule puce allumée, et c'est la bonne (les puces sont groupées par habitat)
  let hl = true, detail = '';
  const idxs = [...doc.querySelectorAll('#chips button')].map(b => +b.dataset.i);
  for (const i of idxs) {
    doc.querySelector('#chips button[data-i="' + i + '"]').click(); await sleep(60);
    const on = [...doc.querySelectorAll('#chips button[aria-pressed="true"]')].map(b => +b.dataset.i);
    if (on.length !== 1 || on[0] !== i || st.sp !== i) { hl = false; detail += ' [clic ' + i + ' -> ' + on.join(',') + ']'; }
  }
  check('surbrillance : exactement la puce choisie, pour chaque espèce', hl, detail);
  doc.querySelector('#chips button[data-i="1"]').click(); await sleep(300);
  check('changement d\'espèce pris en compte', st.sp === 1 && /Girolle/.test(txt('spsumn')));
  doc.querySelector('#days button[data-d="3"]').click();
  check('changement de jour pris en compte', st.day === 3);
  check('préférences enregistrées', /"sp":1/.test(w.localStorage.getItem('cm:v1') || ''), String(w.localStorage.getItem('cm:v1')));

  console.log('Courbes de niveau et note sur 5');
  const cn = $('cnv');
  cn.checked = true; cn.dispatchEvent(new w.Event('change')); await sleep(200);
  check('courbes de niveau : couche IGN ELEVATION.CONTOUR.LINE à partir du zoom 11', !!w.__cnv() && /LAYER=ELEVATION\.CONTOUR\.LINE/.test(w.__cnv()._url) && w.__cnv().options.minZoom === 11, w.__cnv() && w.__cnv()._url);
  check('courbes de niveau : indication de zoom affichée sous le zoom 11', !$('cnvnote').hidden && /zoomez/.test($('cnvnote').textContent), $('cnvnote').textContent);
  cn.checked = false; cn.dispatchEvent(new w.Event('change')); await sleep(200);
  check('courbes de niveau retirées', w.__cnv() === null && $('cnvnote').hidden);
  check('service worker : tuiles de courbes de niveau en cache, WMS forêt non intercepté', /ELEVATION\.CONTOUR\.LINE/.test(read('sw.js')) && !/wms-v/.test(read('sw.js')));
  w.setPoint(47.0, 4.0, false); await sleep(900);
  const vs = doc.querySelector('#detail .verdict .stars');
  const lvlOf = +doc.querySelector('#detail .verdict').className.match(/v(\d)/)[1];
  check('note sur 5 dans le verdict, cohérente avec le niveau (' + lvlOf + ' -> ' + (lvlOf + 1) + ')', !!vs && vs.getAttribute('aria-label') === (lvlOf + 1) + ' sur 5' && vs.textContent.length === 5 && vs.textContent.split('★').length - 1 === lvlOf + 1, vs && vs.outerHTML);
  check('note sur 5 dans « Ce qui sort ici »', [...doc.querySelectorAll('#nowl li .sc')].every(x => /^[★☆]{5} /.test(x.textContent)));
  const starsAt = [0, 19, 20, 34, 35, 54, 55, 69, 70, 100].map(v => w.__stars(v)).join();
  check('seuils des étoiles : 1 à 5 selon les niveaux du verdict (20 / 35 / 55 / 70)', starsAt === '1,1,2,2,3,3,4,4,5,5', starsAt);

  console.log('Calques forêt et pH');
  check('pH : couleurs de la rampe (acide, neutre, calcaire)', JSON.stringify([w.phRGB(4), w.phRGB(6.5), w.phRGB(9)]) === JSON.stringify([[179, 88, 6], [247, 247, 247], [84, 39, 136]]), JSON.stringify([w.phRGB(4), w.phRGB(6.5), w.phRGB(9)]));
  for (const k of ['foret', 'ph']) {
    const im = w.calqueImage(k);
    check('calque ' + k + ' : image générée, emprise sur la France, blocs peints', !!im && /^data:image/.test(im.url) && im.bounds[0][0] > 40 && im.bounds[1][0] < 53 && im.bounds[0][1] > -7 && im.bounds[1][1] < 12 && im.n > 20000, im && JSON.stringify(im.bounds) + ' n=' + im.n);
  }
  const cq = $('calque');
  cq.value = 'foret'; cq.dispatchEvent(new w.Event('change')); await sleep(300);
  check('calque forêt : couche ajoutée à la carte et légende affichée', !!doc.querySelector('.leaflet-calque-pane img') && !$('calleg').hidden && /Feuillus/.test($('calleg').textContent));
  cq.value = 'ph'; cq.dispatchEvent(new w.Event('change')); await sleep(300);
  check('calque pH : une seule couche, légende pH', doc.querySelectorAll('.leaflet-calque-pane img').length === 1 && /pH du sol/.test($('calleg').textContent));
  cq.value = ''; cq.dispatchEvent(new w.Event('change')); await sleep(200);
  check('calque retiré : couche et légende disparues', !doc.querySelector('.leaflet-calque-pane img') && $('calleg').hidden);

  console.log('Courbes d\'optimum');
  const cvSvgs = () => doc.querySelectorAll('#spcurves svg.cv');
  check('fiche espèce : 3 graphiques (température, altitude, saison) avec description accessible', cvSvgs().length === 3 && [...cvSvgs()].every(s => (s.getAttribute('aria-label') || '').length > 10));
  w.setPoint(47.0, 4.0, false); await sleep(900);
  check('avec un point : repère « ici » sur température et altitude, mois courant en évidence', doc.querySelectorAll('#spcurves .cv-mk').length === 2 && doc.querySelectorAll('#spcurves .cv-b.now').length === 1, String(doc.querySelectorAll('#spcurves .cv-mk').length));
  check('légendes chiffrées avec la valeur du point', /ici -?\d+ °C \(\d+ %\)/.test(doc.querySelector('#spcurves').textContent) && /ici \d+ m \(\d+ %\)/.test(doc.querySelector('#spcurves').textContent), doc.querySelector('#spcurves').textContent.slice(0, 220));
  const curveSpecies = w.__sp.map(s => s.n);
  const allOk = w.__sp.every(s => s.t.length === 4 && s.al.length === 4 && s.gb.length === 12 && s.t[0] < s.t[3] && s.al[0] < s.al[3]);
  check('20 espèces : paramètres de courbes complets (t, al, gb)', allOk && curveSpecies.length === 20);

  console.log('Ce qui sort ici');
  await sleep(500);
  const nowItems = () => [...doc.querySelectorAll('#nowl li')];
  check('« Ce qui sort ici » : 1 à 5 espèces classées, ou message explicatif', (nowItems().length >= 1 && nowItems().length <= 5) || !$('nowmsg').hidden, String(nowItems().length));
  check('chaque entrée affiche un score sur 100', nowItems().length === 0 || nowItems().every(li => /\d+\/100/.test(li.textContent)));
  if (nowItems().length) {
    const first = nowItems()[0].querySelector('span').textContent, last = nowItems()[nowItems().length - 1], lastName = last.querySelector('span').textContent;
    const order = nowItems().map(li => +li.textContent.match(/(\d+)\/100/)[1]);
    check('classement décroissant sur le score du jour : ' + order.join(' > '), order.every((v, i) => i === 0 || order[i - 1] >= v));
    last.querySelector('button').click(); await sleep(200);
    check('toucher « ' + lastName + ' » sélectionne exactement cette espèce', w.__sp[w.__st.sp].n === lastName, w.__sp[w.__st.sp].n);
  }

  console.log('Mes spots');
  w.prompt = () => 'Coin du chêne';
  w.localStorage.removeItem('cm:spots:v1');
  w.setPoint(47.0, 4.0, false); await sleep(900);
  const spBtn = () => $('actSave');   // l'enregistrement est dans la barre fixe du tiroir
  check('bouton « Enregistrer ce spot » présent dans la barre fixe quand un point est choisi', !$('actions').hidden && /Enregistrer/.test(spBtn().textContent));
  spBtn().click(); await sleep(150);
  const saved = JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]');
  check('spot enregistré avec son nom', saved.length === 1 && saved[0].name === 'Coin du chêne' && saved[0].lat === 47, JSON.stringify(saved));
  const openSpots = () => { $('myspots').open = true; $('myspots').dispatchEvent(new w.Event('toggle')); };
  check('carte « Mes spots » toujours visible, liste vide tant qu\'elle est fermée', !$('myspots').hidden && doc.querySelectorAll('#myspl li').length === 0);
  openSpots(); await sleep(200);
  check('liste « Mes spots » avec 1 entrée une fois ouverte', doc.querySelectorAll('#myspl li').length === 1);
  const fcTxt = doc.querySelector('#myspl li .fc') ? doc.querySelector('#myspl li .fc').textContent : '';
  check('prévision du spot : score du jour sur 100 pour l\'espèce choisie', /\d+\/100 aujourd'hui/.test(fcTxt), fcTxt);
  const nav = doc.querySelector('#myspl li a.btn');
  check('lien « Y aller » vers la navigation avec les coordonnées', !!nav && /destination=47,4/.test(nav.href), nav && nav.href);
  check('lien « Y aller » aussi dans la fiche du point', [...doc.querySelectorAll('#detail .cta a')].some(x => /destination=47,4/.test(x.href)));
  check('le bouton propose de retirer le spot', /retirer/.test(spBtn().textContent));
  // carnet de trouvailles
  doc.querySelector('#myspl li .row button[aria-label^="Noter"]').click();
  const fi = doc.querySelector('#myspl li .finform');
  check('formulaire de trouvaille affiché au toucher du panier', !fi.hidden);
  fi.querySelector('input[type="text"]').value = '2 kg'; fi.querySelector('button').click(); await sleep(150);
  const withFind = JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]')[0];
  check('trouvaille enregistrée (espèce, quantité, date) et affichée', withFind.finds.length === 1 && withFind.finds[0].q === '2 kg' && !!withFind.finds[0].sp && /1 trouvaille/.test(doc.querySelector('#myspl li').textContent), JSON.stringify(withFind.finds));
  // import d'une sauvegarde
  w.spotsImport(new w.File([JSON.stringify({ v: 1, spots: [{ lat: 46, lon: 2, name: 'Import', ts: 1, finds: [] }, { lat: 47, lon: 4, name: 'Doublon' }] })], 's.json')); await sleep(300);
  const after = JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]');
  check('import : spot ajouté, doublon ignoré', after.length === 2 && after.some(x => x.name === 'Import') && !after.some(x => x.name === 'Doublon'), JSON.stringify(after.map(x => x.name)));
  check('liste mise à jour après l\'import (2 entrées)', doc.querySelectorAll('#myspl li').length === 2);
  spBtn().click(); await sleep(150);
  const rest = JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]');
  check('spot retiré depuis la fiche : seul l\'import reste', rest.length === 1 && rest[0].name === 'Import');
  w.localStorage.removeItem('cm:spots:v1'); w.renderMySpots();
  check('aucun spot : message d\'invitation affiché', !$('myspempty').hidden && doc.querySelectorAll('#myspl li').length === 0);

  console.log('Trouvailles et modèle');
  const iso = n => w.__iso(Date.now() - n * 864e5), CB = 'Cèpe de Bordeaux', spt = { lat: 47, lon: 4 };
  const s0 = w.findSnapshot(spt, CB, iso(0)), s10 = w.findSnapshot(spt, CB, iso(10));
  check('instantané du jour : score entier 0-100, 6 facteurs, jour 0', !!s0 && Number.isInteger(s0.sc) && s0.sc >= 0 && s0.sc <= 100 && s0.k === 0 && ['so','fo','al','tf','rf','sf'].every(k => Number.isFinite(s0.f[k])), JSON.stringify(s0));
  const zz = w.makeZone(47, 4);
  check('instantané d\'il y a 10 jours : identique au score du modèle rejoué (jour -10)', !!s10 && s10.k === 10 && s10.sc === Math.round(w.__score(w.__sp[0], zz, -10).sc), JSON.stringify(s10));
  check('rang parmi les 30 jours précédents : vide si trop peu de jours, sinon entre 0 et 100', s10.pct === null || (s10.pct >= 0 && s10.pct <= 100), String(s10.pct));
  check('refus honnête : trop ancienne (80 j), date future, espèce inconnue', w.findSnapshot(spt, CB, iso(80)) === null && w.findSnapshot(spt, CB, iso(-2)) === null && w.findSnapshot(spt, 'Champignon inconnu', iso(0)) === null);
  const mk = scs => scs.map((sc, i) => ({ ts: Date.now() - i * 864e5, d: iso(i), m: { sc, pct: 50 } }));
  check('bilan : sous 8 trouvailles ou 3 jours, aucun verdict', w.calibSummary(mk([60, 70, 80])).verdict === 'insuffisant' && w.calibSummary(mk([60, 70, 80, 60, 70, 80, 60])).verdict === 'insuffisant' && w.calibSummary([...mk([60, 60, 60, 60]), ...mk([60, 60, 60, 60]).map(x => ({ ...x, d: iso(0), ts: Date.now() }))].map(x => ({ ...x, d: iso(0) }))).verdict === 'insuffisant');
  check('bilan : scores élevés -> cohérent, moyens -> prudent, bas -> très prudent', w.calibSummary(mk([60, 70, 80, 65, 72, 58, 90, 61])).verdict === 'coherent' && w.calibSummary(mk([40, 50, 45, 38, 52, 41, 36, 48])).verdict === 'prudent' && w.calibSummary(mk([10, 20, 15, 30, 5, 25, 12, 18])).verdict === 'tresprudent');
  check('bilan : médiane et nombre au niveau « propice » exacts', (r => r.med === 67.5 && r.hi === 7 && r.n === 8)(w.calibSummary(mk([60, 70, 80, 65, 72, 58, 90, 40]))), JSON.stringify(w.calibSummary(mk([60, 70, 80, 65, 72, 58, 90, 40]))));
  // parcours réel : enregistrer un spot, noter une trouvaille datée d'il y a 5 jours
  w.localStorage.removeItem('cm:spots:v1');
  w.setPoint(47.0, 4.0, false); await sleep(900);
  spBtn().click(); await sleep(150);
  $('myspots').open = true; $('myspots').dispatchEvent(new w.Event('toggle')); await sleep(300);
  doc.querySelector('#myspl li .row button[aria-label^="Noter"]').click();
  const ff = doc.querySelector('#myspl li .finform');
  check('formulaire de trouvaille : un champ date, limité à aujourd\'hui', !!ff.querySelector('input[type="date"]') && ff.querySelector('input[type="date"]').max === iso(0) && ff.querySelector('input[type="date"]').value === iso(0));
  ff.querySelector('input[type="date"]').value = iso(5); ff.querySelector('input[type="text"]').value = '1 kg'; ff.querySelector('button').click(); await sleep(200);
  const sv = JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]')[0].finds[0];
  check('trouvaille enregistrée avec sa date réelle et le score du modèle ce jour-là', sv.d === iso(5) && sv.q === '1 kg' && !!sv.m && sv.m.k === 5 && Number.isFinite(sv.m.sc), JSON.stringify(sv));
  const mf = $('myfinds').textContent;
  check('bloc « Trouvailles et modèle » : score du jour de la trouvaille et refus de conclure avec une seule trouvaille', /Modèle ce jour-là : \d+\/100/.test(mf) && /Trop peu de trouvailles pour conclure/.test(mf) && /n'est pas modifié/.test(mf), mf.slice(0, 260));
  // import : date invalide corrigée, score invalide ignoré
  w.spotsImport(new w.File([JSON.stringify({ v: 1, spots: [{ lat: 45, lon: 2, name: 'Imp', ts: 1, finds: [{ ts: 1700000000000, d: 'pas-une-date', sp: CB, q: 'x', m: { sc: 'abc' } }, { ts: 1700000000000, d: '2023-11-14', sp: CB, q: 'y', m: { sc: 61.4, k: 3, n: 30, pct: 80 } }] }] })], 'i.json')); await sleep(300);
  const imp = JSON.parse(w.localStorage.getItem('cm:spots:v1')).find(x => x.name === 'Imp').finds;
  check('import : date invalide remplacée, score invalide ignoré, score valide arrondi et conservé', /^\d{4}-\d{2}-\d{2}$/.test(imp[0].d) && !imp[0].m && imp[1].d === '2023-11-14' && imp[1].m.sc === 61 && imp[1].m.pct === 80, JSON.stringify(imp));
  w.localStorage.removeItem('cm:spots:v1'); w.renderMySpots();

  console.log('Tiroir mobile et actions rapides');
  w.__mq.matches = false; w.applyBounds(); const bDesk = w.__map().options.maxBounds ? w.__map().options.maxBounds.getSouth() : null;
  w.__mq.matches = true; w.setSheet('half'); w.applyBounds(); const bMob = w.__map().options.maxBounds.getSouth(); w.setSheet('full'); const bFull = w.__map().options.maxBounds.getSouth();
  w.__mq.matches = false; w.setSheet('half'); w.applyBounds();
  check('limites de la carte : bureau = France ; mobile = étendues vers le sud de la hauteur du tiroir (plus haut = plus étendu)', Math.abs(bDesk - 40.5) < .01 && bMob < 40.5 - 1 && bFull < bMob, [bDesk, bMob, bFull].join(' / '));
  w.__mq.matches = true; w.placeEmpty(); const hostMob = $('emptymap').parentNode.id; w.setSheet('full'); const legFull = doc.documentElement.dataset.sheet; w.setSheet('half');
  w.__mq.matches = false; w.placeEmpty(); const hostDesk = $('emptymap').parentNode.id;
  check('état vide : dans le tiroir sur mobile, sur la carte sur ordinateur ; légende masquée tiroir plein', hostMob === 'emptyside' && hostDesk === 'mapwrap' && legFull === 'full', [hostMob, hostDesk, legFull].join(' / '));
  check('cadrage de la France : fonction disponible, sans erreur (bureau)', typeof w.franceView === 'function' && (() => { try { w.franceView(false); return true } catch (e) { return false } })());
  const sp = n => w.__sheetPx(n);
  check('snapSheet : cran le plus proche, ou le suivant dans le sens d\'un geste franc', w.snapSheet(sp('half'), 10) === 'half' && w.snapSheet(sp('half'), 90) === 'full' && w.snapSheet(sp('half'), -90) === 'peek' && w.snapSheet(sp('peek'), 90) === 'half' && w.snapSheet(sp('full'), -90) === 'half' && w.snapSheet(sp('full') - 5, 0) === 'full');
  w.setSheet('full');
  check('tiroir plein : 90 % de la hauteur, poignée dépliée', doc.documentElement.style.getPropertyValue('--sheet-h') === Math.round(w.innerHeight * .9) + 'px' && $('grab').getAttribute('aria-expanded') === 'true');
  w.setSheet('peek');
  check('tiroir réduit : 132 px, poignée repliée', doc.documentElement.style.getPropertyValue('--sheet-h') === '132px' && $('grab').getAttribute('aria-expanded') === 'false');
  $('grab').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  check('flèche haut sur la poignée : de réduit à moyen', w.__st.sheet === 'half');
  $('grab').click(); const afterClick1 = w.__st.sheet; $('grab').click();
  check('toucher la poignée : moyen -> plein -> moyen', afterClick1 === 'full' && w.__st.sheet === 'half');
  w.__st.pt = null; w.__st.ptZ = null; w.renderDetail();
  check('sans point choisi : barre d\'actions masquée', $('actions').hidden);
  w.localStorage.removeItem('cm:spots:v1'); const iso0 = iso(0);
  w.setPoint(47.0, 4.0, false); await sleep(900);
  check('avec un point : « Enregistrer ce spot » et « J\'ai trouvé ici » toujours visibles', !$('actions').hidden && /Enregistrer ce spot/.test($('actSave').textContent) && /trouvé ici/.test($('actFind').textContent));
  check('fiche du point : plus de bouton d\'enregistrement, seulement « Y aller »', doc.querySelectorAll('#detail .cta button').length === 0 && !!doc.querySelector('#detail .cta a'));
  $('actFind').click();
  check('« J\'ai trouvé ici » : fenêtre ouverte, 20 espèces, date du jour, espèce courante présélectionnée', !$('findq').hidden && $('fqSp').options.length === 20 && $('fqDate').value === iso0 && $('fqSp').value === w.__sp[w.__st.sp].n, $('fqSp').options.length + ' / ' + $('fqDate').value);
  $('fqSp').value = 'Girolle'; $('fqQty').value = '500 g'; $('fqOk').click(); await sleep(250);
  const sv1 = JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]');
  check('un seul geste : le spot est créé au point avec la trouvaille (espèce, quantité, date, score du modèle)', sv1.length === 1 && sv1[0].finds.length === 1 && sv1[0].finds[0].sp === 'Girolle' && sv1[0].finds[0].q === '500 g' && sv1[0].finds[0].d === iso0 && !!sv1[0].finds[0].m && $('findq').hidden, JSON.stringify(sv1[0]));
  check('la barre indique « Spot enregistré »', /Spot enregistré/.test($('actSave').textContent));
  $('actFind').click(); $('fqQty').value = '2 kg'; $('fqOk').click(); await sleep(250);
  const sv2 = JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]');
  check('seconde trouvaille au même point : même spot, pas de doublon', sv2.length === 1 && sv2[0].finds.length === 2);
  $('actFind').click(); doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  check('Échap ferme la fenêtre sans rien enregistrer', $('findq').hidden && JSON.parse(w.localStorage.getItem('cm:spots:v1'))[0].finds.length === 2);
  $('actSave').click(); await sleep(200);
  check('« Spot enregistré · retirer » retire le spot et la barre revient à « Enregistrer ce spot »', JSON.parse(w.localStorage.getItem('cm:spots:v1') || '[]').length === 0 && /Enregistrer ce spot/.test($('actSave').textContent));
  w.setSheet('half');

  console.log('Vos espèces ici et Conditions ici');
  w.setPoint(47.0, 4.0, false); await sleep(900);
  doc.querySelector('#days button[data-d="0"]').click(); await sleep(300);
  const rowsSp = [...doc.querySelectorAll('#detail .sphere .spr')], scOf = b => +b.querySelector('.spv').textContent;
  check('« Vos espèces ici » : 8 espèces au plus, classées par score décroissant, jamais de toxique', rowsSp.length >= 3 && rowsSp.length <= 8 && rowsSp.every((b, i) => i === 0 || scOf(rowsSp[i - 1]) >= scOf(b)), rowsSp.map(scOf).join('>'));
  check('chaque ligne : nom, mot de niveau, score, jauge avec repère à la bonne position', rowsSp.every(b => b.querySelector('.spn').textContent.length > 2 && ['Très peu propice','Peu propice','Moyennement propice','Propice','Très propice'].includes(b.querySelector('.spl').textContent) && b.querySelector('.spg .mk').style.left === scOf(b) + '%'));
  check('l\'espèce choisie est repérée (aria-current) dans la liste', rowsSp.filter(b => b.getAttribute('aria-current') === 'true').every(b => +b.dataset.i === w.__st.sp));
  const tgt = rowsSp[rowsSp.length - 1];
  tgt.click(); await sleep(400);
  check('toucher une ligne sélectionne cette espèce', w.__st.sp === +tgt.dataset.i, String(w.__st.sp));
  doc.querySelector('#chips button[data-i="0"]').click(); await sleep(400);
  const cc = [...doc.querySelectorAll('#detail .cond .cc')], ccTitle = c => c.querySelector('.cct').textContent;
  check('« Conditions ici » : cartes Température, Humidité du sol, Pluie, Saison', ['Température','Humidité du sol','Saison'].every(t => cc.some(c => ccTitle(c) === t)) && cc.some(c => /^Pluie/.test(ccTitle(c))) && cc.length === 4, cc.map(ccTitle).join('|'));
  const zc = w.__st.ptZ, rc = w.__score(w.__sp[0], zc, 0), tcard = cc.find(c => ccTitle(c) === 'Température');
  check('carte Température : valeur du modèle (' + rc.w.T.toFixed(1) + ' °C), mot cohérent avec le facteur, repère dans la jauge', tcard.querySelector('.ccv').textContent === rc.w.T.toFixed(1).replace('.', ',') + ' °C' && tcard.querySelector('.ccl').textContent === w.lvlWord(rc.tf) && +tcard.querySelector('.mk').style.left.replace('%', '') >= 0 && +tcard.querySelector('.mk').style.left.replace('%', '') <= 100, tcard.textContent);
  check('mots de niveau : Défavorable / Moyen / Favorable aux seuils 0,34 et 0,67', w.lvlWord(0) === 'Défavorable' && w.lvlWord(.33) === 'Défavorable' && w.lvlWord(.34) === 'Moyen' && w.lvlWord(.66) === 'Moyen' && w.lvlWord(.67) === 'Favorable' && w.lvlWord(1) === 'Favorable');
  check('cartes : jauges décoratives (aria-hidden), segments toléré et idéal présents pour la température', cc.every(c => !c.querySelector('.gauge') || c.querySelector('.gauge').getAttribute('aria-hidden') === 'true') && !!tcard.querySelector('.gauge .s1') && !!tcard.querySelector('.gauge .s2'));
  check('pluie : espèce dépendante de la pluie cumulée (cèpe) -> carte « Pluie cumulée » avec sa jauge', cc.some(c => ccTitle(c) === 'Pluie cumulée' && !!c.querySelector('.gauge')));
  doc.querySelector('#chips button[data-i="' + w.__sp.findIndex(s => !s.rr && !s.toxic) + '"]').click(); await sleep(400);
  check('espèce sans dépendance à la pluie cumulée : carte « Pluie récente » informative (sans jauge ni verdict)', [...doc.querySelectorAll('#detail .cond .cc')].some(c => ccTitle(c) === 'Pluie récente' && !c.querySelector('.gauge') && !c.querySelector('.ccl')));
  check('aucun NaN ni undefined dans ces blocs', !/NaN|undefined/.test(doc.querySelector('#detail .cond').textContent + doc.querySelector('#detail .sphere').textContent));
  doc.querySelector('#chips button[data-i="0"]').click(); await sleep(300);

  console.log('Comparateur d\'espèces');
  w.setPoint(47.0, 4.0, false); await sleep(900);
  const cs = () => $('cmpsel');
  check('sélecteur de comparaison présent, sans tableau au départ', !!cs() && !doc.querySelector('#detail .cmpt'));
  cs().value = '1'; cs().dispatchEvent(new w.Event('change')); await sleep(300);
  const heads = [...doc.querySelectorAll('#detail .cmpt thead th')].map(t => t.textContent);
  check('tableau comparatif : 2 espèces, 9 lignes dont la note sur 5', heads.length === 3 && doc.querySelectorAll('#detail .cmpt tbody tr').length === 9 && /Note sur 5/.test(doc.querySelector('#detail .cmpt tbody').textContent), heads.join('|'));
  check('une valeur gagnante surlignée par ligne non égale', doc.querySelectorAll('#detail .cmpt td.win').length >= 1);
  cs().value = '-1'; cs().dispatchEvent(new w.Event('change')); await sleep(300);
  check('comparaison retirée', !doc.querySelector('#detail .cmpt'));

  console.log('Palette daltonisme');
  const cvd = $('cvd'), rootStyle = () => doc.documentElement.style.getPropertyValue('--c4');
  cvd.checked = true; cvd.dispatchEvent(new w.Event('change')); await sleep(300);
  check('palette daltonisme : couleurs de niveau et légende basculent', rootStyle() === 'rgb(65,68,135)' && /rgb\(34,168,132\)/.test(doc.documentElement.style.getPropertyValue('--bargrad')), rootStyle());
  check('palette daltonisme mémorisée', JSON.parse(w.localStorage.getItem('cm:v1')).cvd === true);
  cvd.checked = false; cvd.dispatchEvent(new w.Event('change')); await sleep(300);
  check('retour à la palette standard', rootStyle() === 'rgb(194,23,31)', rootStyle());

  console.log('PWA hors-ligne');
  let man = null; try { man = JSON.parse(read('manifest.webmanifest')) } catch (e) {}
  check('manifeste valide, avec nom, start_url et icônes existantes', !!man && !!man.name && !!man.start_url && man.icons.length >= 2 && man.icons.every(i => fs.existsSync(path.join(ROOT, i.src))), JSON.stringify(man));
  let swOk = true; try { new (require('vm').Script)(read('sw.js')) } catch (e) { swOk = false }
  check('service worker : syntaxe valide et enregistré par la page', swOk && /serviceWorker\.register\("sw\.js"\)/.test(html0));
  const swSrc = read('sw.js');
  check('service worker : précache de la page, du CSS et des scripts', ['index.html', 'style.css', 'species.js', 'app.js'].every(f => swSrc.includes('"' + f + '"') && fs.existsSync(path.join(ROOT, f))));
  check('page : manifeste et icône tactile référencés', /rel="manifest"/.test(html0) && /apple-touch-icon/.test(html0) && fs.existsSync(path.join(ROOT, 'apple-touch-icon.png')));

  console.log('Corrections d\'interface');
  check('coordonnées à la française : ouest en « O », virgule décimale, jamais de signe moins', w.__fmt(44.2, -0.9) === '44,20 °N, 0,90 °O' && w.__fmt(-21.1, 55.5) === '21,10 °S, 55,50 °E' && w.__fmt(47, 4, 4) === '47,0000 °N, 4,0000 °E', [w.__fmt(44.2, -0.9), w.__fmt(-21.1, 55.5)].join(' | '));
  w.setPoint(44.2, -0.9, false); await sleep(900);
  const h2t = doc.querySelector('#detail h2').textContent, subt = (doc.querySelector('#detail .sub') || {}).textContent || '';
  check('titre du point : le lieu d\'abord (ou les coordonnées), coordonnées lisibles, sans « -0.9000°E »', !/-0\.9|°E/.test(h2t + subt) && /0,90 °O/.test(h2t + ' ' + subt), h2t + ' / ' + subt);
  const sparkI = [...doc.querySelectorAll('#detail .spark i')];
  check('barres des 8 jours : 8 barres colorées selon le score (palette) ou grises si peu favorable', sparkI.length === 8 && sparkI.every(i => /background:/.test(i.getAttribute('style'))) && /sur 100/.test(doc.querySelector('#detail .spark').getAttribute('aria-label')));
  const fe = doc.querySelector('#chips');
  Object.defineProperty(fe, 'scrollWidth', { configurable: true, value: 1000 }); Object.defineProperty(fe, 'clientWidth', { configurable: true, value: 300 }); fe.scrollLeft = 0; w.updFade();
  check('fondu de bord : affiché quand la liste déborde à droite', fe.classList.contains('more'));
  fe.scrollLeft = 700; w.updFade();
  check('fondu de bord : retiré en fin de liste', !fe.classList.contains('more'));

  console.log('État vide, fiche repliée, titre');
  check('lieu déjà en phrase (« À 105 km au nord de… ») : jamais de « près de À », en titre comme en ligne', w.__nearT('À 105 km au nord de Clermont-Ferrand') === 'À 105 km au nord de Clermont-Ferrand' && w.__nearI('À 105 km au nord de Clermont-Ferrand') === 'à 105 km au nord de Clermont-Ferrand' && w.__nearI('Secteur Landes') === 'secteur Landes' && w.__nearI('Mont-de-Marsan') === 'près de Mont-de-Marsan' && !/près de (À|Secteur)/.test($('nowwhere').textContent), $('nowwhere').textContent);
  check('titre : « Secteur … » sans « Près de », un nom de lieu avec « Près de »', w.__nearT('Secteur Landes de Gascogne') === 'Secteur Landes de Gascogne' && w.__nearT('Mont-de-Marsan') === 'Près de Mont-de-Marsan');
  check('fiche espèce : rubriques techniques repliées dans « Détails du modèle »', !!doc.querySelector('#spmodel details.mdl') && doc.querySelectorAll('#spmodel dt').length >= 2 && ![...doc.querySelectorAll('#spdl dt')].some(d => /\(modèle\)/.test(d.textContent)) && doc.querySelector('#spmodel details').open === false);
  const em = $('emptymap'), waitAlts = async () => { for (let k = 0; k < 120 && /^Recherche/.test(em.querySelector('.alts') ? em.querySelector('.alts').textContent : 'x'); k++) await sleep(250); };
  w.__st.emptyHide = null; w.renderEmptyMap(Float32Array.from([1, 5, 20]), w.__sp[0]);
  check('état vide : message affiché avec le meilleur score', !em.hidden && /Aucune zone favorable pour Cèpe de Bordeaux/.test(em.textContent) && /Meilleur score en France : 20\/100/.test(em.textContent), em.textContent.slice(0, 160));
  await waitAlts();
  const altBtns = [...em.querySelectorAll('.alts .btn')];
  check('état vide : espèces favorables proposées (cliquables) ou, sinon, message de fin de saison', altBtns.length >= 1 ? altBtns.length <= 3 && altBtns.every(b => / · \d+$/.test(b.textContent)) : /fin de saison/.test(em.textContent), em.querySelector('.alts').textContent.slice(0, 200));
  if (altBtns.length) {
    const nameAlt = altBtns[0].textContent.replace(/ · \d+$/, '');
    altBtns[0].click(); await sleep(400);
    check('toucher une proposition sélectionne cette espèce', w.__sp[w.__st.sp].n === nameAlt, w.__sp[w.__st.sp].n + ' / ' + nameAlt);
    doc.querySelector('#chips button[data-i="0"]').click(); await sleep(300);
  }
  w.__st.emptyHide = null; w.renderEmptyMap(Float32Array.from([1, 50]), w.__sp[0]);
  check('carte non vide (meilleur score 50) : aucun message', em.hidden);
  w.__st.emptyHide = null; w.renderEmptyMap(Float32Array.from([1, 5, 20]), w.__sp[0]);
  em.querySelector('.x').click();
  check('message masquable', em.hidden);
  w.renderEmptyMap(Float32Array.from([1, 5, 20]), w.__sp[0]);
  check('message masqué : ne revient pas tant que espèce, vue et jour ne changent pas', em.hidden);
  w.__st.emptyHide = null; w.renderEmptyMap(Float32Array.from([1, 5, 20]), w.__sp[0]);
  w.setPoint(47.0, 4.0, false); await sleep(300);
  check('toucher un point masque le message (il gênerait la carte)', em.hidden);
  w.renderEmptyMap(Float32Array.from([1, 5, 20]), w.__sp[1]);   // autre espèce : l'ancienne fermeture ne s'applique plus
  w.renderEmptyMap(Float32Array.from([1, 5, 20]), w.__sp[0]);
  check('retour à l\'état initial après un détour : le message réapparaît (la fermeture n\'est pas permanente)', !em.hidden && /Cèpe de Bordeaux/.test(em.textContent));
  w.__st.emptyHide = null;

  console.log('Icônes d\'arbres hôtes');
  const HT = w.__hotes, TI = w.__trees, catNames = w.__sp.map(s => s.n);
  check('chaque espèce du catalogue a ses arbres hôtes, et seulement elles', catNames.every(n => HT[n] && HT[n].length >= 1) && Object.keys(HT).every(n => catNames.includes(n)), catNames.filter(n => !HT[n]).join());
  check('chaque clé d\'arbre utilisée a une icône, un nom et une catégorie connue', Object.values(HT).flat().every(k => TI[k] && TI[k].t && TI[k].s && 'fcwh'.includes(TI[k].c)), Object.values(HT).flat().filter(k => !TI[k]).join());
  check('chaque icône est un dessin SVG non vide', Object.values(TI).every(i => /<(path|circle|ellipse|rect)/.test(i.s)));
  const svgPairs = Object.entries(TI).filter(([k]) => k !== 'coniferes'), dupIcons = svgPairs.filter(([k, v], i) => svgPairs.some(([k2, v2], j) => j < i && v2.s === v.s)).map(([k]) => k);
  check('silhouettes toutes distinctes (feuille propre à chaque arbre ; conifères = épicéa)', dupIcons.length === 0 && TI.coniferes.s === TI.epicea.s, dupIcons.join());
  check('feuilles : un tracé rempli par feuille, aiguilles en traits pour les résineux', ['chene','hetre','chataignier','charme','orme','peuplier','saule','verger','feuillus','frene','herbe'].every(k => /<path d="M/.test(TI[k].s) && !/class="nd"/.test(TI[k].s)) && ['epicea','sapin','pin'].every(k => /class="nd"/.test(TI[k].s)));
  const hostPick = async n => { doc.querySelector('#chips button[data-i="' + catNames.indexOf(n) + '"]').click(); await sleep(250); };
  await hostPick('Cèpe de Bordeaux');
  const chips = [...doc.querySelectorAll('#spdl .trees .tree')];
  check('Cèpe de Bordeaux : 5 puces (hêtre, chêne, châtaignier, épicéa, pin), icône + nom écrit', chips.length === 5 && chips.every(c => c.querySelector('svg') && c.textContent.trim().length > 2) && chips.map(c => c.textContent.trim()).join('|') === 'Hêtre|Chêne|Châtaignier|Épicéa|Pin', chips.map(c => c.textContent.trim()).join('|'));
  check('accessibilité : un seul libellé global pour les lecteurs d\'écran, icônes décoratives', /Arbres hôtes ou appréciés : Hêtre, Chêne, Châtaignier, Épicéa, Pin/.test(doc.querySelector('#spdl .trees').getAttribute('aria-label')) && chips.every(c => c.getAttribute('aria-hidden') === 'true'));
  check('le texte détaillé des arbres hôtes reste affiché sous les icônes', /Hêtre, chênes, châtaignier/.test(doc.querySelector('#spdl .hnote').textContent));
  await hostPick('Coulemelle');
  check('espèce saprophyte (coulemelle) : milieu « Prairie, pelouse » avec le texte « Aucun (saprophyte) »', /Prairie, pelouse/.test(doc.querySelector('#spdl .trees').textContent) && /saprophyte/.test(doc.querySelector('#spdl .hnote').textContent));
  await hostPick(catNames[0]);

  console.log('Pluie des 14 derniers jours');
  w.setPoint(47.0, 4.0, false); await sleep(900);
  doc.querySelector('#days button[data-d="0"]').click(); await sleep(400);   // des tests précédents laissent un autre jour sélectionné
  const rainBars = () => doc.querySelectorAll('#detail .rain rect.rn-b');
  check('graphique de pluie : 14 barres, description accessible', rainBars().length === 14 && /cumul observé/.test(doc.querySelector('#detail .rain svg').getAttribute('aria-label')));
  const zr = w.__st.ptZ, Lr = zr.L || w.__st.live[zr.i], er = Math.min((Lr.off != null ? Lr.off : w.__st.off) + 0, Lr.p.length - 1);
  let expTot = 0; for (let k = er - 13; k <= er; k++) expTot += Math.max(0, Lr.p[k] || 0);
  const capTxt = doc.querySelector('#detail .rain .cap').textContent, shownTot = +capTxt.match(/jours : (\d+) mm/)[1];
  check('cumul affiché = somme réelle des 14 jours de la série (' + Math.round(expTot) + ' mm)', shownTot === Math.round(expTot), capTxt);
  check('dernière pluie indiquée, sans barre de prévision à la date du jour', /dernière pluie|aucune pluie/.test(capTxt) && doc.querySelectorAll('#detail .rain rect.f').length === 0, capTxt);
  doc.querySelector('#days button[data-d="3"]').click(); await sleep(400);
  check('jour futur : 3 barres claires de prévision, cumul sur les jours observés seulement', doc.querySelectorAll('#detail .rain rect.f').length === 3 && /Cumul observé sur 11 jours/.test(doc.querySelector('#detail .rain .cap').textContent) && /barres claires/.test(doc.querySelector('#detail .rain .cap').textContent), doc.querySelector('#detail .rain .cap').textContent);
  doc.querySelector('#days button[data-d="0"]').click(); await sleep(400);
  check('retour au jour même : 14 jours observés', /Cumul observé sur 14 jours/.test(doc.querySelector('#detail .rain .cap').textContent));
  check('pluie sans NaN ni undefined', !/NaN|undefined/.test(doc.querySelector('#detail .rain').textContent + doc.querySelector('#detail .rain svg').outerHTML));

  console.log('Sosies dangereux');
  const SOS = w.__sos, SRC = w.__src, spNames = w.__sp.map(s => s.n), sosAll = Object.values(SOS).flat();
  check('chaque entrée de SOSIES vise une espèce du catalogue', Object.keys(SOS).every(k => spNames.includes(k)), Object.keys(SOS).filter(k => !spNames.includes(k)).join());
  check('chaque sosie : nom, gravité valide, texte explicatif, au moins une source connue', sosAll.every(x => x.n && ['mortel', 'toxique', 'nc'].includes(x.g) && x.c.length > 20 && x.s.length >= 1 && x.s.every(k => SRC[k])));
  check('chaque source : titre et adresse https', Object.values(SRC).every(s => s.t && /^https:\/\//.test(s.u)));
  const usedSrc = new Set([...sosAll.flatMap(x => x.s), 'anses', 'pqd']);
  check('aucune source orpheline (toutes servent)', Object.keys(SRC).every(k => usedSrc.has(k)), Object.keys(SRC).filter(k => !usedSrc.has(k)).join());
  const pick = async n => { doc.querySelector('#chips button[data-i="' + spNames.indexOf(n) + '"]').click(); await sleep(250); };
  await pick('Girolle');
  check('Girolle : clitocybe de l\'olivier, badge toxique, sources cliquables sécurisées', /Clitocybe de l'olivier/.test($('spsos').textContent) && !!doc.querySelector('#spsos .grav.g-toxique') && [...doc.querySelectorAll('#spsos .sosl a')].every(a => a.rel === 'noopener' && a.target === '_blank' && /^https:/.test(a.href)) && doc.querySelectorAll('#spsos .sosl a').length >= 1);
  await pick('Coulemelle');
  check('Coulemelle : amanite phalloïde signalée comme mortelle, avec le critère de la volve', !!doc.querySelector('#spsos .grav.g-mortel') && /Amanite phalloïde/.test($('spsos').textContent) && /volve/.test($('spsos').textContent));
  await pick('Langue de bœuf');
  check('espèce non documentée : aucun faux « pas de sosie », message de prudence', /Aucun sosie renseigné/.test($('spsos').textContent) && /ne veut pas dire qu'il n'en existe pas/.test($('spsos').textContent) && !doc.querySelector('#spsos .sosl'));
  check('avertissement permanent dans chaque fiche : contrôle de la récolte, applications, 15', /pharmacien|association mycologique/.test($('spsos').textContent) && /applications de reconnaissance/.test($('spsos').textContent) && /15/.test($('spsos').textContent));
  check('avertissement permanent sous le résultat d\'un point', /où chercher, pas ce qui est comestible/.test(doc.querySelector('.safenote').textContent));
  await pick(spNames[0]);

  console.log('Voir la veille');
  const dayBtns = () => [...doc.querySelectorAll('#days button')];
  check('9 boutons de jour : Hier, Auj., puis 7 jours à venir', dayBtns().length === 9 && dayBtns()[0].textContent.trim() === 'Hier' && dayBtns()[1].textContent.trim() === 'Auj.' && dayBtns()[0].dataset.d === '-1', dayBtns().map(b => b.textContent.trim()).join('|'));
  w.setPoint(47.0, 4.0, false); await sleep(900);
  dayBtns()[0].click(); await sleep(400);
  check('« Hier » sélectionné (jour -1) et bouton pressé', w.__st.day === -1 && dayBtns()[0].getAttribute('aria-pressed') === 'true');
  const yz = w.__score(w.__sp[0], w.__st.ptZ, -1), tz = w.__score(w.__sp[0], w.__st.ptZ, 0);
  check('score d\'hier calculé sur la météo observée (valeurs finies, température du jour précédent)', isFinite(yz.sc) && yz.sc >= 0 && yz.sc <= 100 && isFinite(yz.w.T) && yz.w.src === 'live', JSON.stringify([yz.sc, yz.w && yz.w.T, yz.w && yz.w.src]));
  const dtxt = doc.querySelector('#detail').textContent + doc.querySelector('#status').textContent;
  check('fiche du point et statut sans NaN ni undefined, avec la mention « Hier »', !/NaN|undefined/.test(dtxt) && /Hier : conditions observées/.test(doc.querySelector('#status').textContent), dtxt.slice(0, 160));
  dayBtns()[1].click(); await sleep(400);
  check('retour à aujourd\'hui', w.__st.day === 0 && dayBtns()[1].getAttribute('aria-pressed') === 'true' && !/Hier : conditions/.test(doc.querySelector('#status').textContent));

  console.log('Vue « Toutes les espèces »');
  {
  const vbtn = k => [...doc.querySelectorAll('#views button')].find(b => b.dataset.v === k);
  const waitAll = async () => { for (let k = 0; k < 400 && !(w.__st.allCache && w.__st.allCache.key === [w.__st.fetchedAt, w.__st.dataDate, Math.max(-1, w.__st.day), w.__st.rain, w.__st.dt, w.__st.live ? 1 : 0].join('|')); k++) await sleep(250); };
  check('5 vues, « Toutes les espèces » en dernier (les positions des autres boutons ne changent pas)', [...doc.querySelectorAll('#views button')].map(b => b.dataset.v).join() === 'day,dur,best,hab,all' && vbtn('all').textContent === 'Toutes les espèces');
  vbtn('all').click(); await sleep(60);
  check('calcul lancé en arrière-plan (ou déjà terminé), sans figer la page', !!w.__st.allJob || !!w.__st.allCache);
  await waitAll();
  const AC = w.__st.allCache, Zs = w.__Z(), d0 = Math.max(-1, w.__st.day);
  check('résultat : un score 0-100 par maille, tableau de la taille de la grille', !!AC && AC.sc.length === Zs.length && AC.best.length === Zs.length && Zs.every((z, i) => z.i === i) && Array.from(AC.sc).every(v => v >= 0 && v <= 100), AC && AC.sc.length + ' / ' + Zs.length);
  const idxs = [0, Math.floor(Zs.length / 3), Math.floor(2 * Zs.length / 3), Zs.length - 1], nonTox = w.__sp.map((s, i) => [s, i]).filter(x => !x[0].toxic);
  const okIdx = idxs.every(i => { const z = Zs[i]; let m = 0, b = -1; if (!z.anth) for (const [s, k] of nonTox) { const v = w.__score(s, z, d0).sc; if (v > m) { m = v; b = k } } return AC.sc[i] === m && AC.best[i] === b; });
  check('vérification indépendante sur 4 mailles : score = maximum des espèces, espèce gagnante exacte', okIdx);
  check('champ de la carte construit, mailles triées, statut redevenu normal, sélecteur de jour visible', !!w.__st.F && w.__st.scoreSorted.length === Zs.length && w.__st.scoreSorted[Zs.length - 1] === Math.max(...AC.sc) && /grille de/.test($('status').textContent) && $('days').closest('.ctlrow').style.display === '');
  w.__st.emptyHide = null; w.renderEmptyMap(Float32Array.from([1, 5, 20]), w.__sp[0]);
  check('vue « toutes » sans zone favorable : message adapté, sans proposition d\'autre espèce', !em.hidden && /toutes espèces confondues/.test(em.textContent) && !em.querySelector('.alts'), em.textContent.slice(0, 160));
  w.__st.emptyHide = null; w.renderEmptyMap(Float32Array.from([1, 50]), w.__sp[0]);
  w.setPoint(47.0, 4.0, false); await sleep(900);
  const dTxt = doc.querySelector('#detail').textContent;
  check('fiche d\'un point en vue « toutes » : verdict de l\'espèce choisie, sans rang trompeur « sur cette vue »', /propice/i.test(dTxt) && !/sur cette vue/.test(dTxt));
  const keyBefore = w.__st.allCache.key;
  doc.querySelector('#days button[data-d="2"]').click(); await sleep(80);
  check('changer de jour invalide le cache et relance un calcul', !!w.__st.allJob && w.__st.allJob.key !== keyBefore);
  await waitAll();
  check('nouveau cache prêt pour le nouveau jour', w.__st.allCache.key !== keyBefore && !w.__st.allJob);
  doc.querySelector('#days button[data-d="3"]').click(); await sleep(80);
  vbtn('dur').click(); await sleep(400);
  check('quitter la vue pendant le calcul : calcul abandonné, vue « Zones durables » rétablie', w.__st.view === 'dur' && !w.__st.allJob && /grille de/.test($('status').textContent));
  doc.querySelector('#days button[data-d="0"]').click(); await sleep(300);
  }

  console.log('Erreurs JavaScript');
  check('aucune erreur dans la console', errors.length === 0, errors.join(' || '));
  console.log(fails.length ? '\n' + fails.length + ' échec(s)' : '\nTout est vert.');
  process.exit(fails.length ? 1 : 0);
})();
