/* ════════════════════════════════════════════════════════════════════
   OSB CORPORATION — la pièce
   Une chambre-bureau vue comme une maison de poupée : chaque création
   est un objet de la pièce (l'ordi, la chaîne CD, le globe, le panier de
   Talya, le pupitre de quiz, la cible, le carton). On passe de l'un à l'autre
   à la molette, au doigt ou aux flèches ; un clic sur l'objet l'ouvre.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from './vendor/three.min.js';   // three.js compacté (vendor/three.min.js, refait avec esbuild depuis three.module.js)

/* où se trouve chaque objet dans la pièce, et d'où on le regarde
   pos : position au sol · face : direction vers laquelle il est tourné (radians)
   vue : [recul, hauteur de l'œil, hauteur du regard] */
const PLACES = {
  ordi:       { pos: [-2.6, 0, -3.35], face: 0,            vue: [2.3, 1.55, 1.05] },
  platine:    { pos: [1.9, 0, -3.5],   face: 0,            vue: [2.05, 1.38, .82] },
  globe:      { pos: [-4.1, 0, -.7],   face: Math.PI / 2,  vue: [2.75, 1.64, 1.34] },
  talya:      { pos: [3.1, 0, 1.1],    face: -2.4,         vue: [2.4, 1.35, .35] },
  quiz:       { pos: [4.5, 0, -1.6],   face: -Math.PI / 2, vue: [3.0, 1.6, 1.24] },
  flechettes: { pos: [-4.92, 0, 1.9],  face: Math.PI / 2,  vue: [2.6, 1.6, 1.55] },
  carton:     { pos: [-1.6, 0, 2.3],   face: .5,           vue: [2.2, 1.45, .35] },
};

// la pièce était un hangar (10 m sur 8,4) : on la resserre, les meubles gardent leur taille, tout se rapproche
const SX = .78, SZ = .78, HAUT = 2.85;
Object.values(PLACES).forEach(p => { p.pos[0] *= SX; p.pos[2] *= SZ; });

