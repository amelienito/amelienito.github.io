/* ════════════════════════════════════════════════════════════════════
   OSB CORPORATION — la pièce
   Une chambre-bureau vue comme une maison de poupée : chaque création
   est un objet de la pièce (l'ordi, la platine, le globe, le panier de
   Talya, le cabinet, la cible, le carton). On passe de l'un à l'autre
   à la molette, au doigt ou aux flèches ; un clic sur l'objet l'ouvre.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from './vendor/three.module.js';

/* où se trouve chaque objet dans la pièce, et d'où on le regarde
   pos : position au sol · face : direction vers laquelle il est tourné (radians)
   vue : [recul, hauteur de l'œil, hauteur du regard] */
const PLACES = {
  ordi:       { pos: [-2.6, 0, -3.35], face: 0,            vue: [2.3, 1.55, 1.05] },
  platine:    { pos: [1.9, 0, -3.5],   face: 0,            vue: [2.2, 1.5, .95] },
  globe:      { pos: [-4.1, 0, -.7],   face: Math.PI / 2,  vue: [2.3, 1.55, 1.1] },
  talya:      { pos: [3.1, 0, 1.1],    face: -2.4,         vue: [2.4, 1.35, .35] },
  cabinet:    { pos: [4.55, 0, -1.6],  face: -Math.PI / 2, vue: [3.1, 1.6, 1.15] },
  flechettes: { pos: [-4.92, 0, 1.9],  face: Math.PI / 2,  vue: [2.6, 1.6, 1.55] },
  carton:     { pos: [-1.6, 0, 2.3],   face: .5,           vue: [2.2, 1.45, .35] },
};

