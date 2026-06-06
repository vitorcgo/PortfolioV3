/* Cena 3D do Hero v2 — ajuste de contenção editorial.
   Densidade da esfera reduzida, fios são curvas bezier temporárias,
   prisma projeta uma lente CSS real que distorce a tipografia. */
(function(){
  const canvas = document.getElementById('hero3d');
  if(!canvas || typeof THREE === 'undefined') return;

  const hero = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 8.5);

  const wine = new THREE.Color('#7a1f2b');
  const wineLite = new THREE.Color('#a23a48');
  function isDark(){ return document.documentElement.getAttribute('data-theme') === 'dark'; }

  // ------------- Sobreposição de lente (proxy CSS de refração) -------------
  const lens = document.createElement('div');
  lens.className = 'hero-lens';
  hero.appendChild(lens);

  // ------------- Partículas (1800 — eram 2400) -------------
  const N = 1800;
  const sphereTarget = new Float32Array(N*3);
  const vgTarget = new Float32Array(N*3);
  const codeTarget = new Float32Array(N*3);
  const current = new Float32Array(N*3);
  const centerFade = new Float32Array(N); // multiplicador de opacidade por ponto

  const SPHERE_R = 3.4;
  for(let i=0; i<N; i++){
    const t = (i + 0.5) / N;
    const phi = Math.acos(1 - 2*t);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    sphereTarget[i*3]   = SPHERE_R * Math.sin(phi) * Math.cos(theta);
    sphereTarget[i*3+1] = SPHERE_R * Math.sin(phi) * Math.sin(theta);
    sphereTarget[i*3+2] = SPHERE_R * Math.cos(phi);
  }

  function sampleText(text, font, size, scale){
    const off = document.createElement('canvas');
    off.width = 800; off.height = 400;
    const ctx = off.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, off.width/2, off.height/2);
    const data = ctx.getImageData(0, 0, off.width, off.height).data;
    const pts = [];
    const step = 5;
    for(let y=0; y<off.height; y+=step){
      for(let x=0; x<off.width; x+=step){
        if(data[(y*off.width + x)*4 + 3] > 128){
          pts.push([(x - off.width/2)/scale, -(y - off.height/2)/scale]);
        }
      }
    }
    for(let i=pts.length-1; i>0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }
  function fillTargetFromPts(arr, pts, depth){
    for(let i=0; i<N; i++){
      const p = pts[i % pts.length];
      const jitter = (Math.random()-0.5) * 0.08;
      arr[i*3]   = p[0] + jitter;
      arr[i*3+1] = p[1] + jitter;
      arr[i*3+2] = (Math.random()-0.5) * (depth || 0.4);
    }
  }
  fillTargetFromPts(vgTarget,   sampleText('VG',  'bold 320px "Cormorant Garamond", "Times New Roman", serif', 320, 70), 0.5);
  fillTargetFromPts(codeTarget, sampleText('</>', '600 280px "JetBrains Mono", "Menlo", monospace', 280, 75), 0.5);
  current.set(sphereTarget);

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(current, 3));
  const colors = new Float32Array(N*3);
  for(let i=0; i<N; i++){
    const mix = Math.random();
    const c = wine.clone().lerp(wineLite, mix * 0.4);
    colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
  }
  pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pMat = new THREE.PointsMaterial({
    size: 0.038, sizeAttenuation: true,
    vertexColors: true,
    transparent: true, opacity: 0.65,
    depthWrite: false,
    blending: THREE.NormalBlending // menos brilho que o aditivo
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // ------------- Fios bezier temporários -------------
  // Mantemos um número fixo de fios, cada um com ciclo de vida: escolhe dois pontos distantes,
  // fade rápido para não parecer que um fio "trava" em cima do título.
  const THREAD_COUNT = 4;
  const CURVE_SEG = 24;
  const threads = [];
  function makeThread(){
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CURVE_SEG * 3), 3));
    const mat = new THREE.LineBasicMaterial({ color: wineLite, transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    return {
      line, mat, geo,
      a: 0, b: 0,
      t: Math.random() * 4, // início escalonado
      dur: 3 + Math.random() * 1.2,
      curveBow: 0.5,
      pickNew(){
        // escolhe dois pontos distantes na geometria atual
        const cp = pGeo.attributes.position.array;
        let bestA=0, bestB=0, bestD=0;
        for(let k=0; k<6; k++){
          const a = Math.floor(Math.random()*N);
          const b = Math.floor(Math.random()*N);
          const dx = cp[a*3]-cp[b*3], dy = cp[a*3+1]-cp[b*3+1], dz = cp[a*3+2]-cp[b*3+2];
          const d = dx*dx+dy*dy+dz*dz;
          if(d > bestD){ bestD = d; bestA = a; bestB = b; }
        }
        this.a = bestA; this.b = bestB;
        this.curveBow = 0.4 + Math.random() * 0.9;
        this.bowDir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
      }
    };
  }
  for(let i=0; i<THREAD_COUNT; i++) threads.push(makeThread());
  threads.forEach(th => th.pickNew());

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3(), _ctrl = new THREE.Vector3(), _pt = new THREE.Vector3();
  function updateThread(th, dt){
    th.t += dt;
    const phase = (th.t % th.dur) / th.dur; // 0..1
    if(phase < 0.001 && th.t > th.dur) th.pickNew();
    // reescolher ao reiniciar o ciclo
    if(th.t > th.dur){ th.t = th.t % th.dur; th.pickNew(); }
    let alpha;
    if(phase < 0.1) alpha = phase / 0.1;                // aparecer
    else if(phase < 0.78) alpha = 1;                    // manter
    else alpha = 1 - (phase - 0.78) / 0.22;             // desaparecer
    alpha = Math.max(0, Math.min(1, alpha)) * 0.12;
    th.mat.opacity = alpha;

    const cp = pGeo.attributes.position.array;
    _a.set(cp[th.a*3], cp[th.a*3+1], cp[th.a*3+2]);
    _b.set(cp[th.b*3], cp[th.b*3+1], cp[th.b*3+2]);
    _mid.copy(_a).add(_b).multiplyScalar(0.5);
    _ctrl.copy(_mid).addScaledVector(th.bowDir, th.curveBow);
    const arr = th.geo.attributes.position.array;
    for(let i=0; i<CURVE_SEG; i++){
      const u = i / (CURVE_SEG - 1);
      // bezier quadrático
      const oneMinusU = 1 - u;
      _pt.set(0,0,0)
         .addScaledVector(_a, oneMinusU*oneMinusU)
         .addScaledVector(_ctrl, 2 * oneMinusU * u)
         .addScaledVector(_b, u*u);
      arr[i*3]   = _pt.x;
      arr[i*3+1] = _pt.y;
      arr[i*3+2] = _pt.z;
    }
    th.geo.attributes.position.needsUpdate = true;
  }

  // ------------- Prisma de vidro -------------
  const prismGroup = new THREE.Group();
  const prismGeo = new THREE.BoxGeometry(0.7, 4.8, 0.7);
  const prismFill = new THREE.Mesh(prismGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false
  }));
  const prismEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(prismGeo),
    new THREE.LineBasicMaterial({color: wineLite, transparent: true, opacity: 0.4})
  );
  const prismGhostR = new THREE.LineSegments(
    new THREE.EdgesGeometry(prismGeo),
    new THREE.LineBasicMaterial({color: 0xff5566, transparent: true, opacity: 0, blending: THREE.AdditiveBlending})
  );
  prismGhostR.position.x = 0.025;
  const prismGhostB = new THREE.LineSegments(
    new THREE.EdgesGeometry(prismGeo),
    new THREE.LineBasicMaterial({color: 0x5566ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending})
  );
  prismGhostB.position.x = -0.025;
  prismGroup.add(prismFill, prismEdges, prismGhostR, prismGhostB);
  prismGroup.position.set(-12, 0.5, 1);
  prismGroup.rotation.z = 0.18;
  scene.add(prismGroup);

  // ------------- Estado de interação -------------
  const mouse = {x: 0, y: 0, tx: 0, ty: 0};
  window.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
  });

  let scrollProgress = 0;
  function updateScroll(){
    const sy = window.scrollY;
    const h = hero.offsetHeight;
    scrollProgress = Math.max(0, Math.min(1, sy / (h * 0.9)));
  }
  window.addEventListener('scroll', updateScroll, {passive: true});
  updateScroll();

  function resize(){
    const r = hero.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Fade central: escurece pontos cuja projeção na tela está perto do centro (atrás do título)
  // Calculado a cada frame — N é pequeno o suficiente pra calcular tudo.
  const _proj = new THREE.Vector3();
  function recomputeCenterFade(){
    const pos = pGeo.attributes.position.array;
    for(let i=0; i<N; i++){
      _proj.set(pos[i*3], pos[i*3+1], pos[i*3+2]);
      _proj.applyMatrix4(points.matrixWorld).project(camera);
      // distância do centro da tela (0,0). Escurece pontos dentro do raio 0.45.
      const d = Math.hypot(_proj.x * 1.2, _proj.y); // y com mais peso (título fica no meio)
      const fade = Math.max(0.18, Math.min(1, (d - 0.18) / 0.5));
      centerFade[i] = fade;
    }
  }

  // ------------- Animar -------------
  let lastT = performance.now();
  let prismCycleT = -3;

  function animate(){
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    // morph (transição de forma)
    const sp = scrollProgress;
    let aArr, bArr, mix;
    if(sp < 0.5){ aArr = sphereTarget; bArr = vgTarget;   mix = sp * 2; }
    else        { aArr = vgTarget;     bArr = codeTarget; mix = (sp - 0.5) * 2; }
    mix = mix * mix * (3 - 2 * mix);

    const breath = 1 + Math.sin(now * 0.00045) * 0.03;

    const pos = pGeo.attributes.position.array;
    for(let i=0; i<N; i++){
      const i3 = i*3;
      const tx = (aArr[i3]   * (1-mix) + bArr[i3]   * mix) * breath;
      const ty = (aArr[i3+1] * (1-mix) + bArr[i3+1] * mix) * breath;
      const tz = (aArr[i3+2] * (1-mix) + bArr[i3+2] * mix) * breath;
      pos[i3]   += (tx - pos[i3])   * 0.05;
      pos[i3+1] += (ty - pos[i3+1]) * 0.05;
      pos[i3+2] += (tz - pos[i3+2]) * 0.05;
    }
    pGeo.attributes.position.needsUpdate = true;

    points.rotation.y += 0.0012 + (mouse.x * 0.3 - points.rotation.y) * 0.025;
    points.rotation.x += (mouse.y * 0.18 - points.rotation.x) * 0.025;
    points.updateMatrixWorld();

    // recalcula fade e escreve brilho no atributo de cor (lerp em direção ao fundo)
    recomputeCenterFade();
    const cAttr = pGeo.attributes.color.array;
    const dim = isDark() ? 0.18 : 0.30; // brilho residual para pontos centrais
    for(let i=0; i<N; i++){
      const f = centerFade[i];
      // cor base não armazenada separado mutamos o atributo de cor ao vivo.
      // Para evitar deriva, derivamos o tom base do índice a cada frame.
      const baseR = 0.31 + (i % 7) * 0.01;   // tons aproximados de vinho
      const baseG = 0.10;
      const baseB = 0.14;
      cAttr[i*3]   = baseR * f + dim * (1-f);
      cAttr[i*3+1] = baseG * f + dim * (1-f);
      cAttr[i*3+2] = baseB * f + dim * (1-f);
    }
    pGeo.attributes.color.needsUpdate = true;

    // fios
    threads.forEach(th => updateThread(th, dt));

    // prisma
    prismCycleT += dt * 0.06;
    const cycleLen = 1.8;
    const cyclePos = ((prismCycleT % cycleLen) - 0.3) / 1.0; // visível em 0..1
    let prismVisible = false;
    let lensAlpha = 0;
    let lensX = 0, lensY = 0;
    if(cyclePos >= 0 && cyclePos <= 1){
      const eased = cyclePos * cyclePos * (3 - 2*cyclePos);
      prismGroup.position.x = -11 + eased * 22;
      prismGroup.position.y = 0.3 + Math.sin(cyclePos * Math.PI) * 0.8;
      prismGroup.rotation.y += 0.005;
      prismGroup.rotation.x += 0.0015;
      const visAlpha = Math.sin(cyclePos * Math.PI);
      prismEdges.material.opacity = 0.38 * visAlpha;
      prismGhostR.material.opacity = 0.14 * visAlpha;
      prismGhostB.material.opacity = 0.14 * visAlpha;
      prismFill.material.opacity = 0.04 * visAlpha;
      prismGroup.visible = true;
      prismVisible = true;

      // projeta posição do prisma no mundo para a tela (lente CSS)
      _proj.copy(prismGroup.position).project(camera);
      const r = hero.getBoundingClientRect();
      lensX = (_proj.x * 0.5 + 0.5) * r.width;
      lensY = (1 - (_proj.y * 0.5 + 0.5)) * r.height;
      lensAlpha = visAlpha;
    } else {
      prismGroup.visible = false;
    }

    // atualiza lente no DOM (operação barata)
    if(prismVisible){
      lens.classList.add('active');
      lens.style.opacity = lensAlpha.toFixed(3);
      lens.style.transform = `translate(${lensX - 90}px, ${lensY - 220}px) rotate(${10 - cyclePos*20}deg)`;
    } else if(lens.classList.contains('active')){
      lens.style.opacity = '0';
      setTimeout(()=>lens.classList.remove('active'), 260);
    }

    pMat.opacity = isDark() ? 0.70 : 0.50;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})();
