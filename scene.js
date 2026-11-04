/* ════════════════════════════════════════════════════════════════════
   OSB CORPORATION — la pièce
   Une chambre-bureau vue comme une maison de poupée : chaque création
   est un objet de la pièce (l'ordi, la platine, le globe, le panier de
   Talya, le pupitre de quiz, la cible, le carton). On passe de l'un à l'autre
   à la molette, au doigt ou aux flèches ; un clic sur l'objet l'ouvre.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from './vendor/three.min.js';   // three.js compacté (vendor/three.min.js, refait avec esbuild depuis three.module.js)

/* où se trouve chaque objet dans la pièce, et d'où on le regarde
   pos : position au sol · face : direction vers laquelle il est tourné (radians)
   vue : [recul, hauteur de l'œil, hauteur du regard] */
const PLACES = {
  ordi:       { pos: [-2.6, 0, -3.35], face: 0,            vue: [2.3, 1.55, 1.05] },
  platine:    { pos: [1.9, 0, -3.5],   face: 0,            vue: [2.2, 1.5, .95] },
  globe:      { pos: [-4.1, 0, -.7],   face: Math.PI / 2,  vue: [2.3, 1.55, 1.1] },
  talya:      { pos: [3.1, 0, 1.1],    face: -2.4,         vue: [2.4, 1.35, .35] },
  quiz:       { pos: [4.5, 0, -1.6],   face: -Math.PI / 2, vue: [2.7, 1.55, 1.15] },
  flechettes: { pos: [-4.92, 0, 1.9],  face: Math.PI / 2,  vue: [2.6, 1.6, 1.55] },
  carton:     { pos: [-1.6, 0, 2.3],   face: .5,           vue: [2.2, 1.45, .35] },
};

export function demarrer({ toile, etapes, surEtape, reduit, decors = {}, surDecor = () => {}, depart = 0, bloque = () => false, surBloque = () => {}, surPret = () => {} }) {
  const N = etapes.length;
  const cliche = new URLSearchParams(location.search).get('cliche');

  /* ─────────── moteur ─────────── */
  const tactile = matchMedia('(pointer: coarse)').matches;
  // sur un téléphone à écran très fin, l'anticrénelage coûte cher pour rien : les pixels sont déjà minuscules
  const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: !(tactile && (devicePixelRatio || 1) >= 2), preserveDrawingBuffer: !!cliche, powerPreference: tactile ? 'low-power' : 'default' });
  let qualite = 1;   // baisse toute seule si les images arrivent trop espacées (voir la boucle)
  rendu.shadowMap.enabled = true;
  rendu.shadowMap.type = THREE.PCFShadowMap;
  rendu.shadowMap.autoUpdate = false;   // recalculées ~30 fois par seconde (voir la boucle)
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#15110d');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  // la taille de la pièce suit toujours celle de l'écran. Sur iPhone, la page peut démarrer avant que l'écran ait sa vraie
  // taille (ouverte depuis une appli, barre d'adresse qui bouge) : sans nouvelle mesure, l'image restait écrasée en largeur.
  let tw = 0, th = 0;
  function taille() {
    const w = toile.clientWidth || innerWidth, h = toile.clientHeight || innerHeight;
    if (!w || !h || (w === tw && h === th && !taille.force)) return;
    taille.force = false;
    tw = w; th = h;
    // un écran Retina en plein écran, c'est 5 millions de pixels : on en calcule au plus ~2,3 (1,5 sur téléphone), le reste ne se voit pas
    rendu.setPixelRatio(Math.max(.75, Math.min(devicePixelRatio || 1, 2, Math.sqrt((tactile ? 1.5e6 : 2.3e6) / (w * h))) * qualite));
    rendu.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 66 : 50;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', taille);
  addEventListener('orientationchange', () => setTimeout(taille, 250));
  addEventListener('pageshow', taille);
  if (window.visualViewport) visualViewport.addEventListener('resize', taille);
  if (window.ResizeObserver) new ResizeObserver(taille).observe(toile);
  taille();

  /* ─────────── la lumière : un plafonnier chaud, la nuit par la fenêtre ─────────── */
  scene.add(new THREE.HemisphereLight('#fff1dc', '#5a4632', 0.9));
  const plafonnier = new THREE.SpotLight('#ffd9a8', 60, 14, 1.15, .6, 1.4);
  plafonnier.position.set(0, 3.6, -.3); plafonnier.target.position.set(0, 0, -.5);
  plafonnier.castShadow = true; plafonnier.shadow.mapSize.set(tactile ? 512 : 1024, tactile ? 512 : 1024); plafonnier.shadow.bias = -.0008;
  scene.add(plafonnier, plafonnier.target);
  const nuit = new THREE.DirectionalLight('#8aa4d6', .35); nuit.position.set(-1, 3, -8); scene.add(nuit);

  /* ─────────── la pièce ─────────── */
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, metalness: 0, flatShading: true }, o));
  const boite = (w, h, d, mat, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  // le parquet, lame par lame
  const bois = ['#8a5d3b', '#94643f', '#7f5534', '#9a6b45'].map(c => M(c, { roughness: .75 }));
  for (let i = 0; i < 20; i++) boite(.5, .06, 8.4, bois[i % 4], -4.75 + i * .5, -.03, 0).receiveShadow = true;
  // les murs (sans mur de face ni plafond : on regarde comme dans une maison de poupée)
  const peinture = M('#d8c7a6', { flatShading: false }), plinthe = M('#efe6d3');
  boite(10.2, 3.2, .12, peinture, 0, 1.6, -4.25);
  boite(.12, 3.2, 8.6, peinture, -5.06, 1.6, 0);
  boite(.12, 3.2, 8.6, peinture, 5.06, 1.6, 0);
  boite(10.1, .12, .05, plinthe, 0, .06, -4.17); boite(.05, .12, 8.4, plinthe, -4.98, .06, 0); boite(.05, .12, 8.4, plinthe, 4.98, .06, 0);
  // la fenêtre : la nuit dehors
  const vitre = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), new THREE.MeshBasicMaterial({ map: texteCiel() }));
  vitre.position.set(-.4, 1.85, -4.18); scene.add(vitre);
  const cadre = M('#efe6d3');
  boite(1.66, .08, .1, cadre, -.4, 2.49, -4.15); boite(1.66, .08, .1, cadre, -.4, 1.21, -4.15);
  boite(.08, 1.36, .1, cadre, -1.23, 1.85, -4.15); boite(.08, 1.36, .1, cadre, .43, 1.85, -4.15); boite(.05, 1.2, .06, cadre, -.4, 1.85, -4.14);
  boite(1.8, .06, .25, cadre, -.4, 1.19, -4.05);
  // le tapis
  const tapis = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, .03, 10), M('#7b3b2e', { roughness: 1 }));
  tapis.scale.z = .7; tapis.position.set(.3, .015, -.4); tapis.receiveShadow = true; scene.add(tapis);
  const tapis2 = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, .035, 10), M('#c9a35a', { roughness: 1 }));
  tapis2.scale.z = .7; tapis2.position.set(.3, .02, -.4); tapis2.receiveShadow = true; scene.add(tapis2);
  // une plante, parce qu'il faut bien
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.22, .17, .4, 7), M('#b5603c')); pot.position.set(4.4, .2, -3.7); pot.castShadow = true; scene.add(pot);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(.09, .8, 4), M('#4f7a46')); f.position.set(4.4 + Math.cos(i) * .08, .7, -3.7 + Math.sin(i) * .08);
    f.rotation.set(Math.sin(i * 2) * .5, i, Math.cos(i * 2) * .5); f.castShadow = true; scene.add(f);
  }
  // aux murs : ses images, encadrées
  const chargeur = new THREE.TextureLoader();
  function tableau(url, w, h, x, y, z, ry, { cadre = '#1d1b19', bord = .035, epais = .03, dore = false } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const c = boite(w + bord * 2, h + bord * 2, epais, M(cadre, dore ? { metalness: .55, roughness: .38, flatShading: false } : { roughness: .6 }), 0, 0, 0, g);
    c.castShadow = false;
    const mat = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: .85 });
    // un peu de lumière propre, sinon le haut des murs les avale
    chargeur.load(url, tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; mat.map = mat.emissiveMap = tex; mat.color.set('#ffffff'); mat.emissive.set('#ffffff'); mat.emissiveIntensity = .42; mat.needsUpdate = true; });
    const image = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); image.position.z = epais / 2 + .001; image.receiveShadow = true; g.add(image);
    image.userData.garder = true;   // son image arrive plus tard : on ne la fusionne pas
  }
  tableau('img/murs/chief-keef.jpg', 1.0, .749, 1.9, 1.54, -4.18, 0, { cadre: '#b08a3e', bord: .07, epais: .05, dore: true });   // Chief Keef au jardin d'Éden, au-dessus de la platine
  tableau('img/murs/koi.jpg', .66, .66, -2.6, 2.06, -4.18, 0, { cadre: '#e9e1cf', bord: .05 });                                     // la carpe géante, au-dessus du bureau
  tableau('img/murs/i-love-ugly.jpg', .96, .642, -4.99, 1.86, .62, Math.PI / 2);                                                   // I Love Ugly (Chester Watson), entre le globe et la cible
  tableau('img/murs/evil-dead-2.jpg', .56, .868, 4.99, 1.72, -2.85, -Math.PI / 2, { cadre: '#0e0d0c' });                           // Evil Dead 2, entre la plante et le pupitre de quiz

  meubler(scene, { M, boite });
  tableau('img/murs/seta.jpg', .8, .8, 4.99, 2.2, 2.85, -Math.PI / 2, { cadre: '#e9e1cf', bord: .05 });   // Seta, au-dessus de la télé
  fusionnerDecor(scene);   // (avant d'ajouter les créations : elles, elles bougent)

  /* ─────────── les créations ─────────── */
  const objets = [];
  etapes.forEach((e, k) => {
    if (!k) return;
    const place = PLACES[e.forme];
    const g = new THREE.Group();
    g.position.set(...place.pos); g.rotation.y = place.face;
    scene.add(g);
    const o = FORMES[e.forme](g, { M, boite });
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    objets.push({ k, g, place, selection: surbrillance(g, e.couleur), anime: o.anime || (() => {}), caresser: o.caresser || null, eveil: 0, secousse: 0 });
  });
  // les objets qui ne sont pas (ou plus) une étape restent dans la pièce, en décor
  // (ex. l'ordi allumé sur onsenbranle.fr, sorti de la sélection principale)
  // un décor peut quand même s'ouvrir d'un clic (discret : pas d'étape, pas de fiche)
  const decorsCliquables = [];
  for (const forme of ['ordi']) {
    if (etapes.some(e => e.forme === forme)) continue;
    const place = PLACES[forme], g = new THREE.Group();
    g.position.set(...place.pos); g.rotation.y = place.face; scene.add(g);
    FORMES[forme](g, { M, boite });
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    if (decors[forme]) decorsCliquables.push({ g, decor: decors[forme], selection: surbrillance(g, '#e6dcc2') });
  }

  /* ─────────── la caméra ─────────── */
  let t = 0, cibleT = 0;
  if (cliche) { const i = etapes.findIndex(e => e.id === cliche); if (i >= 0) t = cibleT = i; }
  else if (depart > 0 && depart < N) t = cibleT = depart;   // retour d'une création : on reprend devant son objet
  const souris = new THREE.Vector2();
  const vues = etapes.map((e, k) => {
    if (!k) return { pos: new THREE.Vector3(.5, 3.2, 9.6), regard: new THREE.Vector3(.5, 1.1, -1.2) };
    const p = PLACES[e.forme], [recul, oeil, regard] = p.vue;
    const n = new THREE.Vector3(Math.sin(p.face), 0, Math.cos(p.face));
    const base = new THREE.Vector3(...p.pos);
    return { pos: base.clone().addScaledVector(n, recul).setY(oeil), regard: base.clone().setY(regard) };
  });
  const regard = new THREE.Vector3(), _vers = new THREE.Vector3();
  function placer(temps) {
    const k = Math.floor(t), f = t - k, b = Math.min(N - 1, k + 1);
    const l = f * f * (3 - 2 * f);
    // entre deux objets on recule un peu, comme quelqu'un qui traverse la pièce
    const recul = Math.sin(l * Math.PI) * .35;
    camera.position.lerpVectors(vues[k].pos, vues[b].pos, l);
    regard.lerpVectors(vues[k].regard, vues[b].regard, l);
    const vers = _vers.copy(camera.position).sub(regard).setY(0).normalize();   // (un seul vecteur réutilisé : pas de déchets à chaque image)
    camera.position.addScaledVector(vers, recul * 2).y += recul;
    camera.position.x += souris.x * .18; camera.position.y += souris.y * .1 + Math.sin(temps * .6) * .015;
    camera.lookAt(regard);
  }

  /* ─────────── les commandes ─────────── */
  let repos = null;
  const aller = v => { cibleT = Math.max(0, Math.min(N - 1, v)); clearTimeout(repos); repos = setTimeout(() => { cibleT = Math.round(cibleT); }, 160); };
  addEventListener('wheel', e => { if (document.body.classList.contains('liste')) return; e.preventDefault(); if (bloque()) { surBloque(); return; } aller(cibleT + Math.max(-.6, Math.min(.6, e.deltaY / 500))); }, { passive: false });
  let doigt = null;
  toile.addEventListener('touchstart', e => { doigt = { y: e.touches[0].clientY, x: e.touches[0].clientX, t0: cibleT, bouge: false }; }, { passive: true });
  toile.addEventListener('touchmove', e => {
    if (!doigt) return;
    if (bloque()) { if (!doigt.signale) { doigt.signale = true; surBloque(); } return; }
    const dy = doigt.y - e.touches[0].clientY, dx = doigt.x - e.touches[0].clientX;
    if (Math.hypot(dx, dy) > 8) doigt.bouge = true;
    aller(doigt.t0 + (Math.abs(dy) > Math.abs(dx) ? dy : dx) / 260);
  }, { passive: true });
  toile.addEventListener('touchend', () => { if (doigt && doigt.bouge) aller(Math.round(cibleT)); doigt = null; });
  addEventListener('pointermove', e => souris.set(e.clientX / innerWidth - .5, .5 - e.clientY / innerHeight));

  // cliquer sur un objet : on y va ; s'il est déjà devant nous, on entre.
  // Talya, elle, on la caresse (son jeu reste derrière le bouton « Entrer »)
  const lancer = new THREE.Raycaster();
  const touche = (x, y) => {
    lancer.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
    let mieux = null, d = Infinity;
    for (const o of [...objets, ...decorsCliquables]) { const h = lancer.intersectObject(o.g, true)[0]; if (h && h.distance < d) { d = h.distance; mieux = o; } }
    return mieux;
  };
  toile.addEventListener('click', e => {
    const o = touche(e.clientX, e.clientY); if (!o) return;
    if (o.decor) { surDecor(o.decor); return; }
    if (o.caresser) { if (Math.round(t) !== o.k) aller(o.k); o.caresser(); surEtape(o.k, { caresse: true }); return; }
    if (Math.round(t) !== o.k) { aller(o.k); return; }
    o.secousse = 1; surEtape(o.k, { entrer: true });
  });
  let survol = null, prevu = false;
  toile.addEventListener('pointermove', e => {
    if (prevu || e.pointerType !== 'mouse') return;
    prevu = true;
    requestAnimationFrame(() => { prevu = false; survol = touche(e.clientX, e.clientY); toile.style.cursor = survol ? 'pointer' : ''; });
  });

  /* ─────────── la boucle ─────────── */
  let avant = performance.now(), temps = 0, derniere = -1, enPause = false, flash = 0, verifTaille = 0, derniereOmbre = 0, pret = false;
  // si l'appareil n'arrive plus à suivre, la pièce calcule moins de pixels ; s'il a de la marge longtemps, elle remonte
  let mesures = [], precedente = 0, aise = 0;
  function suivreFluidite(ms) {
    const d = ms - precedente; precedente = ms;
    if (d <= 0 || d > 250 || document.hidden) { mesures.length = 0; return; }
    mesures.push(d); if (mesures.length < 90) return;
    mesures.sort((a, b) => a - b); const med = mesures[45], rapides = mesures[9]; mesures.length = 0;
    // (un appareil bridé à 30 images par seconde donne des images régulières : ce n'est pas une saccade)
    if ((med > 40 || (med > 21 && rapides < 26)) && qualite > .55) { qualite = Math.max(.55, qualite - .15); aise = 0; taille.force = true; taille(); }
    else if (med < 15.5 && qualite < 1 && ++aise >= 4) { qualite = Math.min(1, qualite + .1); aise = 0; taille.force = true; taille(); }
  }
  const voile = document.createElement('div');
  voile.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:#fff4e0;opacity:0;transition:opacity .35s';
  document.body.appendChild(voile);
  function image() {
    if (enPause) return;
    const m = performance.now(), dt = Math.min(.05, (m - avant) / 1000); avant = m; temps += dt;
    t += (cibleT - t) * (reduit ? 1 : 1 - Math.pow(.004, dt));   // un glissé un peu plus long, plus doux
    if (Math.abs(cibleT - t) < .0005) t = cibleT;
    if (++verifTaille % 30 === 0) taille();   // filet de sécurité : deux fois par seconde, on revérifie la taille
    placer(temps);
    const ici = Math.round(t);
    if (ici !== derniere) { derniere = ici; surEtape(ici, {}); }
    for (const o of objets) {
      const actif = Math.abs(t - o.k) < .5 ? 1 : 0;
      o.eveil += (actif - o.eveil) * Math.min(1, dt * 3);
      if (cliche && actif) o.eveil = 1;
      o.secousse = Math.max(0, o.secousse - dt * 1.6);
      o.anime(temps, o.eveil, o.secousse, dt);
    }
    // la sélection : l'objet survolé s'éclaire franchement, celui devant lequel on se trouve à peine ; en douceur (~150 ms)
    for (const o of [...objets, ...decorsCliquables]) {
      const vise = survol === o ? 1 : o.eveil ? o.eveil * .35 : 0;
      o.selection.force.value += (vise - o.selection.force.value) * (reduit ? 1 : Math.min(1, dt * 12));
    }
    if (m - derniereOmbre > 30 || cliche) { derniereOmbre = m; rendu.shadowMap.needsUpdate = true; }
    rendu.render(scene, camera);
    if (!pret) { pret = true; surPret(); }
    if (!cliche) { suivreFluidite(m); requestAnimationFrame(image); }
  }
  if (cliche) {
    // pour les vignettes : on attend que les tableaux soient chargés avant de déclarer l'image prête
    const fin = () => { for (let i = 0; i < 30; i++) { t = cibleT; image(); } document.body.dataset.pret = '1'; };
    for (let i = 0; i < 30; i++) { t = cibleT; image(); }
    let fait = false; const une = () => { if (!fait) { fait = true; setTimeout(fin, 150); } };
    THREE.DefaultLoadingManager.onLoad = une; setTimeout(une, 5000);
  }
  else requestAnimationFrame(image);

  return {
    aller: k => aller(k),
    suivant: () => aller(Math.round(cibleT) + 1),
    precedent: () => aller(Math.round(cibleT) - 1),
    actuelle: () => Math.round(cibleT),
    eclair: () => { voile.style.opacity = '.85'; setTimeout(() => { voile.style.opacity = '0'; }, 380); },
    pause: p => { enPause = p; if (!p) { avant = performance.now(); requestAnimationFrame(image); } },
  };
}