export function demarrer({ toile, etapes, surEtape, reduit, decors = {}, surDecor = () => {}, depart = 0, bloque = () => false, surBloque = () => {} }) {
  const N = etapes.length;
  const cliche = new URLSearchParams(location.search).get('cliche');

  /* ─────────── moteur ─────────── */
  const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, preserveDrawingBuffer: !!cliche });
  rendu.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  rendu.shadowMap.enabled = true;
  rendu.shadowMap.type = THREE.PCFShadowMap;
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#15110d');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  function taille() {
    const w = toile.clientWidth || innerWidth, h = toile.clientHeight || innerHeight;
    rendu.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 66 : 50;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', taille);
  taille();

  /* ─────────── la lumière : un plafonnier chaud, la nuit par la fenêtre ─────────── */
  scene.add(new THREE.HemisphereLight('#fff1dc', '#5a4632', 0.9));
  const plafonnier = new THREE.SpotLight('#ffd9a8', 60, 14, 1.15, .6, 1.4);
  plafonnier.position.set(0, 3.6, -.3); plafonnier.target.position.set(0, 0, -.5);
  plafonnier.castShadow = true; plafonnier.shadow.mapSize.set(1024, 1024); plafonnier.shadow.bias = -.0008;
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
  }
  tableau('img/murs/chief-keef.jpg', 1.0, .749, 1.9, 1.54, -4.18, 0, { cadre: '#b08a3e', bord: .07, epais: .05, dore: true });   // Chief Keef au jardin d'Éden, au-dessus de la platine
  tableau('img/murs/koi.jpg', .66, .66, -2.6, 2.06, -4.18, 0, { cadre: '#e9e1cf', bord: .05 });                                     // la carpe géante, au-dessus du bureau
  tableau('img/murs/i-love-ugly.jpg', .96, .642, -4.99, 1.86, .62, Math.PI / 2);                                                   // I Love Ugly (Chester Watson), entre le globe et la cible
  tableau('img/murs/evil-dead-2.jpg', .56, .868, 4.99, 1.72, -2.85, -Math.PI / 2, { cadre: '#0e0d0c' });                           // Evil Dead 2, entre la plante et le cabinet de curiosités

  meubler(scene, { M, boite });

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
  const regard = new THREE.Vector3();
  function placer(temps) {
    const k = Math.floor(t), f = t - k, b = Math.min(N - 1, k + 1);
    const l = f * f * (3 - 2 * f);
    // entre deux objets on recule un peu, comme quelqu'un qui traverse la pièce
    const recul = Math.sin(l * Math.PI) * .35;
    camera.position.lerpVectors(vues[k].pos, vues[b].pos, l);
    regard.lerpVectors(vues[k].regard, vues[b].regard, l);
    const vers = camera.position.clone().sub(regard).setY(0).normalize();
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
  let avant = performance.now(), temps = 0, derniere = -1, enPause = false, flash = 0;
  const voile = document.createElement('div');
  voile.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:#fff4e0;opacity:0;transition:opacity .35s';
  document.body.appendChild(voile);
  function image() {
    if (enPause) return;
    const m = performance.now(), dt = Math.min(.05, (m - avant) / 1000); avant = m; temps += dt;
    t += (cibleT - t) * (reduit ? 1 : 1 - Math.pow(.002, dt));
    if (Math.abs(cibleT - t) < .0005) t = cibleT;
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
    rendu.render(scene, camera);
    if (!cliche) requestAnimationFrame(image);
  }
  if (cliche) { for (let i = 0; i < 30; i++) { t = cibleT; image(); } document.body.dataset.pret = '1'; }
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
  boite(l, H - socle, .012, M('#24180f'), 0, socle + (H - socle) / 2, -p / 2 + .006, g);
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

function ecranConsole() {
  return toileTexte(1024, 576, (x, w, h) => {
    const d = x.createLinearGradient(0, 0, w, h); d.addColorStop(0, '#0b1634'); d.addColorStop(.55, '#17265a'); d.addColorStop(1, '#321d52'); x.fillStyle = d; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(140,170,255,.07)';
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(0, h * (.55 + i * .1)); x.bezierCurveTo(w * .3, h * (.4 + i * .1), w * .6, h * (.75 + i * .1), w, h * (.5 + i * .1)); x.lineTo(w, h); x.lineTo(0, h); x.fill(); }
    const S = '"Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif';
    x.fillStyle = '#fff'; x.font = `700 24px ${S}`; x.fillText('Jeux', 72, 66);
    x.globalAlpha = .5; x.fillText('Médias', 150, 66); x.globalAlpha = 1;
    x.fillStyle = '#6b7a9e'; x.fillRect(72, 78, 56, 3);
    x.textAlign = 'right'; x.font = `600 22px ${S}`; x.fillText('21:04', w - 96, 64); x.textAlign = 'left';
    x.fillStyle = '#c8572f'; x.beginPath(); x.arc(w - 60, 58, 17, 0, 7); x.fill();
    // les jeux récents : la première tuile est sélectionnée
    const tuiles = [['#c8572f', '#7b3b2e'], ['#2f4a5a', '#16232b'], ['#d9a23a', '#8a5a1e'], ['#4f7a46', '#233a22'], ['#6e5a8a', '#2b2140'], ['#b8473a', '#3a1a1a'], ['#3f6f8f', '#14293a']];
    tuiles.forEach(([a, b], i) => {
      const sel = i === 0, W = sel ? 236 : 168, H = sel ? 236 : 168, X = sel ? 72 : 72 + 236 + 34 + (i - 1) * 190, Y = sel ? 170 : 204;
      const gr = x.createLinearGradient(X, Y, X + W, Y + H); gr.addColorStop(0, a); gr.addColorStop(1, b);
      x.save(); if (sel) { x.shadowColor = 'rgba(255,255,255,.35)'; x.shadowBlur = 30; }
      x.fillStyle = gr; arrondi(x, X, Y, W, H, 14); x.fill(); x.restore();
      x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath();
      if (i % 3 === 0) x.arc(X + W * .62, Y + H * .4, W * .22, 0, 7); else if (i % 3 === 1) { x.moveTo(X + W * .2, Y + H * .8); x.lineTo(X + W * .5, Y + H * .2); x.lineTo(X + W * .8, Y + H * .8); } else x.rect(X + W * .25, Y + H * .25, W * .5, W * .4);
      x.fill();
      if (sel) { x.strokeStyle = '#fff'; x.lineWidth = 4; arrondi(x, X - 5, Y - 5, W + 10, H + 10, 18); x.stroke(); }
    });
    x.fillStyle = '#fff'; x.font = `700 34px ${S}`; x.fillText('Cite 3 Chinois', 72, 452);
    x.globalAlpha = .6; x.font = `500 20px ${S}`; x.fillText('Continuer', 72, 484); x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,.1)'; arrondi(x, 420, 410, 530, 110, 12); x.fill();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = `600 18px ${S}`; x.fillText('Activités', 446, 444);
  });
}

