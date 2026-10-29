/* ════════════════════════════════════════════════════════════════════
   OSB CORPORATION — le parcours
   Une plaine de nuit, dans la brume. Chaque création est un objet
   posé sur un socle, le long d'un chemin. On avance à la molette,
   au doigt ou aux flèches. Rendu en basse définition, tramé, comme
   un vieux jeu en 3D.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from './vendor/three.module.js';

export function demarrer({ toile, etapes, surEtape, reduit }) {
  const N = etapes.length;            // étape 0 = l'arrivée (titre), puis les créations
  const ECART = 13;                   // distance entre deux socles
  const params = new URLSearchParams(location.search);
  const cliche = params.get('cliche'); // ?cliche=hb : vue fixe pour fabriquer les vignettes

  /* ─────────── moteur ─────────── */
  const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!cliche });
  rendu.setPixelRatio(1);
  const scene = new THREE.Scene();
  const NUIT = new THREE.Color('#0d0c0a');
  scene.background = NUIT;
  scene.fog = new THREE.FogExp2(NUIT, 0.052);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);

  // on dessine petit, puis on agrandit sans lisser, avec une trame : le grain des vieux jeux
  const cible = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const ecranScene = new THREE.Scene();
  const ecranCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const trame = new THREE.ShaderMaterial({
    uniforms: { tImage: { value: cible.texture }, res: { value: new THREE.Vector2(2, 2) }, temps: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tImage; uniform vec2 res; uniform float temps; uniform float flash; varying vec2 vUv;
      float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
      float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
      float hasard(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + temps * 3.1) * 43758.5453); }
      void main(){
        vec3 c = linearToOutputTexel(texture2D(tImage, vUv)).rgb;   // passage en sRGB avant la trame
        vec2 px = floor(vUv * res);
        float n = 14.;
        c = floor(c * n + bayer4(px) * .95) / n;              // tramage ordonné
        c += (hasard(px) - .5) * .035;                        // grain
        vec2 d = vUv - .5; c *= 1. - dot(d, d) * .9;          // vignette
        c = mix(c, vec3(1., .93, .8), flash);                 // éclair à l'entrée
        gl_FragColor = vec4(c, 1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  ecranScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trame));

  function taille() {
    const w = toile.clientWidth || innerWidth, h = toile.clientHeight || innerHeight;
    rendu.setSize(w, h, false);
    const div = w < 700 ? 2.2 : 2.6;                         // la « basse définition »
    const lw = Math.max(160, Math.round(w / div)), lh = Math.max(120, Math.round(h / div));
    cible.setSize(lw, lh);
    trame.uniforms.res.value.set(lw, lh);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 62 : 48;                       // téléphone debout : un peu plus large
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', taille);
  taille();

  /* ─────────── matériaux ─────────── */
  const plat = (couleur, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: couleur, flatShading: true, roughness: .92, metalness: 0 }, o));
  const brille = couleur => new THREE.MeshBasicMaterial({ color: couleur });
  const PIERRE = plat('#3a352d'), PIERRE2 = plat('#2b2721');

  scene.add(new THREE.HemisphereLight('#5c6680', '#1a140c', 0.55));
  const lune = new THREE.DirectionalLight('#9fb0d0', 0.5); lune.position.set(-8, 14, 6); scene.add(lune);

  /* ─────────── la plaine ─────────── */
  const longueur = (N + 3) * ECART;
  const sol = new THREE.PlaneGeometry(90, longueur + 60, 46, Math.round((longueur + 60) / 2.2));
  sol.rotateX(-Math.PI / 2);
  const ps = sol.attributes.position;
  for (let i = 0; i < ps.count; i++) {
    const x = ps.getX(i), z = ps.getZ(i);
    const zm = z - longueur / 2 + 20;                       // position réelle sur la plaine
    const bord = Math.min(1, Math.max(0, (Math.abs(x - courbeX(-zm)) - 3) / 10));
    ps.setY(i, (Math.sin(x * .7 + z * .3) * .25 + Math.random() * .35) * (.3 + bord) + bord * bord * 2.2);
  }
  sol.computeVertexNormals();
  const plaine = new THREE.Mesh(sol, plat('#1c1914'));
  plaine.position.z = -longueur / 2 + 20;
  scene.add(plaine);

  // les étoiles, à peine
  const ciel = new THREE.BufferGeometry();
  const etoiles = [];
  for (let i = 0; i < 320; i++) { const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 30; etoiles.push(Math.cos(a) * r, 18 + Math.random() * 50, -longueur / 2 + Math.sin(a) * r); }
  ciel.setAttribute('position', new THREE.Float32BufferAttribute(etoiles, 3));
  scene.add(new THREE.Points(ciel, new THREE.PointsMaterial({ color: '#c9c2b0', size: 1, sizeAttenuation: false, fog: false })));

  // le chemin : des dalles qui serpentent
  function courbeX(z) { return Math.sin(z / ECART * 1.3) * 1.6; }
  const posEtape = k => new THREE.Vector3(courbeX(k * ECART), 0, -k * ECART);
  for (let z = 6; z > -(N + 1) * ECART; z -= 1.15) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.1 + Math.random() * .5, .12, .8 + Math.random() * .3), Math.random() < .5 ? PIERRE : PIERRE2);
    d.position.set(courbeX(-z) + (Math.random() - .5) * .5, .02, z);
    d.rotation.y = (Math.random() - .5) * .5;
    scene.add(d);
  }
  // quelques menhirs dans la brume
  for (let i = 0; i < 46; i++) {
    const z = 10 - Math.random() * (longueur + 20), cote = Math.random() < .5 ? -1 : 1;
    const x = courbeX(-z) + cote * (6 + Math.random() * 18);
    const h = 1 + Math.random() * 3.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.2 + Math.random() * .3, .5 + Math.random() * .4, h, 5), PIERRE2);
    m.position.set(x, h / 2 - .2, z); m.rotation.set((Math.random() - .5) * .2, Math.random() * 3, (Math.random() - .5) * .2);
    scene.add(m);
  }

  /* ─────────── les objets ─────────── */
  const objets = [];
  etapes.forEach((e, k) => {
    if (k === 0) return;
    const p = posEtape(k);
    const groupe = new THREE.Group();
    groupe.position.copy(p);
    scene.add(groupe);
    // le socle
    if (e.forme !== 'lointain' && e.forme !== 'porte') {
      const socle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, .7, 7), PIERRE);
      socle.position.y = .35; groupe.add(socle);
      const dessus = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, .12, 7), PIERRE2);
      dessus.position.y = .76; groupe.add(dessus);
    }
    const lumiere = new THREE.PointLight(e.couleur, 0, 9, 1.6);
    lumiere.position.set(0, 3, e.forme === 'lointain' ? -24 : 2.2);
    groupe.add(lumiere);
    const obj = FORMES[e.forme](groupe, e);
    objets.push({ k, groupe, lumiere, anime: obj.anime || (() => {}), touche: obj.touche || (() => {}), cible: obj.cible || groupe, eveil: 0, secousse: 0 });
  });

  /* ─────────── le trajet de la caméra ─────────── */
  let t = 0, cibleT = 0;
  if (cliche) { const i = etapes.findIndex(e => e.id === cliche); if (i >= 0) t = cibleT = i; }
  const souris = new THREE.Vector2();
  function placerCamera(temps) {
    const k = Math.floor(t), f = t - k;
    const a = vueDe(k), b = vueDe(Math.min(N - 1, k + 1));
    const lisse = f * f * (3 - 2 * f);
    camera.position.lerpVectors(a.pos, b.pos, lisse);
    const regard = new THREE.Vector3().lerpVectors(a.regard, b.regard, lisse);
    camera.position.x += souris.x * .35 + Math.sin(temps * .4) * .05;
    camera.position.y += souris.y * .2 + Math.sin(temps * .55) * .04;
    camera.lookAt(regard);
  }
  function vueDe(k) {
    if (k === 0) return { pos: new THREE.Vector3(courbeX(-9), 5.2, 13), regard: new THREE.Vector3(courbeX(ECART), 1.2, -ECART * 1.2) };
    const p = posEtape(k), e = etapes[k];
    if (e.forme === 'lointain') return { pos: new THREE.Vector3(p.x, 2.2, p.z + 9), regard: new THREE.Vector3(p.x, 1.6, p.z - 20) };
    const recul = (e.forme === 'porte' ? 9.5 : 8) * (cliche ? .62 : 1);
    return { pos: new THREE.Vector3(p.x + .3, 2.55, p.z + recul), regard: new THREE.Vector3(p.x, 1.75, p.z) };
  }

  /* ─────────── les commandes ─────────── */
  let repos = null;
  const aller = v => { cibleT = Math.max(0, Math.min(N - 1, v)); clearTimeout(repos); repos = setTimeout(() => { cibleT = Math.round(cibleT); }, 160); };
  addEventListener('wheel', e => { if (document.body.classList.contains('liste')) return; e.preventDefault(); aller(cibleT + Math.max(-.6, Math.min(.6, e.deltaY / 500))); }, { passive: false });
  let doigt = null;
  toile.addEventListener('touchstart', e => { doigt = { y: e.touches[0].clientY, x: e.touches[0].clientX, t0: cibleT }; }, { passive: true });
  toile.addEventListener('touchmove', e => {
    if (!doigt) return;
    const dy = doigt.y - e.touches[0].clientY, dx = doigt.x - e.touches[0].clientX;
    const d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
    aller(doigt.t0 + d / 260);
  }, { passive: true });
  toile.addEventListener('touchend', () => { doigt = null; aller(Math.round(cibleT)); });
  addEventListener('pointermove', e => { souris.set(e.clientX / innerWidth - .5, .5 - e.clientY / innerHeight); });

  // toucher un objet : il réagit (et le son joue)
  const lancer = new THREE.Raycaster();
  toile.addEventListener('click', e => {
    const v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    lancer.setFromCamera(v, camera);
    for (const o of objets) {
      if (lancer.intersectObject(o.groupe, true).length) {
        if (Math.round(t) !== o.k) { aller(o.k); return; }
        o.secousse = 1; o.touche(); surEtape(o.k, { entrer: true }); return;
      }
    }
  });
  // la main apparaît au-dessus d'un objet : on comprend qu'on peut cliquer
  let survolPrevu = false;
  toile.addEventListener('pointermove', e => {
    if (survolPrevu || e.pointerType !== 'mouse') return;
    survolPrevu = true;
    requestAnimationFrame(() => {
      survolPrevu = false;
      lancer.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
      toile.style.cursor = objets.some(o => lancer.intersectObject(o.groupe, true).length) ? 'pointer' : '';
    });
  });

  /* ─────────── la boucle ─────────── */
  const horloge = { avant: performance.now(), elapsedTime: 0, getDelta() { const m = performance.now(), d = (m - this.avant) / 1000; this.avant = m; this.elapsedTime += d; return d; } };
  let derniereEtape = -1, enPause = false, flash = 0;
  function image() {
    if (enPause) return;
    const dt = Math.min(.05, horloge.getDelta()), temps = horloge.elapsedTime;
    t += (cibleT - t) * (reduit ? 1 : 1 - Math.pow(.0012, dt));
    if (Math.abs(cibleT - t) < .0005) t = cibleT;
    placerCamera(temps);
    const ici = Math.round(t);
    if (ici !== derniereEtape) { derniereEtape = ici; surEtape(ici, {}); }
    for (const o of objets) {
      const actif = Math.abs(t - o.k) < .5 ? 1 : 0;
      if (cliche && actif) o.eveil = 1;
      o.eveil += (actif - o.eveil) * Math.min(1, dt * 3);
      o.secousse = Math.max(0, o.secousse - dt * 1.6);
      o.lumiere.intensity = .4 + o.eveil * 9;
      o.anime(temps, o.eveil, o.secousse, dt);
    }
    flash = Math.max(0, flash - dt * 2.5);
    trame.uniforms.temps.value = temps;
    trame.uniforms.flash.value = flash;
    rendu.setRenderTarget(cible); rendu.render(scene, camera);
    rendu.setRenderTarget(null); rendu.render(ecranScene, ecranCam);
    if (!cliche) requestAnimationFrame(image);
  }
  if (cliche) { objets.forEach(o => { if (o.k === t) o.eveil = 1; }); for (let i = 0; i < 40; i++) { t = cibleT; image(); } document.body.dataset.pret = '1'; }
  else requestAnimationFrame(image);

  return {
    aller: k => aller(k),
    suivant: () => aller(Math.round(cibleT) + 1),
    precedent: () => aller(Math.round(cibleT) - 1),
    actuelle: () => Math.round(cibleT),
    eclair: () => { flash = .9; },
    pause: p => { enPause = p; if (!p) { horloge.getDelta(); requestAnimationFrame(image); } },
  };
}