export function demarrer({ toile, etapes, surEtape, reduit, decors = {}, surDecor = () => {}, surApproche = () => {}, depart = 0, bloque = () => false, surBloque = () => {}, surPret = () => {} }) {
  const N = etapes.length;
  const cliche = new URLSearchParams(location.search).get('cliche');

  /* ─────────── moteur ─────────── */
  const tactile = matchMedia('(pointer: coarse)').matches;
  // sur un téléphone à écran très fin, l'anticrénelage coûte cher pour rien : les pixels sont déjà minuscules
  const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: !(tactile && (devicePixelRatio || 1) >= 2), preserveDrawingBuffer: !!cliche, powerPreference: tactile ? 'low-power' : 'default' });
  let qualite = 1;   // baisse toute seule si les images arrivent trop espacées (voir la boucle)
  rendu.shadowMap.enabled = true;
  rendu.shadowMap.type = THREE.PCFShadowMap;
  rendu.shadowMap.autoUpdate = false;   // recalculées 5 fois par seconde (voir la boucle)
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#15110d');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
  // la taille de la pièce suit toujours celle de l'écran. Sur iPhone, la page peut démarrer avant que l'écran ait sa vraie
  // taille (ouverte depuis une appli, barre d'adresse qui bouge) : sans nouvelle mesure, l'image restait écrasée en largeur.
  let tw = 0, th = 0, vues = [], fovObjet = 40, fovAccueil = 30;   // (les vues de la caméra : voir calculerVues)
  function taille() {
    const w = toile.clientWidth || innerWidth, h = toile.clientHeight || innerHeight;
    if (!w || !h || (w === tw && h === th && !taille.force)) return;
    taille.force = false;
    tw = w; th = h;
    // un écran Retina en plein écran, c'est 5 millions de pixels : on en calcule au plus ~2,3 (1,5 sur téléphone), le reste ne se voit pas
    rendu.setPixelRatio(Math.max(.75, Math.min(devicePixelRatio || 1, 2, Math.sqrt((tactile ? 1.5e6 : 2.3e6) / (w * h))) * qualite));
    rendu.setSize(w, h, false);
    camera.aspect = w / h;
    calculerVues(); camera.updateProjectionMatrix();
  }
  addEventListener('resize', taille);
  addEventListener('orientationchange', () => setTimeout(taille, 250));
  addEventListener('pageshow', taille);
  if (window.visualViewport) visualViewport.addEventListener('resize', taille);
  if (window.ResizeObserver) new ResizeObserver(taille).observe(toile);
  taille();

  /* ─────────── la lumière : un plafonnier chaud, la nuit par la fenêtre ─────────── */
  scene.add(new THREE.HemisphereLight('#ffe4c4', '#6b4a2e', 1.0));
  const plafonnier = new THREE.SpotLight('#ffcf96', 68, 14, 1.15, .6, 1.4);
  plafonnier.position.set(0, 3.6, -.3); plafonnier.target.position.set(0, 0, -.5);
  plafonnier.castShadow = true; plafonnier.shadow.mapSize.set(tactile ? 512 : 1024, tactile ? 512 : 1024); plafonnier.shadow.bias = -.0008;
  scene.add(plafonnier, plafonnier.target);
  const nuit = new THREE.DirectionalLight('#9aa8d0', .22); nuit.position.set(-1, 3, -8); scene.add(nuit);
  if (!tactile) { const braise = new THREE.PointLight('#ff9a52', 7, 9, 1.6); braise.position.set(2.2, 1.6, .6); scene.add(braise); }   // une lueur chaude côté canapé (pas sur téléphone : une lampe de plus coûte)

  /* ─────────── la pièce ─────────── */
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .85, metalness: 0, flatShading: true }, o));
  const boite = (w, h, d, mat, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };
  // le parquet, lame par lame
  const bois = ['#8a5d3b', '#94643f', '#7f5534', '#9a6b45'].map(c => M(c, { roughness: .75 }));
  for (let i = 0; i < 20; i++) { const l = boite(.5, .06, 8.4, bois[i % 4], -4.75 + i * .5, -.03, 0); l.receiveShadow = true; l.userData.structure = 'sol'; }
  // les murs (sans mur de face ni plafond : on regarde comme dans une maison de poupée)
  const peinture = M('#dcc19a', { flatShading: false }), plinthe = M('#efe2cb');
  boite(10.2, 3.2, .12, peinture, 0, 1.6, -4.25).userData.structure = 'fond';
  boite(.12, 3.2, 8.6, peinture, -5.06, 1.6, 0).userData.structure = 'cote';
  boite(.12, 3.2, 8.6, peinture, 5.06, 1.6, 0).userData.structure = 'cote';
  boite(10.1, .12, .05, plinthe, 0, .06, -4.17).userData.structure = 'sol'; boite(.05, .12, 8.4, plinthe, -4.98, .06, 0).userData.structure = 'sol'; boite(.05, .12, 8.4, plinthe, 4.98, .06, 0).userData.structure = 'sol';
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
  plante(scene, M, 4.66, -3.85);   // un ficus lyrata dans le coin du fond, à droite
  // aux murs : ses images, encadrées
  const chargeur = new THREE.TextureLoader();
  function tableau(url, w, h, x, y, z, ry, { cadre = '#1d1b19', bord = .05, epais = .045, dore = false, marge = .055, passe = '#f3eee2', lum = .42 } = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    // la baguette : un cadre épais aux angles, qui dépasse du mur ; dedans un passe-partout crème ; puis l'image, un peu en retrait
    const matCadre = M(cadre, dore ? { metalness: .55, roughness: .38, flatShading: false } : { roughness: .55, flatShading: false });
    const W = w + 2 * (marge + bord), H = h + 2 * (marge + bord);
    [[W, bord, 0, (H - bord) / 2], [W, bord, 0, -(H - bord) / 2], [bord, H - 2 * bord, -(W - bord) / 2, 0], [bord, H - 2 * bord, (W - bord) / 2, 0]].forEach(([a, b, px, py]) => { boite(a, b, epais, matCadre, px, py, epais / 2, g).castShadow = true; });
    if (marge > 0) boite(w + 2 * marge, h + 2 * marge, .01, M(passe, { roughness: .95 }), 0, 0, .006, g).castShadow = false;
    else boite(w, h, .01, M('#1a1714'), 0, 0, .006, g).castShadow = false;
    const epaisImage = .012;
    const mat = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: .85 });
    // un peu de lumière propre, sinon le haut des murs les avale
    chargeur.load(url, tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; mat.map = mat.emissiveMap = tex; mat.color.set('#ffffff'); mat.emissive.set('#ffffff'); mat.emissiveIntensity = lum; mat.needsUpdate = true; });
    const image = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); image.position.z = epaisImage; image.receiveShadow = true; g.add(image);
    image.userData.garder = true;   // son image arrive plus tard : on ne la fusionne pas
  }
  tableau('img/murs/chief-keef.jpg', 1.0, .749, 1.9, 1.66, -4.18, 0, { cadre: '#b08a3e', bord: .07, epais: .06, dore: true, marge: .06 });   // Chief Keef au jardin d'Éden, au-dessus de la chaîne CD
  tableau('img/murs/koi.jpg', .72, .72, -2.6, 1.78, -4.18, 0, { cadre: '#5a3820', bord: .05 });                                     // la carpe géante, au-dessus du bureau
  tableau('img/murs/i-love-ugly.jpg', .9, .602, -4.99, 1.86, -.7, Math.PI / 2, { cadre: '#161514', bord: .045, lum: .55 });   // I Love Ugly (Chester Watson), au-dessus du globe
  tableau('img/murs/evil-dead-2.jpg', .58, .899, 4.99, 1.86, -1.6, -Math.PI / 2, { cadre: '#b8282e', bord: .035, marge: .045, lum: .75 });   // Evil Dead 2, au-dessus du pupitre de quiz

  meubler(scene, { M, boite });
  tableau('img/murs/seta.jpg', .76, .76, 4.99, 1.98, 2.85, -Math.PI / 2, { cadre: '#b07a48', bord: .05 });   // Seta, au-dessus de la télé
  resserrer(scene);
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
    objets.push({ k, g, place, selection: surbrillance(g, e.halo || e.couleur), anime: o.anime || (() => {}), caresser: o.caresser || null, eveil: 0, secousse: 0 });
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
    if (decors[forme]) decorsCliquables.push({ g, forme, decor: decors[forme], selection: surbrillance(g, '#e6dcc2') });
  }

  /* ─────────── la caméra ─────────── */
  let t = 0, cibleT = 0;
  if (cliche) { const i = etapes.findIndex(e => e.id === cliche); if (i >= 0) t = cibleT = i; }
  else if (depart > 0 && depart < N) t = cibleT = depart;   // retour d'une création : on reprend devant son objet
  const souris = new THREE.Vector2();
  // l'objectif : un « 50 mm » plutôt qu'un grand-angle. À l'accueil, on recule loin avec un objectif plus long :
  // la pièce entière, sans les bords étirés ; devant un objet, un peu plus large. Sur téléphone (en hauteur), plus large.
  function calculerVues() {
    const a = camera.aspect || 1, portrait = a < .8;
    fovAccueil = portrait ? 52 : 30; fovObjet = portrait ? 58 : 40;
    const allonge = Math.tan(THREE.MathUtils.degToRad(portrait ? 33 : 25)) / Math.tan(THREE.MathUtils.degToRad(fovObjet / 2));   // on recule d'autant que l'objectif s'est resserré
    const demi = Math.atan(Math.tan(THREE.MathUtils.degToRad(fovAccueil / 2)) * a);   // le demi-angle horizontal
    // assez loin pour que le bord avant de la pièce (le plus proche) tienne en entier : rien de coupé ni d'étiré au premier plan
    const regardA = new THREE.Vector3(.2, portrait ? 1.1 : 1.22, -.55), largeur = portrait ? 5.6 : 8.4, avant = 3.3 - regardA.z;
    const dir = new THREE.Vector3(0, .25, 1).normalize();
    const d = Math.min(22, ((largeur / 2) / Math.tan(demi) + avant) / dir.z);
    vues = etapes.map((e, k) => {
      if (!k) return { pos: regardA.clone().addScaledVector(dir, d), regard: regardA.clone(), fov: fovAccueil };
      const p = PLACES[e.forme], [recul, oeil, regard] = p.vue;
      const n = new THREE.Vector3(Math.sin(p.face), 0, Math.cos(p.face));
      const base = new THREE.Vector3(...p.pos);
      return { pos: base.clone().addScaledVector(n, recul * allonge).setY(oeil), regard: base.clone().setY(regard), fov: fovObjet };
    });
    calculerVues.allonge = allonge;
  }
  calculerVues.allonge = 1;
  if (camera.aspect) calculerVues();
  const regard = new THREE.Vector3(), _vers = new THREE.Vector3();
  function placer(temps) {
    const k = Math.floor(t), f = t - k, b = Math.min(N - 1, k + 1);
    const l = f * f * (3 - 2 * f);
    // entre deux objets on recule un peu, comme quelqu'un qui traverse la pièce
    const recul = Math.sin(l * Math.PI) * .35;
    camera.position.lerpVectors(vues[k].pos, vues[b].pos, l);
    regard.lerpVectors(vues[k].regard, vues[b].regard, l);
    const fov = vues[k].fov + (vues[b].fov - vues[k].fov) * l;
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const vers = _vers.copy(camera.position).sub(regard).setY(0).normalize();   // (un seul vecteur réutilisé : pas de déchets à chaque image)
    camera.position.addScaledVector(vers, recul * 2).y += recul;
    // l'approche d'un objet caché (l'ordi) : on glisse depuis la vue en cours jusqu'à lui
    if (melange > .0005 && approche) { const l2 = melange * melange * (3 - 2 * melange); camera.position.lerp(approche.pos, l2); regard.lerp(approche.regard, l2); }
    camera.position.x += souris.x * .18; camera.position.y += souris.y * .1 + Math.sin(temps * .6) * .015;
    camera.lookAt(regard);
  }
  let approche = null, melange = 0;
  function vueDe(forme, [recul, oeil, haut]) {
    const p = PLACES[forme], n = new THREE.Vector3(Math.sin(p.face), 0, Math.cos(p.face)), base = new THREE.Vector3(...p.pos);
    return { pos: base.clone().addScaledVector(n, recul * calculerVues.allonge).setY(oeil), regard: base.clone().setY(haut) };
  }
  function quitterApproche() { if (approche && approche.actif) { approche.actif = false; surApproche(null); } }

  /* ─────────── les commandes ─────────── */
  let repos = null;
  const aller = v => { quitterApproche(); cibleT = Math.max(0, Math.min(N - 1, v)); clearTimeout(repos); repos = setTimeout(() => { cibleT = Math.round(cibleT); }, 160); };
  // la molette ou le pavé tactile : un geste = une étape. Un pavé tactile envoie des dizaines d'événements par geste
  // (et continue sur sa lancée après qu'on a levé le doigt) : on avance d'une étape au début du geste, puis on ignore
  // la suite, sauf si on relance (le mouvement repart plus fort, ou dans l'autre sens) ou si on tourne une vraie molette.
  let cumul = 0, dernierEv = 0, pasA = 0, dernierD = 0;
  addEventListener('wheel', e => {
    if (document.body.classList.contains('liste')) return;
    e.preventDefault();
    if (bloque()) { surBloque(); return; }
    const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 600 : e.deltaY, m = performance.now();
    const calme = m - dernierEv > 200; dernierEv = m;
    if (calme) { cumul = 0; pasA = 0; }
    if (pasA) {
      const depuis = m - pasA;
      const relance = (Math.sign(d) !== Math.sign(dernierD) && Math.abs(d) > 4)
        || (depuis > 300 && Math.abs(d) > Math.abs(dernierD) * 1.8 + 6)
        || (depuis > 700 && Math.abs(d) >= 40);
      dernierD = d;
      if (!relance) return;
      pasA = 0; cumul = 0;
    }
    dernierD = d; cumul += d;
    if (Math.abs(cumul) >= 30) { const pas = Math.sign(cumul); cumul = 0; pasA = m; quitterApproche(); cibleT = Math.max(0, Math.min(N - 1, Math.round(cibleT) + pas)); clearTimeout(repos); }
  }, { passive: false });
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
    if (o.decor) {
      if (approche && approche.actif && approche.o === o) { o.secousse = 1; surDecor(o.decor); return; }   // déjà devant : on entre
      approche = Object.assign(vueDe(o.forme, o.decor.vue || [1.35, 1.48, .98]), { o, actif: true }); surApproche(o.decor); return;
    }
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
    melange += ((approche && approche.actif ? 1 : 0) - melange) * (reduit ? 1 : 1 - Math.pow(.006, dt));
    if (approche && !approche.actif && melange < .0005) approche = null;
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
      o.anime(temps, o.eveil, o.secousse, cliche ? .4 : dt);   // (vignettes : les objets prennent tout de suite leur pose)
    }
    // la sélection : l'objet survolé s'éclaire franchement, celui devant lequel on se trouve à peine ; en douceur (~150 ms)
    for (const o of [...objets, ...decorsCliquables]) {
      const vise = survol === o ? 1 : o.eveil ? o.eveil * .16 : 0;
      o.selection.force.value += (vise - o.selection.force.value) * (reduit ? 1 : Math.min(1, dt * 12));
    }
    if (m - derniereOmbre > 200 || cliche) { derniereOmbre = m; rendu.shadowMap.needsUpdate = true; }   // 5 fois par seconde : seuls de petits objets bougent
    rendu.render(scene, camera);
    if (!pret) { pret = true; surPret(); }
    if (!cliche) { suivreFluidite(m); requestAnimationFrame(image); }
  }
  if (cliche) {
    window.__hubDebug = { scene, camera, THREE };   // (pour les vérifications)
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
    quitterApproche: () => quitterApproche(),
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

// l'écran de la télé : un film en pause (pas les créations d'Amélien : elles ont chacune leur place dans la pièce).
// Un plan large au crépuscule, en cinémascope, la barre de lecture et le sous-titre de la réplique en cours.
function ecranFilm() {
  const W = 1280, H = 720, S = '"Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif';
  return toileTexte(W, H, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    const haut = 92, bas = h - 92;   // les bandes noires du cinémascope
    x.save(); x.beginPath(); x.rect(0, haut, w, bas - haut); x.clip();
    const ciel = x.createLinearGradient(0, haut, 0, bas); ciel.addColorStop(0, '#2b2a4a'); ciel.addColorStop(.45, '#b4566a'); ciel.addColorStop(.72, '#f29a5c'); ciel.addColorStop(1, '#f6c27a');
    x.fillStyle = ciel; x.fillRect(0, haut, w, bas - haut);
    x.fillStyle = 'rgba(255,236,190,.9)'; x.beginPath(); x.arc(w * .63, bas - 150, 46, 0, 7); x.fill();   // le soleil bas
    const colline = (y0, amp, f, ph, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, bas); for (let X = 0; X <= w; X += 16) x.lineTo(X, y0 + Math.sin(X * f + ph) * amp + Math.sin(X * f * 2.7 + ph) * amp * .35); x.lineTo(w, bas); x.fill(); };
    colline(bas - 120, 22, .006, 1.2, '#8a4a5a'); colline(bas - 80, 18, .009, 2.6, '#5a2f45'); colline(bas - 40, 10, .012, .4, '#2a1828');
    // deux silhouettes sur la crête, de dos, qui regardent le soleil
    x.fillStyle = '#1c1020';
    [[w * .4, 1], [w * .44, .92]].forEach(([cx, k]) => { const y = bas - 48; x.beginPath(); x.arc(cx, y - 66 * k, 11 * k, 0, 7); x.fill(); arrondi(x, cx - 13 * k, y - 56 * k, 26 * k, 56 * k, 9 * k); x.fill(); });
    x.restore();
    // le sous-titre, et la lecture en pause
    x.font = `500 30px ${S}`; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.75)'; x.fillStyle = '#fff';
    x.strokeText('— On reste encore un peu ?', w / 2, bas - 26); x.fillText('— On reste encore un peu ?', w / 2, bas - 26);
    x.textAlign = 'left';
    x.fillStyle = 'rgba(255,255,255,.28)'; arrondi(x, 72, h - 54, w - 144, 6, 3); x.fill();
    x.fillStyle = '#fff'; arrondi(x, 72, h - 54, (w - 144) * .62, 6, 3); x.fill(); x.beginPath(); x.arc(72 + (w - 144) * .62, h - 51, 9, 0, 7); x.fill();
    x.font = `600 20px ${S}`; x.globalAlpha = .85; x.fillText('1:12:48', 72, h - 18); x.textAlign = 'right'; x.fillText('1:58:03', w - 72, h - 18); x.textAlign = 'left'; x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(w / 2 - 20, h / 2 - 30, 14, 60); x.fillRect(w / 2 + 6, h / 2 - 30, 14, 60);   // pause
  });
}