function coinTele(g, { M, boite }) {
  const sombre = M('#2c2018', { roughness: .65 }), noir = M('#121214', { roughness: .35 }), blanc = M('#eceae4', { roughness: .4, flatShading: false });
  // le meuble bas, un peu rayé
  boite(1.95, .04, .42, sombre, 0, .44, 0, g); boite(1.95, .03, .4, sombre, 0, .105, 0, g);
  boite(.04, .43, .42, sombre, -.955, .235, 0, g); boite(.04, .43, .42, sombre, .955, .235, 0, g); boite(.04, .36, .4, sombre, .22, .27, 0, g);
  [.6, .6].forEach((x, i) => { boite(.66, .15, .02, M('#3a2a20'), x, .17 + i * .17, .205, g); boite(.1, .015, .02, M('#9a8f78', { metalness: .5 }), x, .17 + i * .17 + .04, .222, g); });
  // dans la case ouverte : des jeux, une vieille console, des câbles
  tas(g, boite, M, 6, .2, .018, .15, -.78, .12, 0, ['#2f5fa8', '#2a4e8a', '#e9e4d8', '#1d1c1f', '#2f5fa8'], 4);
  tas(g, boite, M, 4, .2, .018, .15, .05, .12, 0, ['#2f5fa8', '#c8572f', '#1d1c1f'], 9);
  boite(.34, .07, .22, M('#1d1c1f', { roughness: .4 }), -.38, .155, .02, g).rotation.y = .04;                        // une vieille console, entre les piles
  boite(.3, .012, .1, M('#d8d4c8'), -.38, .196, .02, g);
  // la télé
  boite(.62, .015, .2, noir, 0, .468, -.02, g); boite(.12, .13, .05, noir, 0, .54, -.05, g);
  boite(1.64, .93, .045, noir, 0, 1.08, -.05, g);
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(1.56, .87), new THREE.MeshBasicMaterial({ map: ecranConsole(), toneMapped: false, color: '#c4c4c4' }));
  ecran.position.set(0, 1.08, -.0265); g.add(ecran);
  boite(1.2, .07, .1, M('#18181a', { roughness: .8 }), 0, .495, .11, g);                                            // la barre de son
  // la PS5, debout à gauche du meuble : deux ailes blanches autour du noir
  const ps = new THREE.Group(); ps.position.set(.76, .46, -.02); ps.rotation.y = .06; g.add(ps);
  boite(.07, .37, .24, noir, 0, .205, 0, ps); boite(.03, .39, .26, blanc, -.052, .205, 0, ps); boite(.03, .39, .26, blanc, .052, .205, 0, ps); boite(.13, .02, .22, noir, 0, .01, 0, ps);
  boite(.073, .004, .2, new THREE.MeshBasicMaterial({ color: '#58a6ff' }), 0, .392, 0, ps);
  // le reflet de l'écran sur le sol et le canapé
  const lueur = new THREE.PointLight('#7a8cff', 1.1, 3.6, 1.6); lueur.position.set(0, 1.05, .7); g.add(lueur);
}