/* ════════════════════════════ le coin salon ════════════════════════════
   Des meubles qui ont vécu : étagères qui débordent, CD qui penchent,
   canapé creusé, console qu'on n'éteint jamais vraiment.
   ═══════════════════════════════════════════════════════════════════════ */
const graine = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const CUBE = new THREE.BoxGeometry(1, 1, 1);

// des centaines de tranches de boîtiers en deux draw calls : un InstancedMesh (+ un pour les étiquettes)
function garnir(parent, L) {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .55, flatShading: true });
  const im = new THREE.InstancedMesh(CUBE, mat, L.length), o = new THREE.Object3D(), c = new THREE.Color();
  L.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z); o.rotation.set(0, 0, it.rz || 0); o.scale.set(it.w, it.h, it.d); o.updateMatrix();
    im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.set(it.c));
  });
  im.frustumCulled = false; im.receiveShadow = true; parent.add(im);
  const B = L.filter(it => it.b && !it.rz);
  if (B.length) {
    const ib = new THREE.InstancedMesh(CUBE, mat, B.length);
    B.forEach((it, i) => {
      o.position.set(it.x, it.y + it.h * .5 - it.h * .14, it.z + it.d / 2 + .002); o.rotation.set(0, 0, 0); o.scale.set(it.w * 1.01, it.h * .2, .004); o.updateMatrix();
      ib.setMatrixAt(i, o.matrix); ib.setColorAt(i, c.set(it.b));
    });
    ib.frustumCulled = false; parent.add(ib);
  }
}

// une bibliothèque : le meuble, et ce qu'il y a dedans, rangé par quelqu'un qui n'a plus le temps de ranger
function etagere(parent, { M, boite }, o) {
  const { l, p, n, pas, item: it, ep = .03, socle = .05 } = o;
  const g = new THREE.Group(); parent.add(g);
  const H = socle + n * pas + ep, bois = M(o.bois, { roughness: .75 });
  boite(ep, H, p, bois, -l / 2 + ep / 2, H / 2, 0, g); boite(ep, H, p, bois, l / 2 - ep / 2, H / 2, 0, g);
  boite(l, H - socle, .012, M(o.fond || '#24180f'), 0, socle + (H - socle) / 2, -p / 2 + .006, g);   // le fond, peint d'une couleur
  for (let k = 0; k <= n; k++) boite(l - 2 * ep, ep, p, bois, 0, socle + ep / 2 + k * pas, 0, g);
  const rnd = graine(o.seed), pick = a => a[Math.floor(rnd() * a.length)];
  const x0 = -l / 2 + ep + .012, x1 = l / 2 - ep - .012, zc = p / 2 - it.p / 2 - .014, L = [];
  for (let k = 0; k < n; k++) {
    const yb = socle + ep + k * pas, debut = L.length;
    const fill = (o.plein || .9) - rnd() * .16, pile = rnd() < .4 ? 2 + Math.floor(rnd() * 4) : 0;
    let lim = x0 + (x1 - x0) * fill; if (pile) lim = Math.min(lim, x1 - it.h - .02);
    let x = x0, run = 0, couleur;
    while (x < lim) {
      if (run-- <= 0) { run = 2 + Math.floor(rnd() * 8); couleur = pick(it.pal); }          // une série, un artiste : même couleur
      const e = it.e * (.85 + rnd() * .35), h = it.h * (rnd() < .07 ? 1.1 : .97 + rnd() * .05);
      if (x + e > lim) break;
      L.push({ x: x + e / 2, y: yb + h / 2, z: zc, w: e * .97, h, d: it.p, c: couleur, b: it.bande && rnd() < .85 ? pick(it.bande) : null });
      x += e; if (rnd() < .04) x += .03 + rnd() * .06;                                       // un trou : quelqu'un a emprunté
    }
    if (L.length > debut && !pile && fill < .93) {                                           // le dernier s'affaisse contre le précédent
      const d = L[L.length - 1], a = -.2; d.rz = a; d.x += Math.sin(-a) * d.h / 2; d.y = yb + Math.cos(a) * d.h / 2; d.b = null;
    }
    for (let i = 0; i < pile; i++) L.push({ x: x1 - it.h / 2 - .004 - rnd() * .01, y: yb + it.e * (i + .5), z: zc, w: it.h * (.96 + rnd() * .04), h: it.e * .98, d: it.p, c: pick(it.pal) });
  }
  garnir(g, L);
  return { g, H };
}

