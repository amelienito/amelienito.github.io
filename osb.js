/* ═══════════════ OSB CORPORATION · ce qui relie les jeux entre eux ═══════════════
   Un seul fichier, chargé par chaque jeu :  <script src="https://amelienito.github.io/osb.js" defer></script>

   OSB.ici('osmose')                 note la visite (les jeux sont sur le même site : ils partagent cette mémoire)
   OSB.autres('osmose')              les autres jeux, ceux qu'on n'a jamais ouverts d'abord
   OSB.pub({ ici: 'osmose' })        la coupure pub : une réclame pour un autre jeu, qu'on peut passer
                                     ({ auto: 9 } : elle se referme toute seule au bout de 9 secondes, pour une radio qu'on écoute de loin)
   OSB.retour({ ici: 'osmose' })     « Un retour ? Un commentaire ? Un bug à partager ? » : la fenêtre pour écrire
   OSB.pied(element, { ici })        pose en fin de visite la ligne des retours et les autres jeux

   Pour ajouter un jeu : une ligne dans JEUX. Pour changer une réclame : la liste « pubs » du jeu.
   La pub et la fenêtre des retours prennent l'habit du jeu où l'on est (HABITS) : ses couleurs, ses polices.
*/
(() => {
  if (window.OSB) return;
  const RACINE = 'https://amelienito.github.io';
  // genre : la légende du jeu dans le hub (la même partout : hub, cartes, réclames). pubs : la phrase de la coupure pub, au hasard.
  const JEUX = [
    { id: 'fun-facts', nom: 'Fun facts', url: '/fun-facts/', img: '/img/jeux/fun-facts.jpg', genre: 'Pour apprendre en s’amusant',
      pubs: ['Des trucs marrants à ressortir au prochain repas de famille.', 'Pour apprendre en s’amusant. Surtout pour s’amuser.'] },
    { id: 'osmose', nom: 'Osmose', url: '/osmose/', img: '/img/jeux/osmose.jpg', genre: 'Le quizz rap du soir',
      pubs: ['Le quizz rap du soir. Les lucioles jouent avec vous.', 'Quinze questions de rap, et une seule à la fin : où tu te places.'] },
    { id: 'cite-3-chinois', nom: 'Cite 3 Chinois', url: '/cite-trois-chinois/', img: '/img/jeux/cite-3-chinois.jpg', genre: 'Voyons voir si t’es raciste',
      pubs: ['En seriez-vous capable ?'] },
    { id: 'rp-talya', nom: 'RP Talya', url: '/Hb/', img: '/img/jeux/rp-talya.jpg', genre: 'Joyeux anniversaire Flo',
      pubs: ['Sept missions, une chienne aux commandes.'] },
    { id: 'music-discovery', nom: 'Music Discovery', url: '/music-discovery/', img: '/img/jeux/music-discovery.jpg', genre: 'Découvrir de la musique sainement',
      pubs: ['J’ai passé ma vie à écouter de la musique. Fallait bien que je trouve un moyen de vous la repartager.'] },
  ];
  // l'habit de la pub (et de la fenêtre des retours) : celui du jeu où l'on est, avec ses couleurs et ses polices (déjà chargées par la page)
  const HABITS = {
    osmose: '--o-voile:rgba(7,6,26,.84);--o-fond:#100e33;--o-bord:rgba(190,196,255,.3);--o-cadre:rgba(7,6,26,.9);--o-encre:#EEF0FF;--o-fort:#fff;--o-doux:#CDD0F4;--o-pale:#9396C9;--o-accent:#EEF0FF;--o-sur-accent:#07061A;--o-marque:#7CF7DD;--o-rouge:#FF6F8E;--o-titre:"Bodoni Moda",Didot,Georgia,serif;--o-titre-style:italic;--o-titre-poids:800;--o-texte:"Mona Sans","Helvetica Neue",Arial,sans-serif;--o-mono:"Mona Sans","Helvetica Neue",Arial,sans-serif;--o-rayon:28px;--o-champ:#0a0924;--o-tv:0',
    'fun-facts': '--o-voile:rgba(21,19,26,.8);--o-fond:var(--creme,#fbf5e9);--o-bord:rgba(21,19,26,.16);--o-cadre:var(--nuit,#15131a);--o-encre:var(--nuit,#15131a);--o-fort:var(--nuit,#15131a);--o-doux:rgba(21,19,26,.8);--o-pale:rgba(21,19,26,.56);--o-accent:var(--or,#ffc93c);--o-sur-accent:var(--nuit,#15131a);--o-marque:var(--or-fonce,#b8860b);--o-titre:var(--titre,"Unbounded",sans-serif);--o-titre-style:var(--titre-style,normal);--o-titre-poids:var(--titre-graisse,700);--o-texte:var(--corps,"Hanken",sans-serif);--o-mono:var(--corps,"Hanken",sans-serif);--o-rayon:22px;--o-champ:#fff;--o-tv:0',
    'music-discovery': '--o-voile:rgba(10,10,12,.62);--o-fond:var(--fond,#e7e1d7);--o-bord:var(--trait,rgba(23,23,26,.11));--o-cadre:color-mix(in srgb,var(--encre,#17171a) 14%,transparent);--o-encre:var(--encre,#17171a);--o-fort:var(--encre,#17171a);--o-doux:color-mix(in srgb,var(--encre,#17171a) 82%,transparent);--o-pale:color-mix(in srgb,var(--encre,#17171a) 56%,transparent);--o-accent:var(--aiguille,#1f3fd1);--o-sur-accent:var(--sur-aiguille,#fff);--o-marque:var(--aiguille,#1f3fd1);--o-titre:var(--display,"Archivo",sans-serif);--o-titre-poids:var(--display-poids,700);--o-texte:var(--texte,"Archivo",sans-serif);--o-mono:var(--etiquette,"Archivo",sans-serif);--o-rayon:var(--rayon-objet,14px);--o-rayon-b:var(--rayon-bouton,10px);--o-champ:color-mix(in srgb,var(--fond,#e7e1d7) 88%,var(--encre,#17171a))',
  };
  const habiller = (el, ici) => { const t = HABITS[ici || OSB.site]; if (t) el.setAttribute('style', t); return el; };
  // où partent les retours : le formulaire Google d'Amélien (deux champs de texte)
  const FORMULAIRE = { url: 'https://docs.google.com/forms/d/e/1FAIpQLSfKjnU_wrJef9Te-k_OjN2zwCL8aruHIswffb-_x8M8_XpY9g/formResponse', message: 'entry.665975020', lieu: 'entry.1465653503' };

  const mem = {
    lire(c, d) { try { const v = localStorage.getItem(c); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    ecrire(c, v) { try { localStorage.setItem(c, JSON.stringify(v)); } catch (e) {} },
  };
  const lien = (j, depuis) => RACINE + j.url + (depuis ? '?depuis=' + encodeURIComponent(depuis) : '');
  const h = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function style() {
    if (document.getElementById('osb-style')) return;
    const s = document.createElement('style'); s.id = 'osb-style';
    s.textContent = `
.osb-voile,.osb-mot,.osb-pied{--o-voile:rgba(6,5,4,.82);--o-fond:#12100d;--o-bord:#3a3226;--o-cadre:#0a0907;--o-encre:#efe6d2;--o-fort:#fff;--o-doux:#d9cfba;--o-pale:#8d826e;--o-accent:#e3b04b;--o-sur-accent:#17130c;--o-marque:#e3b04b;--o-rouge:#ff4a3d;--o-titre:"Inter Tight","Helvetica Neue",Arial,sans-serif;--o-titre-style:normal;--o-titre-poids:800;--o-texte:"Inter Tight","Helvetica Neue",Arial,sans-serif;--o-mono:ui-monospace,"IBM Plex Mono",Menlo,monospace;--o-rayon:14px;--o-rayon-b:999px;--o-champ:#0a0907;--o-tv:1}
.osb-voile{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:var(--o-voile);opacity:0;transition:opacity .28s ease;font-family:var(--o-texte);color:var(--o-encre);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;text-size-adjust:100%}
.osb-voile.osb-on{opacity:1}
.osb-voile *{box-sizing:border-box}
.osb-poste{position:relative;width:min(560px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--o-fond);border:1px solid var(--o-bord);border-radius:var(--o-rayon);box-shadow:0 30px 90px rgba(0,0,0,.6),0 0 0 6px var(--o-cadre);transform:scale(.94) translateY(10px);transition:transform .35s cubic-bezier(.2,.9,.25,1.15)}
.osb-on .osb-poste{transform:none}
.osb-bandeau{display:flex;align-items:center;gap:10px;padding:10px 14px;white-space:nowrap;overflow:hidden;border-bottom:1px solid var(--o-bord);font:700 11px/1 var(--o-mono);font-stretch:118%;letter-spacing:.16em;text-transform:uppercase;color:var(--o-pale)}
.osb-rouge{width:8px;height:8px;border-radius:50%;background:var(--o-rouge);box-shadow:0 0 10px var(--o-rouge);animation:osb-clign 1.1s steps(2) infinite}
@keyframes osb-clign{50%{opacity:.25}}
.osb-bandeau b{color:var(--o-encre);font-weight:700}
.osb-bandeau span:last-child{margin-left:auto}
.osb-ecran{position:relative;display:block;aspect-ratio:16/10;background:#000 center/cover no-repeat;overflow:hidden}
.osb-ecran::after{content:"";position:absolute;inset:0;opacity:var(--o-tv);background:repeating-linear-gradient(rgba(0,0,0,0) 0 2px,rgba(0,0,0,.16) 2px 3px),radial-gradient(120% 90% at 50% 50%,rgba(0,0,0,0) 55%,rgba(0,0,0,.5));pointer-events:none}
.osb-ecran i{position:absolute;left:0;right:0;height:22%;top:-22%;opacity:var(--o-tv);background:linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.07),rgba(255,255,255,0));animation:osb-balai 4.5s linear infinite}
@keyframes osb-balai{to{top:100%}}
.osb-texte{padding:16px 18px 6px}
.osb-marque{font:700 11px/1 var(--o-mono);font-stretch:118%;letter-spacing:.16em;text-transform:uppercase;color:var(--o-marque)}
.osb-nom{margin:8px 0 6px;font-family:var(--o-titre);font-style:var(--o-titre-style);font-weight:var(--o-titre-poids);font-size:clamp(28px,7.4vw,36px);line-height:1;letter-spacing:-.02em;color:var(--o-fort)}
.osb-slogan{margin:0;font-size:17px;line-height:1.38;color:var(--o-doux);text-wrap:balance}
.osb-genre{margin:6px 0 0;font-size:13px;color:var(--o-pale)}
.osb-boutons{display:flex;gap:10px;padding:14px 18px 18px;flex-wrap:wrap}
.osb-b{flex:1 1 150px;min-height:48px;padding:0 18px;border-radius:var(--o-rayon-b);border:1px solid var(--o-bord);background:transparent;color:var(--o-encre);font-family:var(--o-texte);font-weight:700;font-size:15px;line-height:1;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:transform .15s,background .2s,border-color .2s,filter .2s}
.osb-b:hover{border-color:var(--o-pale)}
.osb-b:active{transform:scale(.97)}
.osb-b.osb-or{background:var(--o-accent);border-color:var(--o-accent);color:var(--o-sur-accent)}
.osb-b.osb-or:hover{filter:brightness(1.08)}
.osb-b[disabled]{opacity:.55;cursor:default}
.osb-mention{padding:0 18px 14px;font-size:11.5px;color:var(--o-pale);text-align:center}
.osb-x{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;border:0;background:color-mix(in srgb,var(--o-encre) 10%,transparent);color:var(--o-encre);font-size:18px;cursor:pointer}
.osb-titre{margin:0;padding:20px 54px 4px 18px;font-family:var(--o-titre);font-style:var(--o-titre-style);font-weight:var(--o-titre-poids);font-size:22px;line-height:1.15;letter-spacing:-.01em;color:var(--o-fort);text-wrap:balance}
.osb-sous{margin:0;padding:0 18px 12px;font-size:14px;color:var(--o-pale);line-height:1.4}
.osb-champ{display:block;width:calc(100% - 36px);margin:0 18px 10px;padding:12px 14px;border-radius:12px;border:1px solid var(--o-bord);background:var(--o-champ);color:var(--o-encre);font-family:var(--o-texte);font-weight:500;font-size:16px;line-height:1.4}
.osb-champ:focus{outline:2px solid var(--o-marque);outline-offset:1px}
textarea.osb-champ{min-height:120px;resize:vertical}
.osb-mot{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));z-index:2147482000;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 24px);padding:10px 8px 10px 16px;border-radius:999px;background:var(--o-fond);border:1px solid var(--o-bord);box-shadow:0 12px 34px rgba(0,0,0,.4);color:var(--o-encre);font-family:var(--o-texte);font-weight:500;font-size:14px;line-height:1.2;white-space:nowrap;transform:translate(-50%,24px);opacity:0;transition:transform .4s cubic-bezier(.2,.9,.25,1.15),opacity .3s}
.osb-mot.osb-on{transform:translate(-50%,0);opacity:1}
.osb-mot b{color:var(--o-fort)}
.osb-mot a{color:var(--o-marque);font-weight:700;text-underline-offset:3px}
.osb-mot button{width:30px;height:30px;border-radius:50%;border:0;background:transparent;color:var(--o-pale);font-size:14px;cursor:pointer}
.osb-merci{padding:30px 18px 34px;text-align:center;font-size:18px;line-height:1.4}
.osb-merci b{display:block;font-family:var(--o-titre);font-style:var(--o-titre-style);font-weight:var(--o-titre-poids);font-size:28px;margin-bottom:6px;color:var(--o-fort)}
.osb-pied{margin:26px auto 0;width:100%;max-width:560px;text-align:center;font-family:inherit}
.osb-pied *{box-sizing:border-box}
.osb-pied-retour{display:inline-block;padding:10px 4px;background:none;border:0;color:inherit;font:inherit;font-size:14.5px;line-height:1.4;opacity:.8;cursor:pointer;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px;text-decoration-color:color-mix(in srgb,currentColor 45%,transparent);transition:opacity .2s}
.osb-pied-retour:hover{opacity:1}
.osb-pied-t{margin:18px 0 10px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.55}
.osb-pied-liste{margin:0;font-size:15px;line-height:1.7}
.osb-pied-liste a{color:inherit;font-weight:700;text-underline-offset:4px;text-decoration-thickness:1px}
.osb-pied-liste span{opacity:.45;margin:0 .45em}
.osb-pied-jeux{display:grid;grid-template-columns:1fr;gap:14px}
@media (min-width:600px){.osb-pied-jeux{grid-template-columns:repeat(2,1fr);gap:16px}}
.osb-carte{position:relative;display:block;border-radius:14px;overflow:hidden;text-decoration:none;color:#fff;background:#111;aspect-ratio:16/10;box-shadow:0 0 0 1px rgba(255,255,255,.14);transition:transform .2s,box-shadow .2s}
.osb-carte i{position:absolute;inset:0;background:center/cover no-repeat;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
.osb-carte:hover i{transform:scale(1.035)}
.osb-carte:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(255,255,255,.4),0 10px 24px rgba(0,0,0,.4)}
.osb-carte span{position:absolute;left:0;right:0;bottom:0;padding:38px 14px 12px;font:500 13px/1.3 "Inter Tight","Helvetica Neue",Arial,sans-serif;text-align:left;color:rgba(255,255,255,.82);background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.88))}
.osb-carte b{display:block;margin-bottom:2px;font-size:18px;font-weight:700;color:#fff;letter-spacing:-.01em}
.osb-carte em{position:absolute;top:10px;left:10px;z-index:1;padding:3px 6px;border-radius:999px;background:var(--o-accent);color:var(--o-sur-accent);font:700 9.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;font-style:normal}
@media (prefers-reduced-motion:reduce){.osb-voile,.osb-poste{transition:none}.osb-rouge,.osb-ecran i{animation:none}}
`;
    document.head.appendChild(s);
  }

  let ouvert = null;
  function ouvrir(html, { fermable = true } = {}) {
    style(); if (ouvert) ouvert.fermer();
    const v = document.createElement('div'); v.className = 'osb-voile'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
    v.innerHTML = '<div class="osb-poste">' + html + '</div>'; habiller(v);
    document.body.appendChild(v);
    const avant = document.activeElement;
    let finir; const fini = new Promise((r) => (finir = r));
    const api = { el: v, fini, fermer(val) { if (!v.isConnected) return; v.classList.remove('osb-on'); removeEventListener('keydown', touche, true); ouvert = null; setTimeout(() => v.remove(), calme ? 0 : 280); try { avant && avant.focus({ preventScroll: true }); } catch (e) {} finir(val); } };
    const touche = (e) => { if (e.key === 'Escape' && api.fermable !== false) { e.stopPropagation(); api.fermer('passe'); } else e.stopPropagation(); };
    api.fermable = fermable;
    addEventListener('keydown', touche, true);
    v.addEventListener('pointerdown', (e) => { if (e.target === v && api.fermable !== false) api.fermer('passe'); });
    requestAnimationFrame(() => v.classList.add('osb-on'));
    ouvert = api; return api;
  }

  const OSB = {
    jeux: JEUX,
    ici(id) {
      const v = mem.lire('osb-vus', {}); const j = v[id] || { n: 0 }; j.n++; j.t = Date.now(); v[id] = j; mem.ecrire('osb-vus', v); OSB.site = id;
      // on arrive d'un autre jeu : un mot d'accueil, et le chemin du retour
      try {
        const q = new URLSearchParams(location.search), d = q.get('depuis'), de = JEUX.find((x) => x.id === d);
        if (d) { q.delete('depuis'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }
        if (de && d !== id) OSB.mot('Tu arrives de <b>' + h(de.nom) + '</b>', 'y retourner', lien(de, id));
      } catch (e) {}
      return v;
    },
    mot(html, action, url) {
      style(); const m = habiller(document.createElement('div')); m.className = 'osb-mot';
      m.innerHTML = '<span>' + html + '</span>' + (action ? '<a href="' + url + '">' + h(action) + '</a>' : '') + '<button type="button" aria-label="Fermer">✕</button>';
      document.body.appendChild(m); requestAnimationFrame(() => m.classList.add('osb-on'));
      const partir = () => { m.classList.remove('osb-on'); setTimeout(() => m.remove(), 400); };
      m.querySelector('button').onclick = partir; setTimeout(partir, 7000);
    },
    vus() { return mem.lire('osb-vus', {}); },
    autres(id) { const v = OSB.vus(); return JEUX.filter((j) => j.id !== (id || OSB.site)).sort((a, b) => (v[a.id] ? 1 : 0) - (v[b.id] ? 1 : 0)); },

    /* la coupure pub, avec parcimonie : au plus une par jour, tous jeux confondus ; jamais pendant la toute première visite d'un jeu ;
       et jamais dans une visite où l'on a déjà vu les cartes des autres jeux en bas de page (une réclame à la fois, pas les deux) */
    pubPossible(ici) {
      const v = OSB.vus()[ici || OSB.site];
      return !OSB._pubVue && !OSB._piedVu && !!v && v.n >= 2 && Date.now() - mem.lire('osb-pub-t', 0) > 20 * 3600 * 1000;
    },
    pub({ ici, force = false, attente = 3, auto = 0 } = {}) {
      if (!force && !OSB.pubPossible(ici)) return Promise.resolve(null);
      const choix = OSB.autres(ici); if (!choix.length) return Promise.resolve(null);
      // de préférence un jeu jamais ouvert ; sinon, pas le même que la dernière fois
      const v = OSB.vus(), neufs = choix.filter((j) => !v[j.id]), dernier = mem.lire('osb-pub-j', '');
      const lot = (neufs.length ? neufs : choix).filter((j) => j.id !== dernier);
      const j = (lot.length ? lot : choix)[Math.floor(Math.random() * (lot.length ? lot.length : choix.length))];
      const slogan = j.pubs[Math.floor(Math.random() * j.pubs.length)];
      OSB._pubVue = true; mem.ecrire('osb-pub-t', Date.now()); mem.ecrire('osb-pub-j', j.id);
      const f = ouvrir(
        '<div class="osb-bandeau"><span class="osb-rouge"></span><span><b>Coupure pub</b></span><span id="osb-reprise">reprise dans ' + attente + '</span></div>' +
        '<a class="osb-ecran" href="' + lien(j, ici) + '" style="background-image:url(' + RACINE + j.img + ')" aria-label="' + h(j.nom) + '"><i></i></a>' +
        '<div class="osb-texte"><div class="osb-marque">OSB Corporation présente</div><div class="osb-nom">' + h(j.nom) + '</div><p class="osb-slogan">' + h(slogan) + '</p><p class="osb-genre">' + h(j.genre) + '</p></div>' +
        '<div class="osb-boutons"><a class="osb-b osb-or" href="' + lien(j, ici) + '">J’y vais</a><button class="osb-b" type="button" id="osb-passer" disabled>Passer (' + attente + ')</button></div>' +
        '<div class="osb-mention">Votre programme reprend juste après. Aucun annonceur n’a été payé.</div>', { fermable: false });
      const b = f.el.querySelector('#osb-passer'), r = f.el.querySelector('#osb-reprise'); let n = attente;
      const tic = setInterval(() => { n--; if (n > 0) { b.textContent = 'Passer (' + n + ')'; r.textContent = 'reprise dans ' + n; } else { clearInterval(tic); b.disabled = false; b.textContent = 'Passer la pub'; r.textContent = 'vous pouvez passer'; f.fermable = true; b.focus({ preventScroll: true }); } }, 1000);
      b.onclick = () => f.fermer('passe');
      const fin = auto ? setTimeout(() => f.fermer('auto'), auto * 1000) : 0;
      f.fini.then(() => { clearInterval(tic); clearTimeout(fin); });
      return f.fini;
    },

    /* les retours des visiteurs */
    retour({ ici, contexte = '' } = {}) {
      const site = ici || OSB.site || location.pathname;
      const f = ouvrir(
        '<button class="osb-x" type="button" aria-label="Fermer">✕</button>' +
        '<h2 class="osb-titre">Un retour ? Un commentaire ? Un bug à partager ?</h2>' +
        '<p class="osb-sous">Ça arrive directement chez Amélien. Trois mots suffisent.</p>' +
        '<textarea class="osb-champ" id="osb-msg" maxlength="1500" placeholder="Ce qui t’a plu, ce qui t’a agacé, ce qui a planté…"></textarea>' +
        '<input class="osb-champ" id="osb-qui" maxlength="80" placeholder="Ton prénom ou un contact, si tu veux une réponse (facultatif)">' +
        '<div class="osb-boutons"><button class="osb-b osb-or" type="button" id="osb-envoi">Envoyer</button></div>');
      const msg = f.el.querySelector('#osb-msg'); setTimeout(() => msg.focus({ preventScroll: true }), 60);
      f.el.querySelector('.osb-x').onclick = () => f.fermer();
      f.el.querySelector('#osb-envoi').onclick = () => {
        const t = msg.value.replace(/\s+/g, ' ').trim(), qui = f.el.querySelector('#osb-qui').value.trim();
        if (t.length < 2) { msg.focus(); return; }
        const corps = new URLSearchParams();
        corps.append(FORMULAIRE.message, '[Retour · ' + site + '] ' + t + (qui ? ' — ' + qui : ''));
        corps.append(FORMULAIRE.lieu, site + (contexte ? ' · ' + contexte : '') + ' · ' + (innerWidth < 700 ? 'téléphone' : 'ordinateur'));
        try { fetch(FORMULAIRE.url, { method: 'POST', mode: 'no-cors', body: corps }).catch(() => {}); } catch (e) {}
        const file = mem.lire('osb-retours', []); file.push({ site, t, qui, quand: Date.now() }); mem.ecrire('osb-retours', file.slice(-30));
        f.el.querySelector('.osb-poste').innerHTML = '<div class="osb-merci"><b>Merci.</b>C’est parti. Si c’est un bug, il a déjà peur.</div><div class="osb-boutons"><button class="osb-b" type="button" id="osb-ok">Fermer</button></div>';
        f.el.querySelector('#osb-ok').onclick = () => f.fermer(); setTimeout(() => f.fermer(), 2600);
      };
      return f.fini;
    },

    /* en fin de visite : la ligne des retours, puis les autres jeux, en grandes cartes (par ordre alphabétique).
       Si une coupure pub est déjà passée pendant cette visite, une simple ligne de liens suffit. */
    pied(el, { ici, contexte = '', jeux = true, titre = 'Les autres jeux d’OSB Corporation' } = {}) {
      if (!el) return null; style();
      const v = OSB.vus(), d = habiller(document.createElement('div'), ici); d.className = 'osb-pied';
      const liste = OSB.autres(ici).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      d.innerHTML = '<button class="osb-pied-retour" type="button">Un retour ? Un commentaire ? Un bug à partager ?</button>' + (!jeux ? '' : OSB._pubVue
        ? '<div class="osb-pied-t">' + h(titre) + '</div><p class="osb-pied-liste">' + liste.map((j) => '<a href="' + lien(j, ici) + '">' + h(j.nom) + '</a>').join('<span>·</span>') + '</p>'
        : '<div class="osb-pied-t">' + h(titre) + '</div><div class="osb-pied-jeux">' + liste.map((j) =>
          '<a class="osb-carte" href="' + lien(j, ici) + '"><i style="background-image:url(' + RACINE + j.img + ')"></i>' + (v[j.id] ? '' : '<em>pas encore vu</em>') + '<span><b>' + h(j.nom) + '</b>' + h(j.genre) + '</span></a>').join('') + '</div>');
      d.querySelector('.osb-pied-retour').onclick = () => OSB.retour({ ici, contexte });
      el.appendChild(d);
      // les cartes ont été vues (au moins un tiers à l'écran) : pas de coupure pub en plus pendant cette visite
      const g = d.querySelector('.osb-pied-jeux');
      if (g && 'IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { OSB._piedVu = true; io.disconnect(); } }, { threshold: .34 }); io.observe(g); }
      return d;
    },
  };
  window.OSB = OSB;
  // essais : ?pub force une coupure pub, ?retour ouvre la fenêtre des retours
  addEventListener('load', () => { const q = new URLSearchParams(location.search); if (q.has('pub')) OSB.pub({ ici: OSB.site, force: true }); if (q.has('retour')) OSB.retour({ ici: OSB.site }); });
})();