// un CD vu côté gravure : l'argent, les reflets arc-en-ciel qui tournent, le moyeu transparent et son trou
function texteCD() {
  return toileTexte(256, 256, (x, w, h) => {
    const c = w / 2;
    const base = x.createRadialGradient(c, c, 20, c, c, c); base.addColorStop(0, '#e8ebef'); base.addColorStop(1, '#b9bec6'); x.fillStyle = base; x.beginPath(); x.arc(c, c, c, 0, 7); x.fill();
    if (x.createConicGradient) {
      const arc = x.createConicGradient(0, c, c); ['rgba(255,120,200,.55)', 'rgba(120,200,255,.55)', 'rgba(170,255,170,.5)', 'rgba(255,240,140,.55)', 'rgba(255,120,200,.55)', 'rgba(120,200,255,.55)', 'rgba(255,120,200,.55)'].forEach((k, i, a) => arc.addColorStop(i / (a.length - 1), k));
      x.globalCompositeOperation = 'overlay'; x.fillStyle = arc; x.beginPath(); x.arc(c, c, c, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
    }
    x.strokeStyle = 'rgba(255,255,255,.35)'; for (let r = 46; r < c; r += 9) { x.lineWidth = 1; x.beginPath(); x.arc(c, c, r, 0, 7); x.stroke(); }
    // la sérigraphie : un arc corail et un arc crème, comme sur les CD des années 2000 (et ça montre qu'il tourne)
    x.lineWidth = 26; x.lineCap = 'round';
    x.strokeStyle = '#e8613f'; x.beginPath(); x.arc(c, c, 72, -.4, 2.2); x.stroke();
    x.strokeStyle = '#f3e6c4'; x.beginPath(); x.arc(c, c, 72, 2.75, 4.1); x.stroke();
    x.fillStyle = '#1a1714'; x.font = '700 15px "IBM Plex Mono", monospace'; x.textAlign = 'center'; x.fillText('MUSIC DISCOVERY', c, c + 64);
    x.fillStyle = '#d9dde2'; x.beginPath(); x.arc(c, c, 40, 0, 7); x.fill();
    x.fillStyle = 'rgba(200,210,220,.55)'; x.beginPath(); x.arc(c, c, 30, 0, 7); x.fill();
    x.fillStyle = '#1a1714'; x.beginPath(); x.arc(c, c, 10, 0, 7); x.fill();
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
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(1.56, .87), new THREE.MeshBasicMaterial({ map: ecranFilm(), toneMapped: false, color: '#e2e2e2' }));
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
  const lamp = new THREE.Group(); lamp.position.set(-3.8, 0, -3.78); g.add(lamp);   // dans le coin du fond, entre la tour à CD et le bureau (plus devant la télé)
  const fer = M('#1d1c1f', { roughness: .5, metalness: .3 });
  [0, 2.094, 4.188].forEach(a => { const p = cylindre(lamp, .008, .008, .98, 5, fer, Math.cos(a) * .1, .48, Math.sin(a) * .1); p.rotation.set(Math.sin(a) * -.1, 0, Math.cos(a) * .1); });
  cylindre(lamp, .008, .008, .16, 5, fer, 0, 1.0, 0);
  const pts = []; for (let i = 0; i <= 26; i++) { const a = i / 26 * Math.PI, r = Math.sin(a) * .27 * (i % 2 ? .96 : 1.02); pts.push(new THREE.Vector2(Math.max(.03, r), -Math.cos(a) * .44)); }
  const papier = new THREE.Mesh(new THREE.LatheGeometry(pts, 22), new THREE.MeshStandardMaterial({ color: '#efd3a6', emissive: '#ffb25e', emissiveIntensity: .62, roughness: 1, side: THREE.DoubleSide }));
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

  // les DVD et Blu-ray, au fond à droite, à côté de la chaîne CD
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
/* la pièce resserrée : chaque meuble se rapproche du centre (position × SX, SZ), sans changer de taille ;
   le sol et les murs, eux, rétrécissent ; les murs restent juste derrière ce qui y est accroché ; le plafond descend */
function resserrer(scene) {
  const k = HAUT / 3.2;
  scene.children.slice().forEach(o => {
    if (o.isLine) { o.geometry.scale(SX, 1, SZ); o.geometry.translate(0, HAUT - 3.2 + .05, 0); return; }   // la guirlande
    const st = o.userData.structure;
    if (st === 'fond') { o.scale.x *= SX; o.scale.y = k; o.position.y = HAUT / 2; o.position.z = -4.19 * SZ - .06; return; }
    if (st === 'cote') { o.scale.z *= SZ; o.scale.y = k; o.position.y = HAUT / 2; o.position.x = Math.sign(o.position.x) * (5.0 * SX + .06); return; }
    o.position.x *= SX; o.position.z *= SZ;
    if (st === 'sol') { o.scale.x *= SX; o.scale.z *= SZ; }
    if (o.isMesh && o.position.y > 2.6 && o.position.y < 3.1) o.position.y += HAUT - 3.2 + .05;   // les ampoules de la guirlande, sous le haut du mur
  });
}

/* un monstera : un pot en terre cuite, de grandes feuilles larges au bout de longues tiges qui s'écartent en gerbe */
function plante(scene, M, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const terre = M('#b5643c', { flatShading: false, roughness: .9 }), bord = M('#a35733', { flatShading: false, roughness: .9 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.21, .16, .38, 22), terre); pot.position.y = .19; g.add(pot);
  const levre = new THREE.Mesh(new THREE.CylinderGeometry(.225, .215, .05, 22), bord); levre.position.y = .375; g.add(levre);
  const sol = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .02, 16), M('#3a2618')); sol.position.y = .39; g.add(sol);
  const soucoupe = new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .03, 22), bord); soucoupe.position.y = .015; g.add(soucoupe);
  const tige = M('#56803f', { flatShading: false });
  const verts = [M('#2f5d34', { flatShading: false, roughness: .55 }), M('#3e7340', { flatShading: false, roughness: .55 }), M('#274f2c', { flatShading: false, roughness: .55 })];
  // la feuille : un cœur large (une sphère aplatie, plus large à la base, une encoche au bout)
  const feuille = new THREE.SphereGeometry(1, 16, 10);
  {
    const pa = feuille.attributes.position;
    for (let i = 0; i < pa.count; i++) { const zz = pa.getZ(i); pa.setX(i, pa.getX(i) * (1 - zz * .18)); if (zz > .85) pa.setZ(i, zz - (1 - Math.abs(pa.getX(i))) * .12); }
    feuille.computeVertexNormals();
  }
  const N = 11, or = Math.PI * (3 - Math.sqrt(5)), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = i * or + .4, loin = .2 + (i % 3) * .07, h = .62 + (i % 4) * .13 + (i / N) * .12;
    _a.set(0, .38, 0); _b.set(Math.cos(a) * loin, h, Math.sin(a) * loin);
    const l = _a.distanceTo(_b), t = new THREE.Mesh(new THREE.CylinderGeometry(.007, .009, l, 6), tige);
    t.position.copy(_a).add(_b).multiplyScalar(.5); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _b.clone().sub(_a).normalize()); g.add(t);
    const pivot = new THREE.Group(); pivot.position.copy(_b); pivot.rotation.y = Math.atan2(Math.cos(a), Math.sin(a)); g.add(pivot);
    const penche = new THREE.Group(); penche.rotation.x = .18 + (i % 3) * .14; pivot.add(penche);
    const taille = .15 + (i % 3) * .025;
    const f = new THREE.Mesh(feuille, verts[i % 3]); f.scale.set(taille * .95, .012, taille * 1.15); f.position.z = taille * 1.05; penche.add(f);
    const nervure = new THREE.Mesh(new THREE.BoxGeometry(.006, .004, taille * 2), tige); nervure.position.set(0, .011, taille * 1.05); penche.add(nervure);
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
}

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
    const chaise = new THREE.Group(); chaise.position.set(.62, 0, .98); chaise.rotation.y = .95; g.add(chaise);   // repoussé de côté, comme si on venait de se lever
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

  // Music Discovery : une chaîne CD de mélomane (lecteur à chargement par le dessus, ampli, enceintes), sur une enfilade en noyer
  platine(g, { M, boite }) {
    /* l'époque du CD, dans le bois de la pièce : un meuble hi-fi bas en noyer (deux cases ouvertes), dessus la chaîne
       (lecteur CD à tiroir ouvert, le disque dedans, et l'ampli à vu-mètres), dessous des CD debout ; deux enceintes
       en noyer à toile beige ; à côté, une tour à CD en bois, pleine */
    const noyer = M('#7a4c2b', { roughness: .8, flatShading: false }), noyerF = M('#63391f', { roughness: .9 }), laiton = M('#c9a25a', { metalness: .7, roughness: .3, flatShading: false });
    const alu = M('#c9cbd0', { metalness: .6, roughness: .3, flatShading: false }), aluF = M('#a9acb2', { metalness: .6, roughness: .35, flatShading: false }), noir = M('#2a2420', { roughness: .75 });
    const toile = M('#d8c7a0', { roughness: 1 });
    const tranches = ['#c8572f', '#2f4a5a', '#d9a23a', '#e6dcc2', '#7b3b2e', '#4f7a46', '#1d1c1f', '#9fd8ff', '#b8473a', '#e9c46a', '#6e5a8a', '#f0a6d8', '#2a2a30', '#d8d4c8'];
    // le meuble : un caisson bas en noyer, deux cases ouvertes séparées par un montant, sur quatre pieds courts
    molle(g, .96, .04, .44, .012, noyer, 0, .56, 0);                                      // le dessus
    boite(.94, .03, .42, noyerF, 0, .1, 0, g);                                           // le fond du bas
    [-.465, 0, .465].forEach(x => boite(.03, .46, .42, noyerF, x, .33, 0, g));          // les côtés et le montant
    boite(.94, .46, .02, noyerF, 0, .33, -.2, g);                                        // le dos
    boite(.9, .015, .4, noyerF, 0, .32, 0, g);                                           // l'étagère du milieu
    [[-.44, -.18], [.44, -.18], [-.44, .18], [.44, .18]].forEach(([x, z]) => { const p = cylindre(g, .02, .014, .09, 8, M('#3a2416'), x, .045, z); p.rotation.z = x < 0 ? .1 : -.1; });
    // dans les cases : des CD debout, tranches vers nous, quelques-uns qui penchent
    [[-.44, .115], [.03, .115], [-.44, .335], [.03, .335]].forEach(([x0, y], c) => { for (let i = 0; i < 31; i++) { const b = boite(.0105, .125, .142, M(tranches[(i * 5 + c * 3) % tranches.length], { roughness: .35 }), x0 + i * .0128, y + .0625, .05, g); if (i % 13 === 12) b.rotation.z = .08; } });
    // dessus : le lecteur CD, façade alu, le tiroir sorti avec le disque dedans, l'écran bleu
    boite(.4, .085, .3, noir, -.2, .623, -.03, g); boite(.4, .078, .008, alu, -.2, .623, .123, g);
    boite(.22, .011, .14, aluF, -.25, .636, .195, g);                                    // le tiroir
    cylindre(g, .058, .058, .004, 32, M('#2a2a30'), -.25, .643, .195);
    const disque = new THREE.Group(); disque.position.set(-.25, .647, .195); disque.userData.vivant = true; g.add(disque);
    const cd = new THREE.Mesh(new THREE.CylinderGeometry(.054, .054, .003, 48), new THREE.MeshStandardMaterial({ map: texteCD(), metalness: .35, roughness: .22, flatShading: false })); disque.add(cd);
    const affCD = toileTexte(256, 48, (x, w, h) => { x.fillStyle = '#071722'; x.fillRect(0, 0, w, h); x.fillStyle = '#7fe0ff'; x.font = '700 24px "IBM Plex Mono", monospace'; x.fillText('CD  01  ▶ 02:14', 14, 33); });
    const lcdCD = new THREE.Mesh(new THREE.PlaneGeometry(.12, .024), new THREE.MeshBasicMaterial({ map: affCD, toneMapped: false })); lcdCD.position.set(-.08, .632, .128); g.add(lcdCD);
    // l'ampli, posé à côté : façade alu, deux vu-mètres ambrés qui s'allument, gros boutons
    const ampli = new THREE.Group(); ampli.position.set(.22, .58, -.03); g.add(ampli);
    boite(.42, .12, .3, noir, 0, .06, 0, ampli); boite(.42, .112, .01, alu, 0, .06, .152, ampli);
    const vu = new THREE.MeshStandardMaterial({ color: '#ffd89a', emissive: '#ffb347', emissiveIntensity: .35, roughness: .5 });
    const aiguilles = [-.11, .0].map(x => { boite(.09, .05, .006, vu, x, .072, .158, ampli); const a = boite(.002, .04, .002, noir, x, .055, .162, ampli); a.geometry.translate(0, .02, 0); a.position.y = .052; a.userData.garder = true; return a; });
    vu.userData.anime = true;
    [.12, .17].forEach(x => { const b = cylindre(ampli, .018, .02, .02, 16, alu, x, .06, .165); b.rotation.x = Math.PI / 2; });
    // deux boîtiers posés à plat devant l'ampli
    ['#2f4a5a', '#e9c46a'].forEach((c, i) => { const b = boite(.142, .0102, .124, M(c, { roughness: .25 }), .2 + i * .02, .585 + i * .0106, .17, g); b.rotation.y = .25 - i * .3; });
    // les enceintes : noyer et toile beige, posées sur le sol de chaque côté du meuble, un peu tournées vers la pièce
    [-1, 1].forEach(c => {
      const e = new THREE.Group(); e.position.set(c * .68, 0, .02); e.rotation.y = -c * .14; g.add(e);
      molle(e, .26, .9, .27, .015, noyer, 0, .47, 0);
      boite(.22, .82, .006, toile, 0, .47, .136, e);
      boite(.05, .012, .003, laiton, 0, .12, .141, e);
      boite(.22, .02, .2, noyerF, 0, .01, 0, e);
    });
    // la tour à CD, en bois, à gauche
    const TX = -1.02;
    boite(.18, 1.16, .17, noyerF, TX, .58, -.04, g); boite(.15, 1.12, .004, M('#2a1a10'), TX, .58, .043, g);
    for (let i = 0; i < 86; i++) { if (i % 17 === 9 || i % 23 === 4) continue; boite(.142, .0105, .14, M(tranches[(i * 11 + (i >> 2) * 3) % tranches.length], { roughness: .35 }), TX, .06 + i * .0124, .015, g); }
    fusionnerDecor(g);   // le meuble, les CD, l'ampli, les enceintes : fixes ; le CD et les aiguilles bougent
    let v = 0;
    return {
      anime(temps, eveil, secousse, dt) {
        v += ((.15 + eveil * 3 + secousse * 14) - v) * Math.min(1, dt * 2);   // le disque dans le tiroir tourne un peu quand on s'approche
        disque.rotation.y -= v * dt;
        vu.emissiveIntensity = .35 + eveil * 1.1;
        aiguilles.forEach((a, i) => { a.rotation.z = .6 - eveil * (.5 + Math.abs(Math.sin(temps * (5 + i) + i)) * .7); });
      },
    };
  },

  // Cite 3 Chinois : le globe sur son tabouret ; les vrais continents, la Chine en rouge et ses trois punaises (Pékin, Chengdu, Canton)
  globe(g, { M, boite }) {
    const tabouret = M('#6b4a32', { roughness: .7 });
    const assise = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .05, 12), tabouret); assise.position.y = .62; g.add(assise);
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .62, 5), tabouret); const a = i * 2.1; p.position.set(Math.cos(a) * .2, .31, Math.sin(a) * .2); p.rotation.set(Math.sin(a) * .12, 0, -Math.cos(a) * .12); g.add(p); }
    ['#2f4a5a', '#c8572f', '#d9a23a'].forEach((c, i) => boite(.34 - i * .03, .05, .24, M(c), 0, .67 + i * .05, 0, g).rotation.y = i * .25);
    const support = new THREE.Group(); support.position.y = .8; g.add(support);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .04, 12), M('#8c6a3c', { metalness: .5, roughness: .4 })); base.position.y = .02; support.add(base);
    const axe = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .16, 6), M('#8c6a3c', { metalness: .5 })); axe.position.y = .1; support.add(axe);
    // la carte : terre ou mer, par cases de 2°, tirée des contours des pays de Cite 3 Chinois
    const carte = atob('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf8Af/gAAAAAAAAAAAAAAAAAAAAAAA//////+AAAAAAAADgAAAAAAAAAAAAI/+f///4AB/AAAAAB8AAAAAAAAAABwAj4f///wAAYAAAAAAPAAAAAAAAAAAHmvwAf//wAAAAADgAf/4AHAAAAAAAD4238AP//gAAAAAOBD///8DAAAgBgACfx3/gP//gAAA4AMHf//////gAAf////79jwH/+AAAP/gA//////////8P//////h+H/gAAAf/6///////////M///////n8D8A+AB+/v///////////AP/////4g8D4AAAH9/////////////Af/////gHgB4AAAP5///////////P4AHgP///gH0AAAAAH4/////////+GMAADQB///8H+AAAAGCx/////////8A8AAIAA////v/gAAAPDj/////////wA4AAAAAf///v/wAAAbv///////////AwAAAAAP/////wAAAH////////////AAAAAAAH////8YAAAB///////////9AAAAAAAD//9/8MAAAB///////////9AAAAAAAD///f/AAAAB//7/f//////5AAAAAAAD//9/gAAAAfxvwPP//////jAAAAAAAD////AAAAAfi///n/////+CAAAAAAAD///+AAAAAfCLf/n////+MCAAAAAAAB///8AAAAAOGRP/3/////mOAAAAAAAB///8AAAAAH/AA///////E8AAAAAAAAf//wAAAAAf/AB///////hgAAAAAAAAP//wAAAAAf/7////////gAAAAAAAAAP/gwAAAAA/////f/////gAAAAAAAAAF+AQAAAAB///+/v/////AAAAAAAAAAC+AAAAAAD/////0n////gAAAAAAAAAAeAwAAAAD////f/D///8gAAAAAAAAAAfEOAAAAH////v/B/z/wAAAAAAAAAAAPMBwAAAD////v+A/B+gAAAAAAAAAAAH8AAAAAD////38AeB/AgAAAAAAAAAAAPAAAAAH////3wAcAfggAAAAAAAAAAADAAAAAD////+AAcAfgwAAAAAAAAAAABDwAAAD////9wAMATAYAAAAAAAAAAAA//AAAB/////gAOASAYAAAAAAAAAAAAH/gAAA/////gACAICIAAAAAAAAAAAAH/8AAAfP///AAAAsHAAAAAAAAAAAAAH/+AAAAB//+AAAA8OAAAAAAAAAAAAAP/+AAAAB//8AAAAc+oAAAAAAAAAAAAP//gAAAD/94AAAAMeggAAAAAAAAAAAP//+AAAB//wAAAAGdg/AAAAAAAAAAAf///AAAA//wAAAACAwPkAAAAAAAAAAP///gAAA//wAAAABwAHwAAAAAAAAAAP///gAAA//wAAAAAAIDYAAAAAAAAAAH///AAAAf/wAAAAAAAAAAAAAAAAAAAH//+AAAA//wgAAAAABxAAAAAAAAAAAD//+AAAA//xgAAAAAPxgAAAAAAAAAAB//+AAAA//zgAAAAAf/gABAAAAAAAAAf/8AAAA//DgAAAAAf/wAAAAAAAAAAAf/8AAAAf/DAAAAAD//4CAAAAAAAAAAf/4AAAAf/DAAAAAH//8AAAAAAAAAAAf/AAAAAf+DAAAAAH//8AAAAAAAAAAA//AAAAAf8AAAAAAH//+AAAAAAAAAAA/+AAAAAP8AAAAAAH//+AAAAAAAAAAA/+AAAAAH4AAAAAAH//+AAAAAAAAAAA/8AAAAAHwAAAAAAD4f8AAAAAAAAAAA/4AAAAAAAAAAAAADAH8AIAAAAAAAAB/wAAAAAAAAAAAAAAAD4AEAAAAAAAAB+AAAAAAAAAAAAAAAAAAAGAAAAAAAAB+AAAAAAAAAAAAAAAAAwAMAAAAAAAAB8AAAAAAAAAAAAAAAAAQAYAAAAAAAAB4AAAAAAAAAAAAAAAAAABwAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAAAAAAAAACAAAAAAAAAAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////');
    // la Chine, en cases de 2° (de 59°N à 13°N, de 67°E à 141°E), grossie d'une case tout autour pour qu'on la voie bien
    const chineB = atob('AAAAAAAAAAAAAAAAA+AAAAAPwABwAP+AA+AD/4A/wB/+AP/B//gH////wH////4B////4Af///4AD///+AAf///gAH///4AA///+AAD///gAAAf/wAAAH/4AAAA/8AAAAAAAAAAAAAAAAAAAAAAAAAAA');
    const chine = (lat, lon) => { const j = Math.round((59 - lat) / 2), i = Math.round((lon - 67) / 2); if (j < 0 || j >= 24 || i < 0 || i >= 38) return 0; const k = j * 38 + i; return (chineB.charCodeAt(k >> 3) >> (7 - (k & 7))) & 1; };
    const terre = (lat, lon) => { const j = Math.min(89, Math.max(0, Math.round((89 - lat) / 2))), i = ((Math.round((lon + 179) / 2) % 180) + 180) % 180, k = j * 180 + i; return (carte.charCodeAt(k >> 3) >> (7 - (k & 7))) & 1; };
    const geo = sansIndex(new THREE.IcosahedronGeometry(.26, 14));   // 4 500 facettes : assez pour voir les pays
    const p = geo.attributes.position, coul = [], c = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      const cx = p.getX(i) + p.getX(i + 1) + p.getX(i + 2), cy = p.getY(i) + p.getY(i + 1) + p.getY(i + 2), cz = p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2), r = Math.hypot(cx, cy, cz);
      const lat = Math.asin(cy / r) * 180 / Math.PI, lon = Math.atan2(-cz, cx) * 180 / Math.PI, bruit = Math.sin(cx * 40) * Math.cos(cz * 37 + cy * 11);
      if (chine(lat, lon)) c.set(bruit > 0 ? '#d8342c' : '#c62d26');
      else if (!terre(lat, lon)) c.set(bruit > .3 ? '#346f98' : '#2f6690');
      else if (lat > 64 || lat < -60) c.set('#eef2f3');
      else if ((lat > 14 && lat < 33 && lon > -17 && lon < 60) || (lat < -18 && lat > -32 && lon > 116 && lon < 142) || (lat > 36 && lat < 46 && lon > 75 && lon < 110)) c.set(bruit > 0 ? '#dcbd7c' : '#d2b06c');
      else c.set(bruit > .2 ? '#6c9f52' : lat > 50 ? '#4f8048' : '#7fae58');
      for (let j = 0; j < 3; j++) coul.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3));
    const boule = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, flatShading: true }));
    const pivot = new THREE.Group(); pivot.position.y = .44; pivot.rotation.z = .41; support.add(pivot); pivot.add(boule);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(.3, .01, 5, 24, Math.PI), M('#8c6a3c', { metalness: .5 })); arc.rotation.z = Math.PI / 2; pivot.add(arc);
    const feux = [[39.9, 116.4], [30.7, 104.1], [23.1, 113.3]].map(([la, lo]) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd35a' }));
      const a = la * Math.PI / 180, b = lo * Math.PI / 180;
      f.position.set(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)).multiplyScalar(.266); boule.add(f); return f;
    });
    const FACE_CHINE = Math.atan2(Math.cos(108 * Math.PI / 180), Math.sin(108 * Math.PI / 180)) + Math.PI;   // l'angle qui met la Chine face à nous
    return {
      anime(temps, eveil, secousse, dt) {
        // quand on arrive devant, il se tourne vers la Chine (et oscille un peu) ; sinon il tourne doucement
        if (eveil > .3 && !secousse) { const vise = FACE_CHINE + Math.sin(temps * .6) * .3; let d = (vise - boule.rotation.y) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; boule.rotation.y += d * Math.min(1, dt * 2.2 * eveil); }
        else boule.rotation.y += dt * (.15 + secousse * 6);
        feux.forEach((f, i) => f.scale.setScalar(1 + (Math.sin(temps * 3 + i * 2) * .5 + .5) * eveil * .5));
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
    // à côté : une lanterne « ? » sur son pied, qui tourne doucement
    cylindre(g, .13, .15, .03, 16, noir, .66, .015, -.1); cylindre(g, .015, .015, 1.62, 6, noir, .66, .82, -.1);
    const lanterne = new THREE.Group(); lanterne.position.set(.66, 1.72, -.1); lanterne.userData.vivant = true; g.add(lanterne);
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