// un petit tas de boîtiers posés à plat
function tas(parent, boite, M, n, w, e, d, x, y, z, pal, seed) {
  const rnd = graine(seed);
  for (let i = 0; i < n; i++) boite(w, e, d, M(pal[Math.floor(rnd() * pal.length)]), x + (rnd() - .5) * .02, y + e * (i + .5), z + (rnd() - .5) * .02, parent).rotation.y = (rnd() - .5) * .35;
}

// une forme aux bords arrondis (coussins, plateaux, enceintes) : un rectangle arrondi extrudé, bords adoucis
function arrondie(w, h, d, r) {
  const b = Math.max(.001, Math.min(r, d / 2 - .001, w / 2 - .001, h / 2 - .001));
  const iw = w - 2 * b, ih = h - 2 * b, rr = Math.max(.0005, Math.min(r * .6, iw / 2 - .0005, ih / 2 - .0005));
  const s = new THREE.Shape();
  s.moveTo(-iw / 2 + rr, -ih / 2); s.lineTo(iw / 2 - rr, -ih / 2); s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + rr);
  s.lineTo(iw / 2, ih / 2 - rr); s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - rr, ih / 2); s.lineTo(-iw / 2 + rr, ih / 2);
  s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - rr); s.lineTo(-iw / 2, -ih / 2 + rr); s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + rr, -ih / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 4 });
  g.center(); return g;
}
function molle(parent, w, h, d, r, mat, x, y, z) {
  const m = new THREE.Mesh(arrondie(w, h, d, r), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
function cylindre(parent, r1, r2, h, n, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}

// l'écran de la télé : l'accueil de la PS5 (Jeux · Multimédia, la rangée de jeux, le jeu choisi en grand sur son illustration)
function ecranConsole() {
  return toileTexte(1024, 576, (x, w, h) => {
    const S = '"Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif';
    const ciel = x.createLinearGradient(0, 0, 0, h); ciel.addColorStop(0, '#1b1440'); ciel.addColorStop(.45, '#7a2f5c'); ciel.addColorStop(.75, '#e2763c'); ciel.addColorStop(1, '#f6c16a');
    x.fillStyle = ciel; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,214,150,.92)'; x.beginPath(); x.arc(w * .72, h * .6, 74, 0, 7); x.fill();
    [['#5a2346', .66, 60], ['#321634', .75, 90], ['#170b1d', .86, 120]].forEach(([c, y0, amp], i) => {
      x.fillStyle = c; x.beginPath(); x.moveTo(0, h);
      for (let X = 0; X <= w; X += 24) x.lineTo(X, h * y0 - Math.sin(X / (140 + i * 60) + i) * amp * .5 - Math.sin(X / 47 + i * 2) * 8);
      x.lineTo(w, h); x.fill();
    });
    const voile = x.createLinearGradient(0, 0, w * .72, 0); voile.addColorStop(0, 'rgba(8,10,24,.88)'); voile.addColorStop(1, 'rgba(8,10,24,0)'); x.fillStyle = voile; x.fillRect(0, 0, w, h);
    const haut = x.createLinearGradient(0, 0, 0, 190); haut.addColorStop(0, 'rgba(8,10,24,.75)'); haut.addColorStop(1, 'rgba(8,10,24,0)'); x.fillStyle = haut; x.fillRect(0, 0, w, 190);
    x.fillStyle = '#fff'; x.font = `700 22px ${S}`; x.fillText('Jeux', 60, 52); x.globalAlpha = .55; x.fillText('Multimédia', 126, 52); x.globalAlpha = 1;
    x.strokeStyle = '#fff'; x.lineWidth = 2.5;
    x.beginPath(); x.arc(w - 250, 44, 9, 0, 7); x.moveTo(w - 243, 51); x.lineTo(w - 235, 59); x.stroke();
    x.beginPath(); x.arc(w - 200, 46, 9, 0, 7); x.stroke(); x.beginPath(); x.arc(w - 200, 46, 3.5, 0, 7); x.stroke();
    x.fillStyle = '#c8572f'; x.beginPath(); x.arc(w - 150, 46, 14, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = `600 20px ${S}`; x.textAlign = 'right'; x.fillText('21:04', w - 60, 53); x.textAlign = 'left';
    const tuiles = [['#2b2f3a', '#16181f', 'biblio'], ['#3f6f8f', '#14293a'], ['#c8572f', '#7b3b2e'], ['#d9a23a', '#8a5a1e'], ['#4f7a46', '#233a22'], ['#6e5a8a', '#2b2140'], ['#1f5fd1', '#0b2f7a', 'store']];
    let X = 60;
    tuiles.forEach(([a, b, type], i) => {
      const sel = i === 1, T = sel ? 128 : 86, Y = sel ? 82 : 92;
      const gr = x.createLinearGradient(X, Y, X + T, Y + T); gr.addColorStop(0, a); gr.addColorStop(1, b);
      x.save(); if (sel) { x.shadowColor = 'rgba(255,255,255,.35)'; x.shadowBlur = 22; } x.fillStyle = gr; arrondi(x, X, Y, T, T, 12); x.fill(); x.restore();
      x.fillStyle = 'rgba(255,255,255,.85)'; x.strokeStyle = '#fff'; x.lineWidth = 3;
      if (type === 'biblio') { for (let k = 0; k < 3; k++) { arrondi(x, X + 24 + k * 14, Y + 26, 9, 34, 2); x.fill(); } }
      else if (type === 'store') { arrondi(x, X + 26, Y + 36, 34, 28, 4); x.stroke(); x.beginPath(); x.arc(X + 43, Y + 36, 9, Math.PI, 0); x.stroke(); }
      else { x.globalAlpha = .3; x.beginPath(); x.arc(X + T * .62, Y + T * .42, T * .22, 0, 7); x.fill(); x.globalAlpha = 1; }
      if (sel) { x.lineWidth = 3.5; arrondi(x, X - 6, Y - 6, T + 12, T + 12, 16); x.stroke(); }
      X += T + (sel ? 22 : 14);
    });
    x.fillStyle = '#fff'; x.font = `800 48px ${S}`; x.fillText('Cite 3 Chinois', 60, 332);
    x.font = `500 18px ${S}`; x.globalAlpha = .72; x.fillText('Dernière partie : hier · Trophées 12/40', 60, 364); x.globalAlpha = 1;
    x.fillStyle = '#fff'; arrondi(x, 60, 392, 150, 50, 25); x.fill();
    x.fillStyle = '#111'; x.font = `700 21px ${S}`; x.fillText('Jouer', 107, 424);
    x.fillStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.arc(250, 417, 25, 0, 7); x.fill();
    x.fillStyle = '#fff'; [240, 250, 260].forEach(cx => { x.beginPath(); x.arc(cx, 417, 2.6, 0, 7); x.fill(); });
    x.fillStyle = 'rgba(255,255,255,.25)'; arrondi(x, 60, 474, 280, 6, 3); x.fill(); x.fillStyle = '#fff'; arrondi(x, 60, 474, 118, 6, 3); x.fill();
    x.font = `500 15px ${S}`; x.globalAlpha = .78; x.fillText('Progression 42 %', 60, 506); x.globalAlpha = 1;
  });
}

// le cannage des portes du meuble télé (le rotin tressé des années 70)
function cannage() {
  return toileTexte(256, 128, (x, w, h) => {
    x.fillStyle = '#d9c08a'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#8a6a3a'; x.lineWidth = 2.2;
    for (let i = -h; i < w + h; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke(); }
    x.fillStyle = 'rgba(60,40,20,.35)'; for (let i = 0; i < w; i += 12) for (let j = 0; j < h; j += 12) { x.beginPath(); x.arc(i + 6, j + 6, 2.2, 0, 7); x.fill(); }
  });
}

function coinTele(g, { M, boite }) {
  const chene = M('#a87447', { roughness: .55 }), noir = M('#121214', { roughness: .35 }), blanc = M('#f1f0ec', { roughness: .35, flatShading: false });
  // le meuble bas : chêne clair, pieds fuselés, deux portes cannées
  molle(g, 1.95, .05, .44, .015, chene, 0, .46, 0);
  boite(1.9, .34, .4, M('#8a5d38', { roughness: .6 }), 0, .27, 0, g);
  const canne = new THREE.MeshStandardMaterial({ map: cannage(), roughness: .8 });
  [-.45, .45].forEach(x => { const p = new THREE.Mesh(new THREE.BoxGeometry(.9, .3, .02), canne); p.position.set(x, .27, .205); p.castShadow = p.receiveShadow = true; g.add(p); boite(.02, .06, .02, M('#d9a23a', { metalness: .6, roughness: .3 }), x + (x < 0 ? .4 : -.4), .27, .222, g); });
  [[-.9, -.16], [.9, -.16], [-.9, .16], [.9, .16]].forEach(([x, z]) => { const p = cylindre(g, .025, .014, .11, 8, M('#3a2416'), x, .055, z); p.rotation.z = x < 0 ? .1 : -.1; });
  // la télé
  boite(.62, .015, .2, noir, 0, .493, -.02, g); boite(.12, .13, .05, noir, 0, .56, -.05, g);
  boite(1.64, .93, .045, noir, 0, 1.1, -.05, g);
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(1.56, .87), new THREE.MeshBasicMaterial({ map: ecranConsole(), toneMapped: false, color: '#d0d0d0' }));
  ecran.position.set(0, 1.1, -.0265); g.add(ecran);
  boite(1.2, .07, .1, M('#18181a', { roughness: .8 }), 0, .52, .11, g);                                            // la barre de son
  // la PS5, debout à droite : deux grandes ailes blanches qui s'évasent en haut, le cœur noir, la lueur bleue
  const ps = new THREE.Group(); ps.position.set(.8, .485, -.02); ps.rotation.y = -.08; g.add(ps);
  const profil = new THREE.Shape();
  profil.moveTo(-.1, 0); profil.lineTo(.1, 0); profil.quadraticCurveTo(.125, .2, .15, .41); profil.quadraticCurveTo(.02, .45, -.135, .405); profil.quadraticCurveTo(-.115, .2, -.1, 0);
  const aile = new THREE.ExtrudeGeometry(profil, { depth: .016, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2, curveSegments: 10 });
  [-1, 1].forEach(c => { const a = new THREE.Mesh(aile, blanc); a.rotation.y = Math.PI / 2; a.position.set(c * .044 - .008, .02, 0); a.castShadow = true; ps.add(a); });
  boite(.07, .38, .2, noir, 0, .21, 0, ps); boite(.13, .02, .2, noir, 0, .01, 0, ps);
  const bleu = new THREE.MeshBasicMaterial({ color: '#58a6ff' });
  [-1, 1].forEach(c => boite(.004, .34, .004, bleu, c * .036, .22, .1, ps));
  // le reflet de l'écran sur le sol et le canapé
  const lueur = new THREE.PointLight('#8a8cff', 1.1, 3.6, 1.6); lueur.position.set(0, 1.05, .7); g.add(lueur);
}

// une manette DualSense : le corps blanc et ses deux poignées, le cœur noir, le grand pavé tactile, la barre lumineuse
function manette(parent, M, boite, x, y, z, ry) {
  const m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  const blanc = M('#f0efeb', { flatShading: false, roughness: .4 }), noir = M('#17171b', { roughness: .5, flatShading: false }), gris = M('#9a9ea8', { roughness: .4, flatShading: false });
  const s = new THREE.Shape();
  s.moveTo(-.07, -.032); s.quadraticCurveTo(0, -.044, .07, -.032); s.quadraticCurveTo(.09, -.02, .087, .02); s.quadraticCurveTo(.092, .072, .07, .08);
  s.quadraticCurveTo(.05, .085, .042, .052); s.quadraticCurveTo(0, .036, -.042, .052); s.quadraticCurveTo(-.05, .085, -.07, .08); s.quadraticCurveTo(-.092, .072, -.087, .02); s.quadraticCurveTo(-.09, -.02, -.07, -.032);
  const corps = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: .018, bevelEnabled: true, bevelThickness: .008, bevelSize: .006, bevelSegments: 3, curveSegments: 6 }), blanc);
  corps.rotation.x = Math.PI / 2; corps.position.y = .026; corps.castShadow = true; m.add(corps);
  molle(m, .1, .014, .05, .006, noir, 0, .03, .022);                                     // le cœur noir, entre les sticks
  molle(m, .064, .008, .032, .004, blanc, 0, .037, -.01);                                // le pavé tactile
  [-1, 1].forEach(c => boite(.003, .003, .03, new THREE.MeshBasicMaterial({ color: '#4d8dff' }), c * .034, .036, -.01, m));
  [-1, 1].forEach(c => { cylindre(m, .009, .01, .012, 10, noir, c * .022, .04, .03); cylindre(m, .0085, .0085, .003, 10, gris, c * .022, .047, .03); });
  boite(.022, .005, .007, gris, -.054, .036, .006, m); boite(.007, .005, .022, gris, -.054, .036, .006, m);   // la croix
  [[.054, -.004], [.054, .016], [.044, .006], [.064, .006]].forEach(([a, b]) => cylindre(m, .0045, .0045, .004, 8, gris, a, .037, b));
  return m;
}

