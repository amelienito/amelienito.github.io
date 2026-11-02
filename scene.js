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

export function demarrer({ toile, etapes, surEtape, reduit }) {
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

  /* ─────────── les créations ─────────── */
  const objets = [];
  etapes.forEach((e, k) => {
    if (!k) return;
    const place = PLACES[e.forme];
    const g = new THREE.Group();
    g.position.set(...place.pos); g.rotation.y = place.face;
    scene.add(g);
    const reflet = new THREE.PointLight(e.couleur, 0, 3.2, 1.5); reflet.position.set(0, 1.9, 1.1); g.add(reflet);
    const o = FORMES[e.forme](g, { M, boite });
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    objets.push({ k, g, place, reflet, anime: o.anime || (() => {}), caresser: o.caresser || null, eveil: 0, secousse: 0 });
  });
  // les objets qui ne sont pas (ou plus) une étape restent dans la pièce, en décor
  // (ex. l'ordi allumé sur onsenbranle.fr, sorti de la sélection principale)
  for (const forme of ['ordi']) {
    if (etapes.some(e => e.forme === forme)) continue;
    const place = PLACES[forme], g = new THREE.Group();
    g.position.set(...place.pos); g.rotation.y = place.face; scene.add(g);
    FORMES[forme](g, { M, boite });
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  }

  /* ─────────── la caméra ─────────── */
  let t = 0, cibleT = 0;
  if (cliche) { const i = etapes.findIndex(e => e.id === cliche); if (i >= 0) t = cibleT = i; }
  const souris = new THREE.Vector2();
  const vues = etapes.map((e, k) => {
    if (!k) return { pos: new THREE.Vector3(0, 3.1, 8.4), regard: new THREE.Vector3(0, 1.1, -1.2) };
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
  addEventListener('wheel', e => { if (document.body.classList.contains('liste')) return; e.preventDefault(); aller(cibleT + Math.max(-.6, Math.min(.6, e.deltaY / 500))); }, { passive: false });
  let doigt = null;
  toile.addEventListener('touchstart', e => { doigt = { y: e.touches[0].clientY, x: e.touches[0].clientX, t0: cibleT, bouge: false }; }, { passive: true });
  toile.addEventListener('touchmove', e => {
    if (!doigt) return;
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
    for (const o of objets) { const h = lancer.intersectObject(o.g, true)[0]; if (h && h.distance < d) { d = h.distance; mieux = o; } }
    return mieux;
  };
  toile.addEventListener('click', e => {
    const o = touche(e.clientX, e.clientY); if (!o) return;
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
      o.reflet.intensity = o.eveil * 3.5 + (survol === o ? 1.5 : 0);
      o.anime(temps, o.eveil, o.secousse, dt);
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
  // Onsenbranle : le bureau, l'ordi allumé sur le blog
  ordi(g, { M, boite }) {
    const bois = M('#6b4a32', { roughness: .7 }), metal = M('#2b2b2e', { roughness: .4, metalness: .3 });
    boite(1.7, .06, .8, bois, 0, .76, 0, g);
    [[-.8, -.35], [.8, -.35], [-.8, .35], [.8, .35]].forEach(([x, z]) => boite(.06, .76, .06, bois, x, .38, z, g));
    // l'écran
    boite(.12, .32, .08, metal, 0, .95, -.15, g); boite(.34, .02, .2, metal, 0, .8, -.15, g);
    boite(.92, .58, .05, metal, 0, 1.33, -.17, g);
    const ecran = new THREE.Mesh(new THREE.PlaneGeometry(.84, .5), new THREE.MeshBasicMaterial({ map: toileTexte(512, 305, (x, w, h) => {
      x.fillStyle = '#f4efe4'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1b1a17'; x.fillRect(0, 0, w, 34);
      x.fillStyle = '#f4efe4'; x.font = '600 17px "EB Garamond", Georgia, serif'; x.fillText('onsenbranle.fr', 16, 23);
      x.fillStyle = '#1b1a17'; x.font = '700 36px "Cormorant Garamond", Georgia, serif'; x.fillText('En vrai,', 24, 92); x.fillText('on s’en branle', 24, 132);
      x.fillStyle = '#b8b0a0'; for (let i = 0; i < 6; i++) x.fillRect(24, 160 + i * 20, (i % 3 === 2 ? 260 : 440) * .9, 7);
      x.fillStyle = '#c8572f'; x.fillRect(24, 148, 60, 4);
    }) }));
    ecran.position.set(0, 1.33, -.143); g.add(ecran);
    // clavier, souris, tasse, carnet
    boite(.5, .02, .16, M('#e9e4d8'), -.05, .8, .14, g);
    boite(.07, .02, .1, M('#e9e4d8'), .34, .8, .16, g);
    const tasse = new THREE.Mesh(new THREE.CylinderGeometry(.05, .045, .1, 10), M('#c8572f')); tasse.position.set(.62, .84, -.05); g.add(tasse);
    boite(.24, .02, .3, M('#2f4a5a'), -.6, .8, .05, g).rotation.y = .3;
    // la lampe de bureau
    const lampe = new THREE.Group(); lampe.position.set(-.65, .79, -.25); g.add(lampe);
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
    // la main qui la caresse, et les petits cœurs
    const main = new THREE.Group(); main.visible = false; g.add(main);
    const peau = M('#8c5737', { roughness: .65 });
    const paume = new THREE.Mesh(new THREE.BoxGeometry(.13, .035, .15), peau); main.add(paume);
    const doigts = new THREE.Mesh(new THREE.BoxGeometry(.12, .03, .09), peau); doigts.position.set(0, -.012, .11); doigts.rotation.x = .35; main.add(doigts);
    const pouce = new THREE.Mesh(new THREE.BoxGeometry(.03, .025, .07), peau); pouce.position.set(.075, -.01, .02); pouce.rotation.y = -.5; main.add(pouce);
    const poignet = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .14, 8), M('#1f6b47', { roughness: .9 })); poignet.rotation.x = Math.PI / 2; poignet.position.z = -.13; main.add(poignet);
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
        main.visible = c > .02;
        if (main.visible) { main.position.set(-.06 + Math.sin(caresse * 6) * .14, .45 + Math.abs(Math.cos(caresse * 6)) * .02, -.04); main.rotation.set(0, Math.PI / 2, Math.sin(caresse * 6) * .1); main.scale.setScalar(Math.max(.01, c) * 1.35); }   // la main passe et repasse sur son dos
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