function manette(parent, M, boite, x, y, z, ry) {
  const m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  boite(.15, .032, .09, M('#eceae4', { flatShading: false }), 0, .016, 0, m);
  boite(.07, .034, .07, M('#16161a'), 0, .017, .005, m);
  boite(.08, .003, .012, new THREE.MeshBasicMaterial({ color: '#58a6ff' }), 0, .034, -.04, m);
  [-.03, .03].forEach(c => { const s = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .014, 8), M('#16161a')); s.position.set(c, .038, .014); m.add(s); });
  return m;
}

function canapeEtTable(g, { M, boite }) {
  // le canapé : bleu pétrole, creusé au milieu, 15 ans d'écrans
  const tissu = M('#3a5d70', { roughness: .95 }), tissuC = M('#48708a', { roughness: .95 }), pied = M('#241a14');
  const sofa = new THREE.Group(); sofa.position.set(1.75, 0, 2.85); sofa.rotation.y = Math.PI / 2; g.add(sofa);
  [[-.9, -.38], [.9, -.38], [-.9, .38], [.9, .38]].forEach(([x, z]) => boite(.06, .1, .06, pied, x, .05, z, sofa));
  boite(2.0, .2, .86, tissu, 0, .2, 0, sofa);
  [-.64, 0, .64].forEach((x, i) => { const c = boite(.64, .15, .7, tissuC, x, .38 - (i === 1 ? .012 : 0), .06, sofa); c.rotation.z = (i - 1) * .006; });
  boite(2.0, .52, .2, tissu, 0, .6, -.33, sofa);
  [-.64, 0, .64].forEach((x, i) => { const c = boite(.62, .34, .14, tissuC, x, .6, -.2, sofa); c.rotation.x = -.14 + (i === 2 ? .04 : 0); });
  boite(.2, .34, .86, tissu, -.9, .47, 0, sofa); boite(.2, .34, .86, tissu, .9, .47, 0, sofa);
  // coussins d'ocre et de rouille, un plaid jeté sur l'accoudoir
  const c1 = boite(.4, .4, .13, M('#d9a23a', { roughness: 1 }), -.62, .7, -.12, sofa); c1.rotation.set(-.2, .2, .1);
  const c2 = boite(.36, .36, .13, M('#c8572f', { roughness: 1 }), .55, .68, -.12, sofa); c2.rotation.set(-.18, -.3, -.08);
  const plaid = boite(.5, .03, .96, M('#8c3a2a', { roughness: 1 }), .88, .66, .02, sofa); plaid.rotation.z = -.08;
  boite(.5, .032, .1, M('#e6dcc2', { roughness: 1 }), .88, .668, .12, sofa).rotation.z = -.08;
  manette(sofa, M, boite, -.1, .458, .2, .5);
  // le tapis du salon
  const t1 = boite(3.0, .02, 2.0, M('#a9753a', { roughness: 1 }), 2.85, .01, 2.85, g), t2 = boite(2.8, .022, 1.8, M('#e6dcc2', { roughness: 1 }), 2.85, .011, 2.85, g), t3 = boite(2.7, .024, 1.7, M('#8a4a35', { roughness: 1 }), 2.85, .012, 2.85, g);
  [t1, t2, t3].forEach(t => { t.castShadow = false; });
  // la table basse : un plateau de bois, deux manettes, une tasse, la télécommande
  const table = new THREE.Group(); table.position.set(3.2, 0, 2.85); table.rotation.y = Math.PI / 2; g.add(table);
  const bois = M('#6b4a32', { roughness: .7 });
  boite(1.0, .04, .55, bois, 0, .36, 0, table); boite(.9, .03, .45, bois, 0, .14, 0, table);
  [[-.45, -.23], [.45, -.23], [-.45, .23], [.45, .23]].forEach(([x, z]) => boite(.04, .36, .04, bois, x, .18, z, table));
  manette(table, M, boite, -.2, .38, .08, -.4); manette(table, M, boite, .08, .38, -.12, 2.5);
  const tasse = new THREE.Mesh(new THREE.CylinderGeometry(.04, .035, .09, 10), M('#e6dcc2')); tasse.position.set(.36, .425, .12); table.add(tasse);
  boite(.05, .014, .16, M('#16161a'), .3, .387, -.12, table).rotation.y = .3;
  boite(.2, .03, .14, M('#2f4a5a'), -.38, .395, -.12, table).rotation.y = -.15; boite(.17, .025, .12, M('#c8572f'), -.38, .422, -.12, table).rotation.y = .2;       // deux magazines
  // le lampadaire, dans le coin
  const lamp = new THREE.Group(); lamp.position.set(4.55, 0, 4.0); g.add(lamp);
  const metal = M('#2b2b2e', { roughness: .4, metalness: .3 });
  const socle = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, .03, 12), metal); socle.position.y = .015; lamp.add(socle);
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1.55, 6), metal); mat.position.y = .8; lamp.add(mat);
  const abat = new THREE.Mesh(new THREE.CylinderGeometry(.14, .22, .3, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#f2dcae', emissive: '#ffcf8a', emissiveIntensity: .8, side: THREE.DoubleSide, roughness: 1 })); abat.position.y = 1.68; lamp.add(abat);
  const ampoule = new THREE.PointLight('#ffcf8a', 1.4, 3.2, 1.6); ampoule.position.set(0, 1.62, 0); lamp.add(ampoule);
}

function meubler(scene, { M, boite }) {
  const CD = { h: .13, e: .012, p: .14, pal: ['#1d1c1f', '#e6dcc2', '#c8572f', '#2f4a5a', '#d9a23a', '#7b3b2e', '#4f7a46', '#9a8f78', '#b8473a', '#6e5a8a', '#2a2a30', '#d8d4c8', '#3f6f8f'], bande: ['#efe8d6', '#efe8d6', '#d9d2bd', '#e8c56a'] };
  const DVD = { h: .19, e: .015, p: .135, pal: ['#14141a', '#1b1b22', '#101015', '#23272e', '#16161c', '#1d4f7a', '#143a5e', '#d9a23a', '#7b1f1f', '#e6dcc2', '#2a2420'], bande: ['#f4f1ea', '#f4f1ea', '#e9d7a0', '#c8572f'] };

  // la grande bibliothèque à CD, contre le mur de gauche (celle qui déborde)
  const A = new THREE.Group(); A.position.set(-4.83, 0, -2.35); A.rotation.y = Math.PI / 2; scene.add(A);
  const bib = etagere(A, { M, boite }, { l: 1.3, p: .24, n: 10, pas: .178, item: CD, bois: '#4a3527', seed: 11, plein: .97 });
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
  const tour = etagere(T, { M, boite }, { l: .46, p: .2, n: 8, pas: .178, item: CD, bois: '#2b2b2e', seed: 37, plein: .98 });
  tas(tour.g, boite, M, 3, .13, .011, .14, 0, tour.H, 0, CD.pal, 3);

  // les DVD et Blu-ray, au fond à droite, à côté de la platine
  const D = new THREE.Group(); D.position.set(3.5, 0, -4.035); scene.add(D);
  const dvd = etagere(D, { M, boite }, { l: 1.2, p: .22, n: 6, pas: .245, item: DVD, bois: '#5a3c26', seed: 73, plein: .97 });
  const poste = new THREE.Group(); poste.position.set(-.3, dvd.H, 0); dvd.g.add(poste);                                       // un vieux poste de radio
  boite(.32, .18, .14, M('#7b3b2e', { roughness: .5 }), 0, .09, 0, poste); boite(.1, .1, .01, M('#d8cdb0'), -.08, .09, .075, poste);
  const cad = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .012, 12), M('#d9a23a', { metalness: .5 })); cad.rotation.x = Math.PI / 2; cad.position.set(.09, .09, .075); poste.add(cad);
  tas(dvd.g, boite, M, 5, .19, .015, .135, .3, dvd.H, 0, DVD.pal, 6);
  tas(D, boite, M, 6, .19, .015, .135, 0, 0, .45, DVD.pal, 14);                                                              // des DVD par terre

  // le coin télé : meuble bas, grand écran, PS5, et un tableau au-dessus
  const V = new THREE.Group(); V.position.set(4.745, 0, 2.85); V.rotation.y = -Math.PI / 2; scene.add(V);
  coinTele(V, { M, boite });
  canapeEtTable(scene, { M, boite });

  // au-dessus de la télé : une affiche abstraite, du genre qu'on achète en voyage et qu'on garde
  const print = toileTexte(480, 320, (x, w, h) => {
    x.fillStyle = '#e8dfc8'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#c8572f'; x.beginPath(); x.arc(w * .34, h * .46, h * .3, 0, 7); x.fill();
    x.fillStyle = '#2f4a5a'; x.beginPath(); x.arc(w * .62, h * .78, h * .36, Math.PI, 0); x.fill();
    x.fillStyle = '#d9a23a'; x.fillRect(w * .68, h * .14, w * .16, h * .34);
    x.strokeStyle = '#1b1a17'; x.lineWidth = 3; x.beginPath(); x.moveTo(w * .08, h * .86); x.lineTo(w * .92, h * .86); x.stroke();
    x.beginPath(); x.moveTo(w * .08, h * .9); x.lineTo(w * .5, h * .9); x.stroke();
  });
  const aff = new THREE.Group(); aff.position.set(4.97, 2.2, 2.85); aff.rotation.y = -Math.PI / 2; scene.add(aff);
  boite(1.12, .78, .04, M('#1d1b19', { roughness: .6 }), 0, 0, 0, aff).castShadow = false;
  const feuille = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .667), new THREE.MeshStandardMaterial({ map: print, emissiveMap: print, emissive: '#ffffff', emissiveIntensity: .4, roughness: .9 }));
  feuille.position.z = .021; aff.add(feuille);
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
    const mac = new THREE.Group(); mac.position.set(-.04, .79, .01); mac.rotation.y = .06; mac.scale.setScalar(1.2); g.add(mac);
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
    const lueur = new THREE.PointLight('#e6e4ff', .4, 1.2, 1.6); lueur.position.set(0, .16, .2); capot.add(lueur);
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
    const chaise = new THREE.Group(); chaise.position.set(.1, 0, .75); chaise.rotation.y = .25; g.add(chaise);
    boite(.46, .05, .44, M('#3a3a3d'), 0, .46, 0, chaise); boite(.46, .5, .05, M('#3a3a3d'), 0, .75, .22, chaise);
    const pied2 = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .44, 6), metal); pied2.position.y = .22; chaise.add(pied2);
    return { anime(temps, eveil) { ampoule.intensity = 1.2 + eveil * .8; } };
  },

  // Music Discovery : la platine, le disque qui tourne, deux enceintes
  platine(g, { M, boite }) {
    const meuble = M('#4a3527', { roughness: .7 }), noir = M('#1d1c1f', { roughness: .5 });
    boite(1.9, .62, .5, meuble, 0, .31, 0, g);
    for (let i = 0; i < 8; i++) boite(.04, .28, .2, M(['#c8572f', '#2f4a5a', '#d9a23a', '#7b3b2e', '#e6dcc2', '#4f7a46', '#1d1c1f', '#9a8f78'][i]), -.8 + i * .055, .17, .05, g);
    boite(.62, .08, .44, M('#2a2420', { roughness: .4 }), .05, .66, 0, g);
    const plateau = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .02, 24), metal()); plateau.position.set(-.02, .71, 0); g.add(plateau);
    const disque = new THREE.Group(); disque.position.set(-.02, .725, 0); g.add(disque);
    const vinyle = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .006, 32), M('#111012', { roughness: .25, flatShading: false })); disque.add(vinyle);
    const rond = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .008, 16), new THREE.MeshStandardMaterial({ map: toileTexte(128, 128, (x) => {
      const d = x.createConicGradient ? x.createConicGradient(0, 64, 64) : null;
      if (d) { ['#9fd8ff', '#f0a6d8', '#ffe08a', '#9fd8ff'].forEach((c, i) => d.addColorStop(i / 3, c)); x.fillStyle = d; } else x.fillStyle = '#9fd8ff';
      x.fillRect(0, 0, 128, 128); x.fillStyle = '#111'; x.beginPath(); x.arc(64, 64, 6, 0, 7); x.fill();
    }) })); rond.position.y = .002; disque.add(rond);
    const bras = new THREE.Group(); bras.position.set(.24, .72, -.15); g.add(bras);
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .3, 5), metal()); tige.rotation.set(Math.PI / 2, 0, 0); tige.position.set(-.04, .03, .13); tige.rotation.y = -.35; bras.add(tige);
    function metal() { return M('#b9b6ae', { metalness: .6, roughness: .35 }); }
    // les enceintes
    [-1, 1].forEach(c => {
      const e = new THREE.Group(); e.position.set(c * .72, .62, 0); g.add(e);
      boite(.34, .5, .3, noir, 0, .25, 0, e);
      [.33, .14].forEach((y, i) => { const hp = new THREE.Mesh(new THREE.CylinderGeometry(i ? .06 : .1, i ? .06 : .1, .02, 14), M('#3a3a3d', { roughness: .3 })); hp.rotation.x = Math.PI / 2; hp.position.set(0, y, .155); e.add(hp); e['hp' + i] = hp; });
    });
    let v = 0;
    return {
      anime(temps, eveil, secousse, dt) {
        v += ((.3 + eveil * 3.2 + secousse * 12) - v) * Math.min(1, dt * 2);
        disque.rotation.y -= v * dt;
        bras.rotation.y = -.25 * Math.min(1, eveil * 1.2);
      },
    };
  },

  // Cite 3 Chinois : le globe sur son tabouret, trois punaises lumineuses
  globe(g, { M, boite }) {
    const tabouret = M('#6b4a32', { roughness: .7 });
    const assise = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 12), tabouret); assise.position.y = .62; g.add(assise);
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .62, 5), tabouret); const a = i * 2.1; p.position.set(Math.cos(a) * .2, .31, Math.sin(a) * .2); p.rotation.set(Math.sin(a) * .12, 0, -Math.cos(a) * .12); g.add(p); }
    // des livres sous le globe
    ['#2f4a5a', '#c8572f', '#d9a23a'].forEach((c, i) => boite(.34 - i * .03, .05, .24, M(c), 0, .67 + i * .05, 0, g).rotation.y = i * .25);
    const support = new THREE.Group(); support.position.y = .8; g.add(support);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .04, 12), M('#8c6a3c', { metalness: .5, roughness: .4 })); base.position.y = .02; support.add(base);
    const axe = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .16, 6), M('#8c6a3c', { metalness: .5 })); axe.position.y = .1; support.add(axe);
    const geo = sansIndex(new THREE.IcosahedronGeometry(.26, 3));
    const p = geo.attributes.position, coul = [];
    for (let i = 0; i < p.count; i += 3) {
      const cx = p.getX(i) + p.getX(i + 1) + p.getX(i + 2), cy = p.getY(i) + p.getY(i + 1) + p.getY(i + 2), cz = p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2);
      const terre = Math.sin(cx * 11) + Math.sin(cy * 9 + cz * 5) + Math.cos(cz * 12 - cx * 4) > .7;
      const c = new THREE.Color(terre ? '#c9b27a' : '#3f6f8f');
      for (let j = 0; j < 3; j++) coul.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3));
    const boule = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, flatShading: true }));
    const pivot = new THREE.Group(); pivot.position.y = .44; pivot.rotation.z = .41; support.add(pivot); pivot.add(boule);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(.3, .01, 5, 24, Math.PI), M('#8c6a3c', { metalness: .5 })); arc.rotation.z = Math.PI / 2; pivot.add(arc);
    const feux = [[.5, .6, .62], [-.7, .1, .7], [.1, -.5, .86]].map(v => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffc96b' }));
      f.position.set(...v).normalize().multiplyScalar(.265); boule.add(f); return f;
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

  // Fun facts : le cabinet de curiosités contre le mur
  cabinet(g, { M, boite }) {
    const bois = M('#5a3c26', { roughness: .7 }), fond = M('#3a2819');
    const c = new THREE.Group(); g.add(c);
    boite(1.3, .08, .5, bois, 0, .04, 0, c); boite(1.3, .08, .5, bois, 0, 2, 0, c);
    boite(.08, 2, .5, bois, -.61, 1.02, 0, c); boite(.08, 2, .5, bois, .61, 1.02, 0, c);
    boite(1.2, 2, .04, fond, 0, 1.02, -.23, c);
    [.5, .95, 1.42].forEach(y => boite(1.16, .04, .44, bois, 0, y, 0, c));
    const trucs = [
      [new THREE.IcosahedronGeometry(.1, 0), '#d8b04a', -.3, .62], [new THREE.TetrahedronGeometry(.12, 0), '#6f9a6a', .1, .63], [new THREE.TorusGeometry(.08, .03, 6, 10), '#b8473a', .35, .62],
      [new THREE.BoxGeometry(.12, .2, .12), '#8aa0b8', -.32, 1.07], [new THREE.OctahedronGeometry(.11, 0), '#e6dcc2', .05, 1.09], [new THREE.ConeGeometry(.08, .2, 6), '#7e5aa0', .34, 1.07],
      [new THREE.DodecahedronGeometry(.1, 0), '#c8572f', -.25, 1.54], [new THREE.CylinderGeometry(.06, .06, .2, 8), '#a3b5ab', .08, 1.54], [new THREE.SphereGeometry(.09, 8, 6), '#d9a23a', .35, 1.53],
      [new THREE.BoxGeometry(.5, .14, .2), '#2f4a5a', -.15, .17], [new THREE.BoxGeometry(.3, .18, .2), '#7b3b2e', .3, .18],
    ].map(([geo, coul, x, y]) => { const m = new THREE.Mesh(geo, M(coul, { roughness: .5 })); m.position.set(x, y, .02); c.add(m); return m; });
    const porte = cote => {
      const p = new THREE.Group(); p.position.set(cote * .63, 1.02, .25); c.add(p);
      const v = boite(.6, 1.96, .04, bois, -cote * .3, 0, 0, p);
      boite(.48, 1.7, .01, M('#c9d4d6', { transparent: true, opacity: .35, roughness: .1 }), -cote * .3, 0, .025, p);
      const poignee = new THREE.Mesh(new THREE.SphereGeometry(.025, 6, 4), M('#d8b04a', { metalness: .6 })); poignee.position.set(-cote * .55, 0, .04); p.add(poignee);
      return p;
    };
    const pg = porte(-1), pd = porte(1);
    return {
      anime(temps, eveil, secousse) {
        const a = Math.min(1, eveil * 1.1) * 1.7;
        pg.rotation.y = -a; pd.rotation.y = a;
        trucs.forEach((o, i) => { if (i < 9) o.rotation.y = temps * (.3 + i * .05) * eveil + secousse * 8; });
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