/* ════════════════════════════ les formes ════════════════════════════ */
const sansIndex = geo => geo.index ? geo.toNonIndexed() : geo;
// une tache de lumière ronde et douce (pour les halos)
let tache = null;
function tacheDouce() {
  if (tache) return tache;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), d = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(.25, 'rgba(255,255,255,.5)'); d.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = d; x.fillRect(0, 0, 64, 64);
  return (tache = new THREE.CanvasTexture(c));
}
const plat = (couleur, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: couleur, flatShading: true, roughness: .9, metalness: 0 }, o));
const brille = couleur => new THREE.MeshBasicMaterial({ color: couleur });

const FORMES = {
  // Onsenbranle : une porte de lumière, quelqu'un sur le seuil
  porte(g) {
    const pierre = plat('#4a4338');
    const montant = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.55, 3.6, .7), pierre); m.position.set(x, 1.8, 0); g.add(m); };
    montant(-1.15); montant(1.15);
    const linteau = new THREE.Mesh(new THREE.BoxGeometry(3, .55, .8), pierre); linteau.position.y = 3.75; g.add(linteau);
    const marche = new THREE.Mesh(new THREE.BoxGeometry(3.2, .2, 1.4), plat('#2e2a24')); marche.position.set(0, .1, .3); g.add(marche);
    const lumiere = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 3.5), brille('#ffd9a0')); lumiere.position.set(0, 1.78, -.05); g.add(lumiere);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tacheDouce(), color: '#ffb35c', transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(0, 1.9, .3); halo.scale.set(4.2, 5.5, 1); g.add(halo);
    // la silhouette
    const ombre = plat('#0b0a08');
    const corps = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, .9, 5), ombre); corps.position.set(0, .7, .25); g.add(corps);
    const tete = new THREE.Mesh(new THREE.IcosahedronGeometry(.15, 0), ombre); tete.position.set(0, 1.27, .25); g.add(tete);
    // le faisceau sur le sol
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 5), new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }));
    sol.rotation.x = -Math.PI / 2; sol.position.set(0, .22, 2.6); g.add(sol);
    return {
      anime(temps, eveil, secousse) {
        halo.material.opacity = .12 + eveil * .16 + Math.sin(temps * 2.2) * .03 + secousse * .4;
        sol.material.opacity = .1 + eveil * .18;
        corps.position.x = tete.position.x = Math.sin(temps * .5) * .05 + secousse * Math.sin(temps * 30) * .08;
      },
    };
  },

  // Music Discovery : le disque irisé qui flotte
  disque(g) {
    const geo = new THREE.RingGeometry(.2, 1.15, 36, 2);
    const coul = [];
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getY(i), p.getX(i));
      const c = new THREE.Color().setHSL(((a / Math.PI + 1) * .5 * 2 + .55) % 1, .55, .6 + Math.cos(a * 4) * .15);
      coul.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3));
    const disque = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, metalness: .6, roughness: .35, flatShading: true, emissive: '#222', emissiveIntensity: .4 }));
    const support = new THREE.Group(); support.position.y = 2.1; support.add(disque); g.add(support);
    disque.rotation.x = -1.15;
    const ombre = new THREE.Mesh(new THREE.CircleGeometry(.9, 14), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .45 }));
    ombre.rotation.x = -Math.PI / 2; ombre.position.y = .83; ombre.scale.y = .5; g.add(ombre);
    let vitesse = .6;
    return {
      anime(temps, eveil, secousse, dt) {
        vitesse += ((.6 + eveil * 1.2 + secousse * 14) - vitesse) * Math.min(1, dt * 4);
        disque.rotation.z += vitesse * dt;
        support.position.y = 2.1 + Math.sin(temps * 1.3) * .14 + eveil * .1;
        support.rotation.y = Math.sin(temps * .4) * .3;
        ombre.scale.x = .9 - Math.sin(temps * 1.3) * .08;
      },
    };
  },

  // Cite 3 Chinois : le globe, trois lumières
  globe(g) {
    const geo = sansIndex(new THREE.IcosahedronGeometry(1.05, 2));
    const p = geo.attributes.position, coul = [];
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)), cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)), cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2));
      const terre = Math.sin(cx * 3.1) + Math.sin(cy * 2.7 + cz * 1.3) + Math.cos(cz * 3.3 - cx) > .6;
      const c = new THREE.Color(terre ? '#a89a78' : '#2f3a40');
      for (let j = 0; j < 3; j++) coul.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3));
    const globe = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }));
    const support = new THREE.Group(); support.position.y = 2.15; support.add(globe); g.add(support);
    const feux = [[.4, .5, .78], [-.6, .1, .78], [.1, -.55, .84]].map(v => {
      const f = new THREE.Mesh(new THREE.OctahedronGeometry(.07, 0), brille('#ffc96b'));
      f.position.set(...v).normalize().multiplyScalar(1.07); globe.add(f); return f;
    });
    support.rotation.z = .35;
    return {
      anime(temps, eveil, secousse, dt) {
        globe.rotation.y += dt * (.25 + eveil * .25 + secousse * 6);
        feux.forEach((f, i) => f.scale.setScalar(1 + (Math.sin(temps * 3 + i * 2) * .5 + .5) * (1 + eveil * 1.5)));
        support.position.y = 2.15 + Math.sin(temps * .9) * .06;
      },
    };
  },

  // RP Talya : la tête de Talya, oreilles dressées
  talya(g) {
    const blanc = plat('#eef0ea'), ombre = plat('#c9cdc4'), rose = plat('#e2b7b2'), noir = plat('#151010');
    const tete = new THREE.Group(); tete.position.set(0, 2.05, 0); g.add(tete);
    const crane = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 0), blanc); crane.scale.set(1, .85, 1); tete.add(crane);
    const museau = new THREE.Mesh(new THREE.ConeGeometry(.27, 1.15, 5), blanc); museau.rotation.x = Math.PI / 2; museau.position.set(0, -.14, .68); tete.add(museau);
    const truffe = new THREE.Mesh(new THREE.IcosahedronGeometry(.08, 0), noir); truffe.position.set(0, -.14, 1.25); tete.add(truffe);
    const oreille = cote => {
      const o = new THREE.Group(); o.position.set(cote * .3, .35, -.05); o.rotation.z = -cote * .22;
      const ext = new THREE.Mesh(new THREE.ConeGeometry(.2, .85, 4), cote < 0 ? ombre : blanc); ext.position.y = .4; o.add(ext);
      const int = new THREE.Mesh(new THREE.ConeGeometry(.11, .6, 3), rose); int.position.set(0, .35, .1); o.add(int);
      tete.add(o); return o;
    };
    const og = oreille(-1), od = oreille(1);
    [-1, 1].forEach(c => { const oeil = new THREE.Mesh(new THREE.IcosahedronGeometry(.06, 0), noir); oeil.position.set(c * .22, .1, .44); tete.add(oeil); });
    const cou = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, 1.1, 6), ombre); cou.position.set(0, 1.25, -.15); cou.rotation.x = .25; g.add(cou);
    let frisson = 0;
    return {
      anime(temps, eveil, secousse, dt) {
        tete.rotation.y = .75 + Math.sin(temps * .6) * .3 * (1 - eveil * .6) + Math.sin(temps * .23) * .1;
        tete.rotation.z = Math.sin(temps * .9) * .06 + eveil * .12;
        tete.rotation.x = -.05 + Math.sin(temps * .7) * .05;
        if (Math.random() < dt * .25) frisson = 1;
        frisson = Math.max(frisson, secousse); frisson = Math.max(0, frisson - dt * 3);
        const v = Math.sin(temps * 40) * frisson * .25;
        og.rotation.x = v; od.rotation.x = -v;
      },
      touche() { frisson = 1; },
    };
  },

  // Fun facts : un cabinet de curiosités qui s'ouvre
  cabinet(g) {
    const bois = plat('#4b3524'), bois2 = plat('#3a2819');
    const c = new THREE.Group(); c.position.y = .82; g.add(c);
    const planche = (w, h, d, x, y, z, m = bois) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); p.position.set(x, y, z); c.add(p); return p; };
    planche(1.7, .1, .9, 0, 0, 0); planche(1.7, .1, .9, 0, 2.2, 0); planche(.1, 2.3, .9, -.85, 1.1, 0); planche(.1, 2.3, .9, .85, 1.1, 0);
    planche(1.7, 2.3, .06, 0, 1.1, -.42, bois2); planche(1.6, .06, .8, 0, .78, 0); planche(1.6, .06, .8, 0, 1.5, 0);
    const objets = [
      [new THREE.IcosahedronGeometry(.17, 0), '#d8b04a', -.45, .98], [new THREE.TetrahedronGeometry(.2, 0), '#6f9a6a', .1, 1.0], [new THREE.TorusGeometry(.13, .05, 5, 8), '#b8473a', .5, 1.0],
      [new THREE.BoxGeometry(.2, .28, .2), '#8aa0b8', -.4, 1.68], [new THREE.OctahedronGeometry(.18, 0), '#e6dcc2', .2, 1.7], [new THREE.ConeGeometry(.13, .3, 5), '#7e5aa0', .55, 1.68],
      [new THREE.DodecahedronGeometry(.17, 0), '#c8572f', -.3, .3], [new THREE.CylinderGeometry(.1, .1, .3, 6), '#a3b5ab', .35, .3],
    ].map(([geo, coul, x, y]) => { const m = new THREE.Mesh(geo, plat(coul, { emissive: coul, emissiveIntensity: .12 })); m.position.set(x, y, .1); c.add(m); return m; });
    const porte = cote => {
      const pivot = new THREE.Group(); pivot.position.set(cote * .85, 1.1, .45); c.add(pivot);
      const v = new THREE.Mesh(new THREE.BoxGeometry(.85, 2.2, .06), bois); v.position.x = -cote * .425; pivot.add(v);
      const poignee = new THREE.Mesh(new THREE.OctahedronGeometry(.05, 0), brille('#d8b04a')); poignee.position.set(-cote * .76, 0, .06); pivot.add(poignee);
      return pivot;
    };
    const pg = porte(-1), pd = porte(1);
    return {
      anime(temps, eveil, secousse) {
        const ouvert = Math.min(1, eveil * 1.1) * 1.9;
        pg.rotation.y = -ouvert; pd.rotation.y = ouvert;
        objets.forEach((o, i) => { o.rotation.y = temps * (.5 + i * .07) + secousse * 8; o.position.z = .1 + Math.sin(temps * 2 + i) * .02 + secousse * .1; });
      },
    };
  },

  // Raciste ou joueur de fléchettes ? : la cible, et des barrières de chantier
  flechettes(g) {
    const cible = new THREE.Group(); cible.position.set(0, 2.25, 0); g.add(cible);
    const dos = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, .14, 20), plat('#16130f')); dos.rotation.x = Math.PI / 2; dos.position.z = -.08; cible.add(dos);
    // les anneaux : [rayon intérieur, extérieur, couleur paire, couleur impaire]
    [[0, .07, '#b8473a', '#b8473a'], [.07, .15, '#3f7a4a', '#3f7a4a'], [.15, .52, '#16130f', '#e6dcc2'], [.52, .6, '#b8473a', '#3f7a4a'],
     [.6, .88, '#16130f', '#e6dcc2'], [.88, .96, '#b8473a', '#3f7a4a']].forEach(([r1, r2, c1, c2]) => {
      const geo = sansIndex(r1 ? new THREE.RingGeometry(r1, r2, 20, 1) : new THREE.CircleGeometry(r2, 20));
      const coul = [], n = geo.attributes.position.count / 3;
      for (let t = 0; t < n; t++) { const sec = r1 ? Math.floor(t / 2) % 20 : t; const c = new THREE.Color(sec % 2 ? c2 : c1); for (let j = 0; j < 3; j++) coul.push(c.r, c.g, c.b); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(coul, 3));
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 })); m.position.z = .001; cible.add(m);
    });
    const fleche = new THREE.Group(); fleche.position.set(.22, 2.4, .02); g.add(fleche);
    const fut = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .55, 5), plat('#9a8f78')); fut.rotation.x = Math.PI / 2; fut.position.z = .3; fleche.add(fut);
    const ailette = new THREE.Mesh(new THREE.ConeGeometry(.1, .18, 3), plat('#c8572f')); ailette.rotation.x = -Math.PI / 2; ailette.position.z = .6; fleche.add(ailette);
    fleche.rotation.set(-.15, .2, 0);
    // barrières de chantier
    const rayures = (n = 8) => {
      const b = sansIndex(new THREE.BoxGeometry(1.4, .18, .06, n, 1, 1));
      const pp = b.attributes.position, cc = [];
      for (let i = 0; i < pp.count; i += 3) { const x = (pp.getX(i) + pp.getX(i + 1) + pp.getX(i + 2)) / 3; const c = new THREE.Color(Math.floor((x + .7) / .175) % 2 ? '#d9822b' : '#16130f'); for (let j = 0; j < 3; j++) cc.push(c.r, c.g, c.b); }
      b.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
      return new THREE.Mesh(b, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
    };
    [-1, 1].forEach(c => {
      const bar = new THREE.Group(); bar.position.set(c * 1.9, 0, 1.2); bar.rotation.y = c * .5; g.add(bar);
      const r = rayures(); r.position.y = .75; bar.add(r);
      [-.6, .6].forEach(x => { const pied = new THREE.Mesh(new THREE.BoxGeometry(.06, .85, .06), plat('#2b2721')); pied.position.set(x, .42, 0); bar.add(pied); });
    });
    return {
      anime(temps, eveil, secousse) {
        cible.rotation.z = Math.sin(temps * .5) * .05 + secousse * Math.sin(temps * 24) * .05;
        fleche.rotation.y = .2 + Math.sin(temps * 30) * .06 * secousse;
        fleche.rotation.x = -.15 + Math.sin(temps * 26) * .05 * secousse;
      },
    };
  },

  // D'autres créations arrivent : une lumière tout au bout
  lointain(g, e) {
    const point = new THREE.Mesh(new THREE.OctahedronGeometry(.25, 0), new THREE.MeshBasicMaterial({ color: e.couleur, fog: false }));
    point.position.set(0, 1.4, -26); g.add(point);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tacheDouce(), color: e.couleur, transparent: true, opacity: .25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(5, 5, 1); halo.position.copy(point.position); g.add(halo);
    return {
      cible: point,
      anime(temps, eveil, secousse) {
        point.rotation.y = temps; point.position.y = 1.4 + Math.sin(temps * .8) * .15;
        halo.position.y = point.position.y;
        halo.material.opacity = .15 + eveil * .2 + Math.sin(temps * 1.7) * .05 + secousse * .4;
      },
    };
  },
};