function canapeEtTable(g, { M, boite }) {
  // le canapé : velours moutarde, gros coussins ronds, pieds fuselés ; on a envie de s'y laisser tomber
  const velours = M('#c48a2c', { roughness: .95, flatShading: false }), velours2 = M('#d49d3a', { roughness: .95, flatShading: false }), bois = M('#3a2416', { roughness: .6 });
  const sofa = new THREE.Group(); sofa.position.set(1.75, 0, 2.85); sofa.rotation.y = Math.PI / 2; g.add(sofa);
  [[-.86, -.32], [.86, -.32], [-.86, .32], [.86, .32]].forEach(([x, z]) => cylindre(sofa, .03, .018, .12, 8, bois, x, .06, z));
  molle(sofa, 2.02, .2, .86, .06, velours, 0, .21, 0);
  [-.64, 0, .64].forEach((x, i) => molle(sofa, .63, .17, .72, .08, velours2, x, .38 - (i === 1 ? .015 : 0), .06));
  molle(sofa, 2.02, .52, .22, .09, velours, 0, .58, -.33);
  [-.64, 0, .64].forEach(x => { const c = molle(sofa, .6, .36, .17, .09, velours2, x, .63, -.2); c.rotation.x = -.16; });
  [-.93, .93].forEach(x => molle(sofa, .22, .38, .86, .1, velours, x, .46, 0));
  // des coussins qui ont du caractère : rouille, bleu canard, un imprimé à pois
  const pois = new THREE.MeshStandardMaterial({ roughness: 1, map: toileTexte(128, 128, (x, w, h) => { x.fillStyle = '#efe6d3'; x.fillRect(0, 0, w, h); x.fillStyle = '#c8572f'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(16 + i * 32 + (j % 2) * 16, 16 + j * 32, 8, 0, 7); x.fill(); } }) });
  const c1 = molle(sofa, .4, .4, .14, .07, M('#b5532f', { roughness: 1, flatShading: false }), -.6, .72, -.1); c1.rotation.set(-.2, .2, .1);
  const c2 = molle(sofa, .36, .36, .13, .07, M('#2f5f6a', { roughness: 1, flatShading: false }), .56, .7, -.1); c2.rotation.set(-.18, -.3, -.08);
  const c3 = molle(sofa, .3, .3, .11, .06, pois, .1, .66, -.12); c3.rotation.set(-.15, .05, .2);
  const plaid = boite(.5, .03, .96, M('#8c3a2a', { roughness: 1 }), .9, .67, .02, sofa); plaid.rotation.z = -.08;
  boite(.5, .032, .1, M('#e6dcc2', { roughness: 1 }), .9, .678, .12, sofa).rotation.z = -.08;
  manette(sofa, M, boite, -.1, .465, .2, .5);
  // le tapis du salon : un berbère, losanges noirs sur fond crème, bordure rouille
  const motif = toileTexte(512, 340, (x, w, h) => {
    x.fillStyle = '#efe4cc'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#2b2420'; x.lineWidth = 5;
    for (let i = -3; i < 10; i++) { x.beginPath(); for (let j = 0; j <= 7; j++) { const X = i * 70 + (j % 2) * 35, Y = j * 56 - 10; j ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
    x.fillStyle = '#c8572f'; for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) if ((i + j) % 3 === 0) { x.save(); x.translate(i * 70, 18 + j * 56); x.rotate(Math.PI / 4); x.fillRect(-6, -6, 12, 12); x.restore(); }
    x.strokeStyle = '#c8572f'; x.lineWidth = 14; x.strokeRect(8, 8, w - 16, h - 16);
    x.strokeStyle = '#2b2420'; x.lineWidth = 3; x.strokeRect(22, 22, w - 44, h - 44);
  });
  const tapis = new THREE.Mesh(new THREE.BoxGeometry(3.0, .02, 2.0), new THREE.MeshStandardMaterial({ map: motif, roughness: 1 }));
  tapis.position.set(2.85, .011, 2.85); tapis.receiveShadow = true; g.add(tapis);
  // la table basse : ronde, en chêne, trois pieds écartés ; deux manettes, une tasse, la télécommande, des magazines
  const table = new THREE.Group(); table.position.set(3.2, 0, 2.85); g.add(table);
  const chene = M('#b07a48', { roughness: .55, flatShading: false });
  cylindre(table, .42, .42, .045, 28, chene, 0, .38, 0); cylindre(table, .34, .34, .025, 24, chene, 0, .14, 0);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + .3, p = cylindre(table, .022, .014, .38, 8, bois, Math.cos(a) * .3, .18, Math.sin(a) * .3); p.rotation.set(Math.sin(a) * .1, 0, -Math.cos(a) * .1); }
  manette(table, M, boite, -.16, .405, .1, -.4); manette(table, M, boite, .12, .405, -.15, 2.5);
  cylindre(table, .04, .035, .09, 12, M('#e6dcc2', { flatShading: false }), .25, .448, .16);
  boite(.05, .014, .16, M('#16161a'), .26, .41, -.06, table).rotation.y = .3;
  boite(.2, .012, .26, M('#2f4a5a'), -.22, .408, -.16, table).rotation.y = -.25; boite(.18, .01, .24, M('#c8572f'), -.2, .419, -.15, table).rotation.y = .15;
  // le lampadaire : une lanterne de papier (façon Akari d'Isamu Noguchi) sur trois pieds fins, lumière douce
  const lamp = new THREE.Group(); lamp.position.set(4.45, 0, 4.0); g.add(lamp);
  const fer = M('#1d1c1f', { roughness: .5, metalness: .3 });
  [0, 2.094, 4.188].forEach(a => { const p = cylindre(lamp, .008, .008, .98, 5, fer, Math.cos(a) * .1, .48, Math.sin(a) * .1); p.rotation.set(Math.sin(a) * -.1, 0, Math.cos(a) * .1); });
  cylindre(lamp, .008, .008, .16, 5, fer, 0, 1.0, 0);
  const pts = []; for (let i = 0; i <= 26; i++) { const a = i / 26 * Math.PI, r = Math.sin(a) * .27 * (i % 2 ? .96 : 1.02); pts.push(new THREE.Vector2(Math.max(.03, r), -Math.cos(a) * .44)); }
  const papier = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), new THREE.MeshStandardMaterial({ color: '#f6ead2', emissive: '#ffcf8a', emissiveIntensity: 1.15, roughness: 1, side: THREE.DoubleSide }));
  papier.position.y = 1.5; lamp.add(papier);
  const ampoule = new THREE.PointLight('#ffcf8a', 1.6, 3.6, 1.6); ampoule.position.set(0, 1.5, 0); lamp.add(ampoule);
}

function meubler(scene, { M, boite }) {
  const CD = { h: .13, e: .012, p: .14, pal: ['#1d1c1f', '#e6dcc2', '#c8572f', '#2f4a5a', '#d9a23a', '#7b3b2e', '#4f7a46', '#9a8f78', '#b8473a', '#6e5a8a', '#2a2a30', '#d8d4c8', '#3f6f8f'], bande: ['#efe8d6', '#efe8d6', '#d9d2bd', '#e8c56a'] };
  const DVD = { h: .19, e: .015, p: .135, pal: ['#14141a', '#1b1b22', '#101015', '#23272e', '#16161c', '#1d4f7a', '#143a5e', '#d9a23a', '#7b1f1f', '#e6dcc2', '#2a2420'], bande: ['#f4f1ea', '#f4f1ea', '#e9d7a0', '#c8572f'] };

  // la grande bibliothèque à CD, contre le mur de gauche (celle qui déborde)
  const A = new THREE.Group(); A.position.set(-4.83, 0, -2.35); A.rotation.y = Math.PI / 2; scene.add(A);
  const bib = etagere(A, { M, boite }, { l: 1.3, p: .24, n: 10, pas: .178, item: CD, bois: '#7a5233', fond: '#8c3a2a', seed: 11, plein: .97 });
  tas(bib.g, boite, M, 7, .13, .011, .14, -.25, bib.H, 0, CD.pal, 5);                                                      // une pile qui ne rentrait plus, sur le dessus
  tas(bib.g, boite, M, 4, .13, .011, .14, .1, bib.H, 0, CD.pal, 8);
  const fig = new THREE.Group(); fig.position.set(.42, bib.H, 0); bib.g.add(fig);                                           // une figurine, un souvenir
  const soc = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .02, 8), M('#2a2420')); soc.position.y = .01; fig.add(soc);
  const bon = new THREE.Mesh(new THREE.ConeGeometry(.04, .17, 6), M('#c8572f')); bon.position.y = .105; fig.add(bon);
  const tete = new THREE.Mesh(new THREE.IcosahedronGeometry(.035, 0), M('#e6dcc2')); tete.position.y = .22; fig.add(tete);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(.045, .04, .1, 10), M('#2f4a5a')); mug.position.set(-.5, bib.H + .05, .02); bib.g.add(mug);
  tas(A, boite, M, 9, .13, .011, .14, .2, 0, .5, CD.pal, 21);                                                                // et une pile par terre, parce que
  tas(A, boite, M, 5, .19, .015, .135, -.15, 0, .55, DVD.pal, 22);

  // la tour à CD dans le coin, au fond à gauche
  const T = new THREE.Group(); T.position.set(-4.5, 0, -4.025); scene.add(T);
  const tour = etagere(T, { M, boite }, { l: .46, p: .2, n: 8, pas: .178, item: CD, bois: '#2b2b2e', fond: '#2f5f6a', seed: 37, plein: .98 });
  tas(tour.g, boite, M, 3, .13, .011, .14, 0, tour.H, 0, CD.pal, 3);

  // les DVD et Blu-ray, au fond à droite, à côté de la platine
  const D = new THREE.Group(); D.position.set(3.5, 0, -4.035); scene.add(D);
  const dvd = etagere(D, { M, boite }, { l: 1.2, p: .22, n: 6, pas: .245, item: DVD, bois: '#8a5d38', fond: '#2f5a46', seed: 73, plein: .97 });
  const poste = new THREE.Group(); poste.position.set(-.3, dvd.H, 0); dvd.g.add(poste);                                       // un vieux poste de radio
  boite(.32, .18, .14, M('#7b3b2e', { roughness: .5 }), 0, .09, 0, poste); boite(.1, .1, .01, M('#d8cdb0'), -.08, .09, .075, poste);
  const cad = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .012, 12), M('#d9a23a', { metalness: .5 })); cad.rotation.x = Math.PI / 2; cad.position.set(.09, .09, .075); poste.add(cad);
  tas(dvd.g, boite, M, 5, .19, .015, .135, .3, dvd.H, 0, DVD.pal, 6);
  tas(D, boite, M, 6, .19, .015, .135, 0, 0, .45, DVD.pal, 14);                                                              // des DVD par terre

  // le coin télé : meuble bas, grand écran, PS5, et un tableau au-dessus
  const V = new THREE.Group(); V.position.set(4.745, 0, 2.85); V.rotation.y = -Math.PI / 2; scene.add(V);
  coinTele(V, { M, boite });
  canapeEtTable(scene, { M, boite });

  // une guirlande d'ampoules le long du mur du fond, pour la chaleur (fusionnée avec le décor : presque rien à dessiner)
  const tons = ['#ffd27a', '#ffb06a', '#ffe7a8'].map(c => M(c, { emissive: c, emissiveIntensity: 1.6, roughness: .4, flatShading: false }));
  const fil = [];
  for (let i = 0; i <= 44; i++) {
    const x = -4.9 + i * (9.8 / 44), creux = Math.abs(Math.sin((i / 11) * Math.PI)) * .14, y = 2.98 - creux;
    fil.push(new THREE.Vector3(x, y + .03, -4.16));
    const b = new THREE.Mesh(new THREE.SphereGeometry(.024, 8, 6), tons[i % 3]); b.position.set(x, y, -4.15); b.castShadow = false; scene.add(b);
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fil), new THREE.LineBasicMaterial({ color: '#2a2420' })));
}

