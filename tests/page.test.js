// Test de la page complète dans un navigateur simulé (jsdom) avec les vraies données du dépôt.
// Réseau simulé : Wikipédia, Open-Meteo, IGN, SoilGrids. Usage : npm test   (code de sortie 1 au moindre échec)
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const errors = [], fails = [];
const check = (nom, ok, detail = '') => { console.log((ok ? '  ok   ' : '  ÉCHEC ') + nom + (ok ? '' : '  ' + detail)); if (!ok) fails.push(nom); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let html = read('index.html')
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
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
w.addEventListener('error', e => errors.push('window.error: ' + e.message + ' @' + e.lineno));
try { w.eval(scripts[scripts.length - 1] + '\n;window.__st=st;window.__fine=()=>FINE;') } catch (e) { errors.push('eval: ' + e.stack.split('\n').slice(0, 4).join(' | ')) }

(async () => {
  const doc = w.document, $ = id => doc.getElementById(id), txt = id => ($(id).textContent || '').replace(/\s+/g, ' ');
  await sleep(3000);
  const st = w.__st;
  console.log('Chargement');
  check('données quotidiennes chargées (2400+ mailles)', st.live && st.live.length > 2400, String(st.live && st.live.length));
  check('forêt fine chargée', !!w.__fine());
  check('bandeau de fraîcheur affiché', /Météo réelle|anciennes/.test(txt('status')), txt('status'));
  check('9 espèces proposées', doc.querySelectorAll('#chips button').length === 9);
  check('4 vues proposées', doc.querySelectorAll('#views button').length === 4);
  check('8 jours proposés', doc.querySelectorAll('#days button').length === 8);
  check('rayon limité à 100 km', $('rad').max === '100');
  check('nuage de points tracé', (w.__arcs || 0) > 100, String(w.__arcs));
  check('état vide : invitation à toucher la carte', /Touchez la carte/.test(txt('detail')) && !!$('ctabest'));
  check('fiche espèce : nom, latin, rubriques', txt('spsumn').length > 3 && txt('splat').length > 3 && $('spdl').querySelectorAll('dt').length >= 7);
  check('fiche espèce : photo et crédit', /Auteur Test/.test(txt('spcap')) && /500px/.test($('spimg').src));
  check('légende sur la carte', !!$('maplegend') && !!$('legbody'));

  console.log('Point GPS');
  w.setPoint(44.2, -0.9, false); await sleep(1200);
  const d = txt('detail');
  check('avis sur le point (niveau, score, comparaison)', /propice/i.test(d) && /Mieux que \d+ %/.test(d), d.slice(0, 160));
  check('calcul détaillé repliable', !!$('detail').querySelector('details.why'));
  check('sol, relief et origine des données indiqués', /Sol/.test(d) && /Relief/.test(d) && /Origine des données/.test(d));
  check('lien partageable (hash e, v, p)', /e=\d/.test(w.location.hash) && /p=44\.2/.test(w.location.hash), w.location.hash);
  w.setPoint(43.6, 1.44, false); await sleep(500);
  check('agglomération : non propice', /Non propice/.test(txt('detail')), txt('detail').slice(0, 120));
  $('gps').value = '10, 10'; w.gpsFromInput();
  check('coordonnées hors de France refusées', /hors de la France/.test(txt('gpsmsg')));
  $('gps').value = '48.85, 2.35'; w.gpsFromInput(); await sleep(300);
  check('saisie de coordonnées acceptée', st.pt && Math.abs(st.pt.lat - 48.85) < 1e-6);

  console.log('Interactions');
  const sel = $('mode'); sel.value = 'flat'; sel.dispatchEvent(new w.Event('change')); sel.value = 'dots'; sel.dispatchEvent(new w.Event('change'));
  doc.querySelectorAll('#views button').forEach((b, i) => { if (i === 3) b.click() });
  check('changement de vue pris en compte', st.view === 'hab');
  doc.querySelectorAll('#chips button')[1].click(); await sleep(300);
  check('changement d\'espèce pris en compte', st.sp === 1 && /Girolle/.test(txt('spsumn')));
  doc.querySelectorAll('#days button')[3].click();
  check('changement de jour pris en compte', st.day === 3);
  check('préférences enregistrées', /"sp":1/.test(w.localStorage.getItem('cm:v1') || ''), String(w.localStorage.getItem('cm:v1')));

  console.log('Erreurs JavaScript');
  check('aucune erreur dans la console', errors.length === 0, errors.join(' || '));
  console.log(fails.length ? '\n' + fails.length + ' échec(s)' : '\nTout est vert.');
  process.exit(fails.length ? 1 : 0);
})();