/* ═══════════════ le décor fusionné ═══════════════
   Chaque boîte du décor (lames de parquet, planches, CD posés à plat, pieds de table…) était dessinée à part,
   trois fois par image avec les ombres. Ici, tout ce qui ne bouge pas et se ressemble (même couleur, même matière)
   devient un seul objet. Ce qui a une image (tableaux, écrans), ce qui est transparent ou en série (InstancedMesh) reste à part. */
function fusionnerDecor(racine) {
  racine.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(racine.matrixWorld).invert(), _m = new THREE.Matrix4();   // (marche aussi dans un objet déjà placé)
  const lots = new Map(), morts = [];
  const cleDe = m => [m.type, m.color.getHexString(), m.emissive ? m.emissive.getHexString() + m.emissiveIntensity : '', m.roughness, m.metalness, m.flatShading, m.side].join('|');
  racine.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.garder || Array.isArray(o.material)) return;
    for (let p = o.parent; p && p !== racine; p = p.parent) if (p.userData.vivant) return;   // ce qui bouge reste à part
    const m = o.material;
    if (!m.isMeshStandardMaterial || m.map || m.transparent || m.vertexColors || m.userData.garder) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld));
    const cle = cleDe(m) + (m.userData.anime ? m.uuid : '') + (o.castShadow ? '+' : '-') + (o.receiveShadow ? '+' : '-');   // une matière animée garde son lot
    if (!lots.has(cle)) lots.set(cle, { mat: m, geos: [], ombre: o.castShadow, recoit: o.receiveShadow });
    lots.get(cle).geos.push(g); morts.push(o);
  });
  morts.forEach(o => o.parent.remove(o));
  lots.forEach(({ mat, geos, ombre, recoit }) => {
    let n = 0; geos.forEach(x => { n += x.attributes.position.count; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let k = 0;
    geos.forEach(x => { pos.set(x.attributes.position.array, k * 3); nor.set(x.attributes.normal.array, k * 3); k += x.attributes.position.count; x.dispose(); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = ombre; mesh.receiveShadow = recoit; racine.add(mesh);
  });
}

/* ═══════════════ la sélection d'un objet, dessinée par ses matériaux ═══════════════
   Pas de lampe : un liseré de la couleur de la création sur le contour de l'objet (effet de Fresnel),
   et un léger voile sur ses faces. Une seule petite addition dans le shader de chaque matériau :
   ça coûte presque rien, et ça éclaire l'objet, pas le mur derrière. */
function surbrillance(g, couleur) {
  const u = { force: { value: 0 }, couleur: { value: new THREE.Color(couleur) } };
  g.traverse(m => {
    if (!m.isMesh || Array.isArray(m.material)) return;
    let mat = m.material;
    if (mat.userData.selection === u) return;
    if (mat.userData.selection) { mat = mat.clone(); m.material = mat; }   // matériau partagé avec un autre objet : on le double
    mat.userData.selection = u;
    const eclaire = !!(mat.isMeshStandardMaterial || mat.isMeshPhongMaterial || mat.isMeshLambertMaterial);
    mat.onBeforeCompile = sh => {
      sh.uniforms.uSelection = u.force; sh.uniforms.uSelectionCouleur = u.couleur;
      sh.fragmentShader = 'uniform float uSelection;\nuniform vec3 uSelectionCouleur;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        (eclaire
          ? 'float bordSel = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);\noutgoingLight += uSelectionCouleur * uSelection * (0.07 + pow(bordSel, 2.4) * 0.8);\n'
          : 'outgoingLight += uSelectionCouleur * uSelection * 0.1;\n') + '#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => eclaire ? 'selection-eclaire' : 'selection-simple';
    mat.needsUpdate = true;
  });
  return u;
}

/* ════════════════════════════ les objets ════════════════════════════ */
const sansIndex = geo => geo.index ? geo.toNonIndexed() : geo;

// les petites images dessinées à la main (écran, étiquettes, ciel)
function toileTexte(w, h, dessin) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); dessin(x, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // une fois les polices chargées, on redessine proprement
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { x.clearRect(0, 0, w, h); dessin(x, w, h); tex.needsUpdate = true; });
  return tex;
}
// un rectangle aux coins arrondis
function arrondi(x, X, Y, W, H, r) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}
// onsenbranle.fr, en gros : l'en-tête violet, le titre de l'article, le bandeau bleu nuit
function dessinerBlog(x, X, Y, W, H) {
  const P = H * .47, police = (g, t) => `${g} ${Math.round(t)}px "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  x.fillStyle = '#7174cc'; x.fillRect(X, Y, W, P);
  x.fillStyle = '#111'; x.font = police(800, W * .034); x.fillText('En vrai, on s’en branle.', X + W * .035, Y + H * .085);
  x.font = police(400, W * .02); x.fillText('"Bien que j’ai grandi, j’ai su garder un esprit de gosse attardé"', X + W * .035, Y + H * .13);
  x.fillStyle = '#3b0f22'; x.font = police(500, W * .021); x.textAlign = 'right'; x.fillText('« Bien ou quoooi ? »    Fluxxx', X + W * .9, Y + H * .09);
  x.strokeStyle = '#111'; x.lineWidth = Math.max(1, W * .003); x.beginPath(); x.arc(X + W * .955, Y + H * .08, W * .012, 0, 7); x.stroke();
  x.fillStyle = '#0a0a0a'; x.font = police(900, W * .088); x.textAlign = 'center'; x.fillText('« Bien ou quoooi ? »', X + W / 2, Y + H * .35);
  x.fillStyle = '#05062e'; x.fillRect(X, Y + P, W, H - P);
  x.font = police(800, W * .046); x.fillStyle = '#fff'; x.fillText('(dixit le vrai maire de Sevran en', X + W / 2, Y + P + H * .13);
  const a = 'découvrant le ', b = 'logiciel Snapchat', c = ')';
  const la = x.measureText(a).width, lb = x.measureText(b).width, lc = x.measureText(c).width, y2 = Y + P + H * .215;
  let cx = X + W / 2 - (la + lb + lc) / 2; x.textAlign = 'left';
  x.fillText(a, cx, y2); cx += la;
  x.fillStyle = '#ff2056'; x.fillText(b, cx, y2); x.fillRect(cx, y2 + W * .008, lb, Math.max(1.5, W * .004)); cx += lb;
  x.fillStyle = '#fff'; x.fillText(c, cx, y2);
  const dg = x.createLinearGradient(X + W * .08, 0, X + W * .92, 0);
  ['#c3cf3a', '#3fb6d6', '#7fc24a', '#d9da4a', '#9ad0c8'].forEach((col, i) => dg.addColorStop(i / 4, col));
  x.fillStyle = dg; x.fillRect(X + W * .08, Y + H * .84, W * .84, H * .2);
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = Math.max(1.5, W * .005); x.beginPath(); x.moveTo(X + W * .78, Y + H * .97); x.quadraticCurveTo(X + W * .82, Y + H * .87, X + W * .9, Y + H * .86); x.stroke();
  x.textAlign = 'left';
}
function texteCiel() {
  return toileTexte(256, 205, (x, w, h) => {
    const d = x.createLinearGradient(0, 0, 0, h); d.addColorStop(0, '#0c1630'); d.addColorStop(1, '#2a3558'); x.fillStyle = d; x.fillRect(0, 0, w, h);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    x.fillStyle = '#e8e2cf'; for (let i = 0; i < 60; i++) x.fillRect(r() * w, r() * h * .8, r() < .2 ? 2 : 1, r() < .2 ? 2 : 1);
    x.beginPath(); x.arc(w * .75, h * .28, 16, 0, 7); x.fill();
    x.fillStyle = '#0a0f1e'; x.fillRect(0, h * .8, w, h * .2);
    for (let i = 0; i < 9; i++) { const bw = 18 + r() * 24, bh = 14 + r() * 40; x.fillRect(i * 29, h * .8 - bh, bw, bh); x.fillStyle = '#e8c56a'; if (r() < .6) x.fillRect(i * 29 + 5, h * .8 - bh + 6, 3, 4); x.fillStyle = '#0a0f1e'; }
  });
}

const FORMES = {
  // Onsenbranle : le bureau, et dessus le MacBook ; le blog est ouvert, le fond d'écran c'est Sunny (Taiyō Matsumoto)
  ordi(g, { M, boite }) {
    const bois = M('#6b4a32', { roughness: .7 }), metal = M('#2b2b2e', { roughness: .4, metalness: .3 });
    boite(1.7, .06, .8, bois, 0, .76, 0, g);
    [[-.8, -.35], [.8, -.35], [-.8, .35], [.8, .35]].forEach(([x, z]) => boite(.06, .76, .06, bois, x, .38, z, g));
    // le MacBook, au milieu du bureau
    const mac = new THREE.Group(); mac.position.set(-.04, .79, .01); mac.rotation.y = .06; mac.scale.setScalar(1.55); g.add(mac);   // (un peu plus grand)
    const alu = M('#c3c6cc', { roughness: .35, metalness: .45, flatShading: false });
    boite(.46, .016, .32, alu, 0, .008, 0, mac);
    boite(.39, .003, .13, M('#1c1c1f', { roughness: .6 }), 0, .017, -.045, mac);       // le clavier
    boite(.15, .002, .085, M('#b4b7bd', { roughness: .3, metalness: .4 }), 0, .017, .095, mac);   // le trackpad
    const capot = new THREE.Group(); capot.position.set(0, .016, -.158); capot.rotation.x = -.28; mac.add(capot);
    boite(.46, .3, .008, alu, 0, .15, -.004, capot);
    const cadreNoir = new THREE.Mesh(new THREE.PlaneGeometry(.448, .29), new THREE.MeshBasicMaterial({ color: '#0d0d0f' }));
    cadreNoir.position.set(0, .152, .001); capot.add(cadreNoir);
    // l'écran : le bureau du Mac (Sunny en fond), la barre des menus, le Dock, et onsenbranle.fr dans une fenêtre
    const fondEcran = new Image(); fondEcran.src = 'img/fond-sunny.jpg';
    const bureauMac = (x, w, h) => {
      x.fillStyle = '#d9c39a'; x.fillRect(0, 0, w, h);
      if (fondEcran.complete && fondEcran.naturalWidth) x.drawImage(fondEcran, 0, 0, w, h);
      x.fillStyle = 'rgba(244,240,232,.72)'; x.fillRect(0, 0, w, 20);
      x.fillStyle = '#1d1c1a'; x.font = '600 12px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.fillText('Safari', 16, 14);
      x.font = '400 12px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.fillText('Fichier    Édition    Présentation    Historique    Fenêtre', 66, 14);
      // le Dock
      x.fillStyle = 'rgba(255,255,255,.38)'; arrondi(x, w / 2 - 150, h - 46, 300, 40, 12); x.fill();
      ['#3d7bd9', '#e9e4d8', '#4caf50', '#f2b134', '#d94a3d', '#7a5cd6', '#2b2b2e'].forEach((c, i) => { x.fillStyle = c; arrondi(x, w / 2 - 135 + i * 40, h - 40, 30, 30, 8); x.fill(); });
      // la fenêtre du navigateur
      const WX = 372, WY = 52, WW = 624, WH = 488;
      x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 26; x.shadowOffsetY = 8;
      x.fillStyle = '#e9e6e1'; arrondi(x, WX, WY, WW, WH, 10); x.fill(); x.restore();
      ['#ee5f57', '#f5bd2f', '#5fc53f'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(WX + 18 + i * 18, WY + 15, 5.5, 0, 7); x.fill(); });
      x.fillStyle = '#d6d2cc'; arrondi(x, WX + WW / 2 - 120, WY + 6, 240, 19, 6); x.fill();
      x.fillStyle = '#3a3836'; x.font = '400 12px "Helvetica Neue", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('onsenbranle.fr', WX + WW / 2, WY + 20); x.textAlign = 'left';
      x.save(); arrondi(x, WX, WY + 30, WW, WH - 30, 10); x.clip(); dessinerBlog(x, WX, WY + 30, WW, WH - 30); x.restore();
    };
    const page = toileTexte(1024, 640, bureauMac);
    fondEcran.onload = () => { const x = page.image.getContext('2d'); x.clearRect(0, 0, 1024, 640); bureauMac(x, 1024, 640); page.needsUpdate = true; };
    const ecranMac = new THREE.Mesh(new THREE.PlaneGeometry(.416, .26), new THREE.MeshBasicMaterial({ map: page, toneMapped: false, color: '#ececec' }));
    ecranMac.position.set(0, .157, .002); capot.add(ecranMac);
    // la tasse, le carnet
    const tasse = new THREE.Mesh(new THREE.CylinderGeometry(.05, .045, .1, 10), M('#c8572f')); tasse.position.set(.62, .84, .22); g.add(tasse);
    boite(.24, .02, .3, M('#2f4a5a'), -.62, .8, .1, g).rotation.y = .3;
    // la lampe de bureau, au fond à droite, penchée sur le MacBook
    const lampe = new THREE.Group(); lampe.position.set(.74, .79, -.3); lampe.rotation.y = Math.PI * 1.15; g.add(lampe);
    const pied = new THREE.Mesh(new THREE.CylinderGeometry(.08, .09, .03, 10), metal); lampe.add(pied);
    const bras = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .45, 5), metal); bras.position.set(.06, .22, 0); bras.rotation.z = -.3; lampe.add(bras);
    const abat = new THREE.Mesh(new THREE.ConeGeometry(.1, .14, 10, 1, true), M('#d9a23a', { side: THREE.DoubleSide })); abat.position.set(.15, .44, 0); abat.rotation.z = 2.3; lampe.add(abat);
    const ampoule = new THREE.PointLight('#ffcf8a', 1.6, 2, 1.5); ampoule.position.set(.2, .38, 0); lampe.add(ampoule);
    // la chaise
    // un fauteuil de bureau rembourré, orange brûlé, sur cinq roulettes : on s'y enfonce pour créer
    const chaise = new THREE.Group(); chaise.position.set(.1, 0, .8); chaise.rotation.y = .25; g.add(chaise);
    const tissu = M('#d9772b', { roughness: .95, flatShading: false }), fer = M('#232326', { roughness: .4, metalness: .4 });
    for (let i = 0; i < 5; i++) { const a = i * 1.2566; const b = boite(.25, .025, .035, fer, Math.cos(a) * .125, .055, Math.sin(a) * .125, chaise); b.rotation.y = -a; cylindre(chaise, .022, .022, .03, 8, fer, Math.cos(a) * .25, .022, Math.sin(a) * .25).rotation.x = Math.PI / 2; }
    cylindre(chaise, .025, .03, .3, 8, fer, 0, .22, 0);
    molle(chaise, .54, .11, .5, .05, tissu, 0, .43, 0);
    const dossier = molle(chaise, .52, .58, .12, .07, tissu, 0, .8, .24); dossier.rotation.x = .12;
    [-1, 1].forEach(c => { cylindre(chaise, .012, .012, .16, 6, fer, c * .27, .54, .02); molle(chaise, .07, .05, .3, .025, M('#2b2b2e', { flatShading: false }), c * .27, .63, .02); });
    const coussinDos = molle(chaise, .34, .2, .08, .04, M('#2f5f6a', { roughness: 1, flatShading: false }), 0, .66, .17); coussinDos.rotation.x = .15;
    // le bureau qui donne envie : un sous-main vert, un pot de crayons, un petit cactus, des post-it au mur
    boite(.9, .006, .46, M('#2f5a46', { roughness: 1 }), -.04, .793, .03, g);
    const pot = cylindre(g, .04, .036, .1, 10, M('#e6dcc2', { flatShading: false }), .5, .84, -.22);
    ['#c8572f', '#d9a23a', '#2f5f6a', '#4f7a46'].forEach((c, i) => { const cr = cylindre(g, .006, .006, .16, 5, M(c), .5 + Math.cos(i * 1.6) * .015, .9, -.22 + Math.sin(i * 1.6) * .015); cr.rotation.set(Math.sin(i) * .15, 0, Math.cos(i * 2) * .15); });
    cylindre(g, .05, .04, .07, 8, M('#b5603c'), -.66, .825, -.25); const cactus = cylindre(g, .028, .03, .14, 8, M('#5f8f4e'), -.66, .93, -.25); cactus.scale.z = .9;
    [['#ffd75e', -.55, 1.18, .1], ['#ff9ec4', -.42, 1.26, -.08], ['#8fd3ff', -.3, 1.14, .14], ['#b9f28a', .38, 1.22, -.1], ['#ffd75e', .52, 1.12, .06]].forEach(([c, x, y, r]) => { const n = boite(.1, .1, .004, M(c, { roughness: 1 }), x, y, -.836, g); n.rotation.z = r; });
    fusionnerDecor(g);   // le bureau ne bouge pas : un seul dessin par matière
    return { anime(temps, eveil) { ampoule.intensity = 1.2 + eveil * .8; } };
  },

  // Music Discovery : une vraie chaîne de mélomane, sur une enfilade en noyer des années 60
  platine(g, { M, boite }) {
    const noyer = M('#6e4527', { roughness: .5, flatShading: false }), noyerF = M('#5a3820', { roughness: .6 }), laiton = M('#c9a25a', { metalness: .7, roughness: .3, flatShading: false });
    const alu = M('#c9cbd0', { metalness: .6, roughness: .3, flatShading: false }), noir = M('#17161a', { roughness: .45 });
    molle(g, 1.72, .05, .52, .02, noyer, 0, .6, 0);                                        // le plateau
    boite(.83, .48, .46, noyerF, .415, .35, 0, g);                                       // le caisson (à droite, fermé par les lattes)
    boite(.83, .48, .02, noyerF, -.415, .35, -.22, g); boite(.83, .03, .46, noyerF, -.415, .125, 0, g); boite(.03, .48, .46, noyerF, -.815, .35, 0, g);   // à gauche, la case ouverte
    [[-.78, -.19], [.78, -.19], [-.78, .19], [.78, .19]].forEach(([x, z]) => { const p = cylindre(g, .024, .013, .12, 8, M('#3a2416'), x, .06, z); p.rotation.z = x < 0 ? .12 : -.12; });
    for (let i = 0; i < 10; i++) boite(.072, .44, .02, noyer, .1 + i * .074, .35, .236, g);       // les portes à lattes
    boite(.02, .1, .02, laiton, .08, .4, .25, g);
    ['#c8572f', '#2f4a5a', '#d9a23a', '#e6dcc2', '#7b3b2e', '#4f7a46', '#1d1c1f', '#9fd8ff', '#b8473a', '#e9c46a', '#6e5a8a', '#f0a6d8', '#2a2a30', '#d8d4c8'].forEach((c, i) => { const v = boite(.012, .32, .32, M(c), -.78 + i * .051, .29, .05, g); v.rotation.z = (i % 4 - 1.5) * .03; });
    // la platine : socle en bois clair, plateau alu, le vinyle et son rond coloré, le bras
    molle(g, .46, .07, .36, .015, M('#b98a5a', { roughness: .45, flatShading: false }), -.38, .66, 0);
    cylindre(g, .155, .155, .016, 32, alu, -.42, .703, 0);
    const disque = new THREE.Group(); disque.position.set(-.42, .714, 0); disque.userData.vivant = true; g.add(disque);
    const vinyle = new THREE.Mesh(new THREE.CylinderGeometry(.148, .148, .005, 40), M('#111012', { roughness: .22, flatShading: false })); disque.add(vinyle);
    const rond = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .007, 20), new THREE.MeshStandardMaterial({ map: toileTexte(128, 128, (x) => {
      const d = x.createConicGradient ? x.createConicGradient(0, 64, 64) : null;
      if (d) { ['#9fd8ff', '#f0a6d8', '#ffe08a', '#9fd8ff'].forEach((c, i) => d.addColorStop(i / 3, c)); x.fillStyle = d; } else x.fillStyle = '#9fd8ff';
      x.fillRect(0, 0, 128, 128); x.fillStyle = '#111'; x.beginPath(); x.arc(64, 64, 6, 0, 7); x.fill();
    }) })); rond.position.y = .002; disque.add(rond);
    const bras = new THREE.Group(); bras.position.set(-.22, .72, -.12); bras.userData.vivant = true; g.add(bras);
    cylindre(bras, .018, .02, .03, 10, alu, 0, 0, 0);
    const tige = cylindre(bras, .005, .005, .26, 6, alu, -.05, .02, .12); tige.rotation.set(Math.PI / 2, 0, 0); tige.rotation.y = -.4;
    cylindre(bras, .014, .014, .03, 10, noir, .02, .02, -.04).rotation.x = Math.PI / 2;      // le contrepoids
    // l'ampli : façade alu, deux vu-mètres ambrés qui s'allument, gros boutons
    const ampli = new THREE.Group(); ampli.position.set(.3, .625, -.03); g.add(ampli);
    boite(.5, .13, .32, noir, 0, .065, 0, ampli); boite(.5, .12, .01, alu, 0, .065, .162, ampli);
    const vu = new THREE.MeshStandardMaterial({ color: '#ffd89a', emissive: '#ffb347', emissiveIntensity: .35, roughness: .5 });
    const aiguilles = [-.12, .0].map(x => { boite(.1, .056, .006, vu, x, .08, .168, ampli); const a = boite(.002, .045, .002, noir, x, .06, .172, ampli); a.geometry.translate(0, .022, 0); a.position.y = .056; a.userData.garder = true; return a; });
    vu.userData.anime = true;
    [.15, .2].forEach(x => { const b = cylindre(ampli, .02, .022, .02, 16, alu, x, .06, .175); b.rotation.x = Math.PI / 2; });
    // les enceintes : noyer et toile beige, sur le plateau aux deux bouts, un peu tournées vers la pièce
    [-1, 1].forEach(c => {
      const e = new THREE.Group(); e.position.set(c * .73, .625, 0); e.rotation.y = -c * .14; g.add(e);
      molle(e, .25, .42, .26, .015, noyer, 0, .21, 0);
      boite(.21, .36, .006, M('#d8c7a0', { roughness: 1 }), 0, .21, .131, e);
      boite(.05, .012, .003, laiton, 0, .06, .136, e);
    });
    fusionnerDecor(g);   // le meuble, l'ampli, les enceintes : fixes ; le disque, le bras, les aiguilles bougent
    let v = 0;
    return {
      anime(temps, eveil, secousse, dt) {
        v += ((.3 + eveil * 3.2 + secousse * 12) - v) * Math.min(1, dt * 2);
        disque.rotation.y -= v * dt;
        bras.rotation.y = -.28 * Math.min(1, eveil * 1.2);
        vu.emissiveIntensity = .35 + eveil * 1.1;
        aiguilles.forEach((a, i) => { a.rotation.z = .6 - eveil * (.5 + Math.abs(Math.sin(temps * (5 + i) + i)) * .7); });
      },
    };
  },

  // Cite 3 Chinois : le globe sur son tabouret ; les vrais continents, trois punaises lumineuses (Paris, Pékin, Rio)
  globe(g, { M, boite }) {
    const tabouret = M('#6b4a32', { roughness: .7 });
    const assise = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 12), tabouret); assise.position.y = .62; g.add(assise);
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .62, 5), tabouret); const a = i * 2.1; p.position.set(Math.cos(a) * .2, .31, Math.sin(a) * .2); p.rotation.set(Math.sin(a) * .12, 0, -Math.cos(a) * .12); g.add(p); }
    ['#2f4a5a', '#c8572f', '#d9a23a'].forEach((c, i) => boite(.34 - i * .03, .05, .24, M(c), 0, .67 + i * .05, 0, g).rotation.y = i * .25);
    const support = new THREE.Group(); support.position.y = .8; g.add(support);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .04, 12), M('#8c6a3c', { metalness: .5, roughness: .4 })); base.position.y = .02; support.add(base);
    const axe = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .16, 6), M('#8c6a3c', { metalness: .5 })); axe.position.y = .1; support.add(axe);
    // la carte : terre ou mer, par cases de 2°, tirée des contours des pays de Cite 3 Chinois
    const carte = atob('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf8Af/gAAAAAAAAAAAAAAAAAAAAAAAf//////AAAAAAAABgAAAAAAAAAAAAMf+f///4AA/AAAAAB+AAAAAAAAAABwAz4f///4AAIAAAAAAHAAAAAAAAAAAPmvwAf//wAAAAADgAP/4AHgAAAAAAD83/8AP//gAAAAAGBD///+DAAAABgACfw3/gH//gAAA4AED//////+gAgP////5dz4H//AAAP/gA//////////gP//////x+H/wAAAf/7///////////8///////n+D8A+AA+/f///////////sP/////4A8B4AAAH9/////////////Af/////gHwA4AAAH5///////////v4AHwP///gH2AAAAAH4//////////CMAADQB///8D/AAAAGD5/////////8A8AAEAA////n/gAAAPDj/////////4A4AAAAAP///n/wAAAbn///////////AwAAAAAP/////wAAAD////////////AAAAAAAH////8cAAAB///////////9AAAAAAAD////8MAAAB///////////9AAAAAAAD///v/AAAAA//5fP//////5AAAAAAAD//9/gAAAAPxvwPP//////zgAAAAAAD////AAAAAPib//n/////+CAAAAAAAD///+AAAAAfCLf/n/////ECAAAAAAAB///8AAAAAPHRP/3/////mOAAAAAAAA///8AAAAAH/AA///////G8AAAAAAAAf//4AAAAAP/gA///////hgAAAAAAAAP//wAAAAAf/7////////gAAAAAAAAAH/gQAAAAAf//////////gAAAAAAAAAF/AQAAAAB///+/n/////gAAAAAAAAAC/AAAAAAB////fyX////AAAAAAAAAAAeA4AAAAD////f/B///+gAAAAAAAAAAfGGAAAAD////v/B/z/QAAAAAAAgAAAPuBwAAAD////n+Afh+QAAAAAAAAAAAD8AAAAAD////38AfB/AwAAAAAAAAAAAPgAAAAD////7wAcAfggAAAAAAAAAAADgAAAAD////+AAMAfgIAAAAAAAAAAABhwAAAD////8wAMATgYAAAAAAAAAAAA//AAAB/////wAOAQAMAAAAAAAAAAAAH/gAAA/////gACAIAMAAAAAAAAAAAAH/8AAAfH///gAAAsHAAAAAAAAAAAAAH/+AAAAB///AAAAcOAAAAAAAAAAAAAP/+AAAAB//+AAAAce6AAAAAAAAAAAAP//gAAAB/94AAAAMewgAAAAAAAAAAAP//+AAAB//4AAAAGew/AAAAAAAAAAAP///AAAA//wAAAACAwPmAAAAAAAAAAP///gAAA//wAAAAB4AHwAAAAAAAAAAH///gAAAf/wAAAAAAsDYAAAAAAAAAAH///AAAAf/4AAAAAAAAAAAAAAAAAAAD//+AAAA//4gAAAAAB5AAAAAAAAAAAD//+AAAA//4wAAAAAHxgAAAAAAAAAAA//+AAAA//zgAAAAAf/gAAAAAAAAAAAf/+AAAA//DgAAAAAf/wAAAAAAAAAAAf/8AAAAf/DgAAAAD//4AAAAAAAAAAAf/4AAAAf/DAAAAAH//8AAAAAAAAAAAf/gAAAAf/DAAAAAH//+AAAAAAAAAAAf/AAAAAP+AAAAAAH//+AAAAAAAAAAA//AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAH4AAAAAAD//+AAAAAAAAAAA/8AAAAAHwAAAAAAD4f8AAAAAAAAAAA/4AAAAAAAAAAAAADAH8AAAAAAAAAAB/wAAAAAAAAAAAAAAAD4AEAAAAAAAAB/AAAAAAAAAAAAAAAAAQAGAAAAAAAAB+AAAAAAAAAAAAAAAAAQAMAAAAAAAAB8AAAAAAAAAAAAAAAAAQAYAAAAAAAAB8AAAAAAAAAAAAAAAAAAAwAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////');
    const terre = (lat, lon) => { const j = Math.min(89, Math.max(0, Math.round((89 - lat) / 2))), i = ((Math.round((lon + 179) / 2) % 180) + 180) % 180, k = j * 180 + i; return (carte.charCodeAt(k >> 3) >> (7 - (k & 7))) & 1; };
    const geo = sansIndex(new THREE.IcosahedronGeometry(.26, 4));
    const p = geo.attributes.position, coul = [], c = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const cx = p.getX(i) + p.getX(i + 1) + p.getX(i + 2), cy = p.getY(i) + p.getY(i + 1) + p.getY(i + 2), cz = p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2), r = Math.hypot(cx, cy, cz);
      const lat = Math.asin(cy / r) * 180 / Math.PI, lon = Math.atan2(-cz, cx) * 180 / Math.PI, bruit = Math.sin(cx * 40) * Math.cos(cz * 37 + cy * 11);
      if (!terre(lat, lon)) c.set(bruit > .3 ? '#346f98' : '#2f6690');
      else if (lat > 64 || lat < -60) c.set('#eef2f3');
      else if ((lat > 14 && lat < 33 && lon > -17 && lon < 60) || (lat < -18 && lat > -32 && lon > 116 && lon < 142) || (lat > 36 && lat < 46 && lon > 75 && lon < 110)) c.set(bruit > 0 ? '#dcbd7c' : '#d2b06c');
      else c.set(bruit > .2 ? '#6c9f52' : lat > 50 ? '#4f8048' : '#7fae58');
      for (let j = 0; j < 3; j++) coul.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3));
    const boule = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, flatShading: true }));
    const pivot = new THREE.Group(); pivot.position.y = .44; pivot.rotation.z = .41; support.add(pivot); pivot.add(boule);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(.3, .01, 5, 24, Math.PI), M('#8c6a3c', { metalness: .5 })); arc.rotation.z = Math.PI / 2; pivot.add(arc);
    const feux = [[48.85, 2.35], [39.9, 116.4], [-22.9, -43.2]].map(([la, lo]) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.016, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffc96b' }));
      const a = la * Math.PI / 180, b = lo * Math.PI / 180;
      f.position.set(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)).multiplyScalar(.266); boule.add(f); return f;
    });
    return {
      anime(temps, eveil, secousse, dt) {
        boule.rotation.y += dt * (.15 + eveil * .5 + secousse * 6);
        feux.forEach((f, i) => f.scale.setScalar(1 + (Math.sin(temps * 3 + i * 2) * .5 + .5) * eveil * 1.2));
      },
    };
  },

  // RP Talya : son panier, sa gamelle, sa balle, et elle
  talya(g, { M, boite }) {
    const panier = new THREE.Mesh(new THREE.TorusGeometry(.48, .14, 8, 16), M('#7b3b2e', { roughness: 1 })); panier.rotation.x = Math.PI / 2; panier.position.y = .14; panier.scale.z = .9; g.add(panier);
    const coussin = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .1, 16), M('#d9c3a0', { roughness: 1 })); coussin.position.y = .08; g.add(coussin);
    // Talya, couchée, la tête posée
    const blanc = M('#f1f3ee'), ombre = M('#d5d9d1'), rose = M('#e2b7b2'), noir = M('#151010');
    const corps = new THREE.Mesh(new THREE.IcosahedronGeometry(.3, 1), blanc); corps.scale.set(1.25, .55, .85); corps.position.set(-.05, .25, -.05); g.add(corps);
    const tete = new THREE.Group(); tete.position.set(.14, .38, .2); tete.rotation.y = .9; g.add(tete);
    const crane = new THREE.Mesh(new THREE.IcosahedronGeometry(.17, 0), blanc); crane.scale.set(1, .85, 1); tete.add(crane);
    const museau = new THREE.Mesh(new THREE.ConeGeometry(.08, .34, 5), blanc); museau.rotation.x = Math.PI / 2; museau.position.set(0, -.04, .2); tete.add(museau);
    const truffe = new THREE.Mesh(new THREE.IcosahedronGeometry(.025, 0), noir); truffe.position.set(0, -.04, .37); tete.add(truffe);
    const oreilles = [-1, 1].map(c => {
      const o = new THREE.Group(); o.position.set(c * .09, .1, -.02); o.rotation.z = -c * .25; tete.add(o);
      const ext = new THREE.Mesh(new THREE.ConeGeometry(.06, .26, 4), c < 0 ? ombre : blanc); ext.position.y = .12; o.add(ext);
      const int = new THREE.Mesh(new THREE.ConeGeometry(.032, .18, 3), rose); int.position.set(0, .11, .03); o.add(int);
      return o;
    });
    // un seul œil : Talya n'a plus son œil gauche (côté +x de sa tête), on ne dessine que le droit
    const oeil = new THREE.Mesh(new THREE.SphereGeometry(.017, 6, 4), noir); oeil.position.set(-.07, .03, .13); tete.add(oeil);
    const queue = new THREE.Mesh(new THREE.ConeGeometry(.05, .35, 5), blanc); queue.position.set(-.42, .2, .12); queue.rotation.z = 1.9; g.add(queue);
    // la gamelle et la balle
    const gamelle = new THREE.Group(); gamelle.position.set(.8, 0, .35); g.add(gamelle);
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(.15, .11, .08, 14, 1, true), M('#c8572f', { side: THREE.DoubleSide, metalness: .2 })); bol.position.y = .04; gamelle.add(bol);
    const fond = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .01, 14), M('#9c4225')); fond.position.y = .005; gamelle.add(fond);
    const nom = new THREE.Mesh(new THREE.PlaneGeometry(.16, .04), new THREE.MeshBasicMaterial({ transparent: true, map: toileTexte(256, 64, (x) => { x.fillStyle = '#f4efe4'; x.font = '700 40px "Inter Tight", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('TALYA', 128, 46); }) }));
    nom.position.set(0, .045, .135); gamelle.add(nom);
    const balle = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 1), M('#cfe05a')); balle.position.set(-.75, .07, .55); g.add(balle);
    // les petits cœurs quand on la caresse (pas de main dessinée : c'est la tienne qui caresse)
    const coeur = toileTexte(64, 64, (x) => {
      x.fillStyle = '#ff6f8e'; x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 34, 6, 10, 22, 10); x.bezierCurveTo(28, 10, 31, 14, 32, 18);
      x.bezierCurveTo(33, 14, 36, 10, 42, 10); x.bezierCurveTo(58, 10, 60, 34, 32, 54); x.fill();
    });
    const coeurs = Array.from({ length: 5 }, (_, i) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: coeur, transparent: true, depthWrite: false })); sp.visible = false; g.add(sp); return sp; });
    let frisson = 0, caresse = 99;
    return {
      caresser() { caresse = 0; },
      anime(temps, eveil, secousse, dt) {
        caresse += dt;
        const c = caresse < 3 ? Math.min(1, caresse * 4, (3 - caresse) * 2) : 0;   // 0 → 1 → 0 sur trois secondes
        corps.scale.y = .55 + Math.sin(temps * 1.6) * .015;                       // elle respire
        corps.rotation.z = c * Math.sin(temps * 9) * .04;                          // elle se tortille de plaisir
        tete.rotation.x = -.15 + eveil * -.2 + Math.sin(temps * .7) * .03 - c * .25;   // elle relève la tête quand on arrive, et vers la main
        tete.rotation.z = c * Math.sin(temps * 5) * .12;
        tete.position.y = .38 + eveil * .08 + c * .05;
        oeil.scale.y = c > .3 ? .15 : 1;                                            // l'œil se ferme, contente
        if (Math.random() < dt * .3) frisson = 1;
        frisson = Math.max(frisson, secousse); frisson = Math.max(0, frisson - dt * 3);
        const v = Math.sin(temps * 40) * frisson * .3; oreilles[0].rotation.x = v + c * .6; oreilles[1].rotation.x = -v + c * .6;   // les oreilles en arrière
        queue.rotation.y = Math.sin(temps * (4 + eveil * 8 + c * 10)) * (.15 + eveil * .45 + c * .35);
        // les cœurs montent et s'effacent
        coeurs.forEach((sp, i) => {
          const a = caresse - i * .35;
          sp.visible = a > 0 && a < 1.8;
          if (!sp.visible) return;
          sp.position.set(.14 + Math.sin(i * 2.3) * .2, .7 + a * .45, .2 + Math.cos(i * 1.7) * .12);
          const s = .12 + Math.sin(Math.min(1, a * 3) * Math.PI / 2) * .06; sp.scale.set(s, s, 1);
          sp.material.opacity = Math.min(1, (1.8 - a) * 1.5);
        });
      },
    };
  },

  // Fun facts : un pupitre de jeu télé, son gros buzzer rouge, ses ampoules qui défilent, et un « ? » qui s'allume
  quiz(g, { M, boite }) {
    const marine = M('#1c2a4a', { roughness: .45, flatShading: false }), rouge = M('#b8282e', { roughness: .4, flatShading: false }), or = M('#e3b04b', { metalness: .6, roughness: .3, flatShading: false }), noir = M('#151518', { roughness: .5 });
    const profil = new THREE.Shape(); profil.moveTo(-.34, 0); profil.lineTo(.34, 0); profil.lineTo(.44, .95); profil.lineTo(-.44, .95); profil.closePath();
    const corps = new THREE.Mesh(new THREE.ExtrudeGeometry(profil, { depth: .4, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2 }), marine);
    corps.position.z = -.2; corps.castShadow = corps.receiveShadow = true; g.add(corps);
    boite(.82, .04, .03, or, 0, .06, .23, g); boite(.98, .03, .03, or, 0, .93, .23, g);
    // la façade : un grand « ? » sur fond rouge
    const facade = toileTexte(256, 256, (x, w, h) => {
      const d = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * .7); d.addColorStop(0, '#d8323a'); d.addColorStop(1, '#7a1418'); x.fillStyle = d; x.fillRect(0, 0, w, h);
      x.fillStyle = '#ffd35a'; x.font = '900 200px "Inter Tight", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(255,200,80,.8)'; x.shadowBlur = 24; x.fillText('?', w / 2, h / 2 + 12);
    });
    const ecran = new THREE.Mesh(new THREE.PlaneGeometry(.56, .56), new THREE.MeshStandardMaterial({ map: facade, emissiveMap: facade, emissive: '#ffffff', emissiveIntensity: .35, roughness: .6 }));
    ecran.position.set(0, .5, .222); g.add(ecran);
    // les ampoules du cadre, qui défilent
    const ampA = M('#ffe2a0', { emissive: '#ffcf6a', emissiveIntensity: .4, roughness: .3, flatShading: false }), ampB = M('#ffe2a0', { emissive: '#ffcf6a', emissiveIntensity: .4, roughness: .3, flatShading: false });
    let k = 0;
    const ampoule = (x, y) => { const b = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), k++ % 2 ? ampA : ampB); b.position.set(x, y, .228); g.add(b); };
    for (let i = 0; i <= 6; i++) { const x = -.32 + i * (.64 / 6); ampoule(x, .17); ampoule(x, .83); }
    for (let i = 1; i < 6; i++) { const y = .17 + i * (.66 / 6); ampoule(-.33 - (y - .17) * .1, y); ampoule(.33 + (y - .17) * .1, y); }
    // le dessus : un plan incliné, le buzzer rouge sur son socle noir, une petite fiche « question »
    const dessus = boite(.98, .04, .5, rouge, 0, .97, 0, g); dessus.rotation.x = .1;
    const socle = cylindre(g, .12, .13, .05, 20, noir, 0, 1.015, .04);
    const buzzer = new THREE.Mesh(new THREE.SphereGeometry(.095, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#ff2a2a', { emissive: '#ff1a1a', emissiveIntensity: .3, roughness: .3, flatShading: false }));
    buzzer.position.set(0, 1.04, .04); buzzer.castShadow = true; buzzer.userData.garder = true; g.add(buzzer);
    const fiche = boite(.2, .005, .13, M('#f4efe4', { roughness: 1 }), .3, 1.005, .08, g); fiche.rotation.set(.1, -.3, 0);
    // derrière : une lanterne « ? » sur un mât, qui tourne doucement
    cylindre(g, .015, .015, 1.0, 6, noir, 0, 1.5, -.32);
    const lanterne = new THREE.Group(); lanterne.position.set(0, 2.08, -.32); lanterne.userData.vivant = true; g.add(lanterne);
    const signe = toileTexte(128, 128, (x, w, h) => { x.fillStyle = '#1c2a4a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd35a'; x.font = '900 104px "Inter Tight", Helvetica, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', w / 2, h / 2 + 6); });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(.22, .22, .22), new THREE.MeshStandardMaterial({ map: signe, emissiveMap: signe, emissive: '#ffffff', emissiveIntensity: .5, roughness: .6 }));
    lanterne.add(cube);
    ampA.userData.anime = ampB.userData.anime = true;
    fusionnerDecor(g);   // le pupitre et ses ampoules : quelques dessins ; le buzzer et la lanterne bougent
    return {
      anime(temps, eveil, secousse, dt) {
        const vite = 2 + eveil * 9, on = Math.sin(temps * vite) > 0;
        ampA.emissiveIntensity = .25 + eveil * (on ? 2.2 : .3); ampB.emissiveIntensity = .25 + eveil * (on ? .3 : 2.2);
        buzzer.material.emissiveIntensity = .3 + eveil * (.5 + .5 * Math.sin(temps * 4)) + secousse * 2;
        buzzer.position.y = 1.04 - secousse * .03;
        cube.material.emissiveIntensity = .4 + eveil * .9;
        lanterne.rotation.y += dt * (.4 + eveil * .8 + secousse * 8);
      },
    };
  },

  // Raciste ou joueur de fléchettes ? : la cible au mur, condamnée au scotch
  flechettes(g, { M, boite }) {
    const cible = new THREE.Group(); cible.position.set(0, 1.55, .1); g.add(cible);
    const dos = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 24), M('#16130f')); dos.rotation.x = Math.PI / 2; cible.add(dos);
    [[0, .03, '#b8473a', '#b8473a'], [.03, .06, '#3f7a4a', '#3f7a4a'], [.06, .2, '#16130f', '#e6dcc2'], [.2, .23, '#b8473a', '#3f7a4a'], [.23, .34, '#16130f', '#e6dcc2'], [.34, .37, '#b8473a', '#3f7a4a']].forEach(([r1, r2, c1, c2]) => {
      const geo = sansIndex(r1 ? new THREE.RingGeometry(r1, r2, 20, 1) : new THREE.CircleGeometry(r2, 20));
      const coul = [], n = geo.attributes.position.count / 3;
      for (let i = 0; i < n; i++) { const s = r1 ? Math.floor(i / 2) % 20 : i; const c = new THREE.Color(s % 2 ? c2 : c1); for (let j = 0; j < 3; j++) coul.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3));
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 })); m.position.z = .031; cible.add(m);
    });
    const fleche = new THREE.Group(); fleche.position.set(.09, .08, .03); fleche.rotation.set(-.2, .25, 0); cible.add(fleche);
    const fut = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .2, 5), M('#9a8f78', { metalness: .5 })); fut.rotation.x = Math.PI / 2; fut.position.z = .1; fleche.add(fut);
    const ailette = new THREE.Mesh(new THREE.ConeGeometry(.035, .06, 3), M('#c8572f')); ailette.rotation.x = -Math.PI / 2; ailette.position.z = .21; fleche.add(ailette);
    // le scotch « EN TRAVAUX » en croix
    const ruban = toileTexte(512, 64, (x, w, h) => {
      x.fillStyle = '#e8d9a8'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#c8572f'; x.font = '700 30px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.fillText('EN TRAVAUX  ·  EN TRAVAUX', w / 2, 43);
    });
    [-.6, .55].forEach((r, i) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .09), new THREE.MeshStandardMaterial({ map: ruban, roughness: .8 })); s.position.set(0, 0, .045 + i * .002); s.rotation.z = r; cible.add(s); });
    // deux fléchettes tombées par terre
    [[.3, .5, .4], [-.25, .7, 1.4]].forEach(([x, z, r]) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .2, 5), M('#9a8f78')); f.rotation.set(Math.PI / 2, 0, r); f.position.set(x, .01, z); g.add(f); });
    return {
      anime(temps, eveil, secousse) {
        fleche.rotation.y = .25 + Math.sin(temps * 30) * .08 * secousse;
        cible.rotation.z = Math.sin(temps * 22) * .02 * secousse;
      },
    };
  },

  // D'autres créations arrivent : un carton pas encore ouvert
  carton(g, { M, boite }) {
    const kraft = M('#b88a55', { roughness: .95 }), kraft2 = M('#a57a48', { roughness: .95 });
    const c = new THREE.Group(); g.add(c);
    boite(.7, .5, .5, kraft, 0, .25, 0, c);
    const rabat = (x, z, ry, w, rz) => { const p = new THREE.Group(); p.position.set(x, .5, z); p.rotation.y = ry; c.add(p); const m = boite(w, .01, .24, kraft2, 0, 0, .12, p); p.rotation.x = 0; return p; };
    const r1 = rabat(0, .25, 0, .7), r2 = rabat(0, -.25, Math.PI, .7);
    boite(.08, .505, .51, M('#d9c99a', { roughness: .6 }), 0, .25, 0, c);
    const etiquette = new THREE.Mesh(new THREE.PlaneGeometry(.36, .16), new THREE.MeshStandardMaterial({ map: toileTexte(256, 112, (x, w, h) => {
      x.fillStyle = '#f4efe4'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1b1a17'; x.font = '700 34px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.fillText('À VENIR', w / 2, 52);
      x.font = '500 18px "IBM Plex Mono", monospace'; x.fillStyle = '#c8572f'; x.fillText('fragile · idées', w / 2, 86);
    }), roughness: .9 }));
    etiquette.position.set(.15, .28, .252); c.add(etiquette);
    // un second carton derrière, et un petit dessus
    const c2 = boite(.5, .4, .45, kraft2, -.55, .2, -.45, g); c2.rotation.y = .4;
    const c3 = boite(.36, .26, .32, kraft, -.5, .53, -.43, g); c3.rotation.y = .2;
    const lueur = new THREE.PointLight('#ffd9a0', 0, 1.2, 1.6); lueur.position.set(0, .52, 0); c.add(lueur);
    return {
      anime(temps, eveil, secousse) {
        const o = Math.min(1, eveil * 1.2);
        r1.rotation.x = -o * 1.9; r2.rotation.x = -o * 1.9;                     // le carton s'entrouvre
        lueur.intensity = o * 1.4 + Math.sin(temps * 3) * .2 * o;
        c.rotation.z = Math.sin(temps * 26) * .02 * secousse;
      },
    };
  },
};
