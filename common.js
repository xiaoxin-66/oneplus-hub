(function securityGuard() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (e.key === 'F12' || e.keyCode === 123) { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && /^[IicjJ]$/.test(e.key)) { e.preventDefault(); return false; }
    if (e.ctrlKey && /^[Uu]$/.test(e.key)) { e.preventDefault(); return false; }
  });
})();

(function meteorEngine() {
  function spawnMeteor() {
    const meteor = document.createElement('div');
    meteor.classList.add('meteor');
    meteor.style.left = (Math.random() * (window.innerWidth + 500) - 100) + 'px';
    meteor.style.top = (Math.random() * (window.innerHeight - 200) - 400) + 'px';
    const duration = Math.random() * 2 + 5;
    meteor.style.animation = `meteorFall ${duration}s linear forwards`;
    document.body.appendChild(meteor);
    setTimeout(() => { meteor.remove(); }, (duration + 0.5) * 1000);
  }
  function meteorLoop() {
    if (Math.random() > 0.4) spawnMeteor();
    setTimeout(meteorLoop, Math.random() * 3000 + 2000);
  }
  setTimeout(meteorLoop, 1000);
})();

(function planet3D() {
  const canvas = document.getElementById('planet3d');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const TAU = Math.PI * 2;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const RIN  = 1.40;
  const ROUT = 2.34;
  const TILT = 0.44;

  const SS = Math.min(3, Math.max(2, Math.round(DPR * 1.5)));
  const STOPS = 160;

  let cssW = 0, cssH = 0, cx = 0, cy = 0, R = 0;
  let ringCanvas = null, ringCtx = null, glowCanvas = null, ringBox = null;
  let noiseTex = null;
  let running = true, rafId = 0, sizeTimer = 0;

  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function density(t) {
    if (t <= 0 || t >= 1) return 0;
    const fadeIn  = smooth(0, 0.05, t);
    const fadeOut = 1 - smooth(0.88, 1.0, t);
    const band =
        0.64
      + 0.17 * Math.sin(t * 7.5  + 0.9)
      + 0.14 * Math.sin(t * 19.0 + 2.7)
      + 0.08 * Math.sin(t * 37.0 + 4.4)
      + 0.04 * Math.sin(t * 63.0 + 1.2);
    const gapA = 1 - 0.85 * Math.exp(-Math.pow((t - 0.55) / 0.032, 2));
    const gapB = 1 - 0.50 * Math.exp(-Math.pow((t - 0.79) / 0.014, 2));
    const taper = 0.42 + 0.58 * Math.sin(Math.PI * Math.pow(t, 0.55));
    return Math.max(0, band * gapA * gapB * taper * fadeIn * fadeOut);
  }

  function colorAt(t, a) {
    const A = [222, 238, 255], B = [166, 198, 255], C = [116, 146, 216];
    let f, g, p;
    if (t < 0.5) { f = A; g = B; p = t / 0.5; }
    else         { f = B; g = C; p = (t - 0.5) / 0.5; }
    const r = Math.round(f[0] + (g[0] - f[0]) * p);
    const gg = Math.round(f[1] + (g[1] - f[1]) * p);
    const b = Math.round(f[2] + (g[2] - f[2]) * p);
    return 'rgba(' + r + ',' + gg + ',' + b + ',' + a.toFixed(3) + ')';
  }

  function buildNoise() {
    const n = document.createElement('canvas');
    n.width = n.height = 256;
    const nc = n.getContext('2d');
    const img = nc.createImageData(256, 256);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
      d[i + 3] = Math.random() < 0.5 ? 0 : Math.random() * 255;
    }
    nc.putImageData(img, 0, 0);
    noiseTex = n;
  }

  function buildRing() {
    const sinA = Math.sin(TILT);
    const rIn = RIN * R, rOut = ROUT * R;
    const halfW = rOut + 14;
    const halfH = rOut * sinA + 14;
    const w = Math.ceil(halfW * 2);
    const h = Math.ceil(halfH * 2);
    ringBox = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: w, h: h };

    if (!ringCanvas) {
      ringCanvas = document.createElement('canvas');
      ringCtx = ringCanvas.getContext('2d');
    }
    const bw = Math.max(1, Math.min(2048, Math.round(w * SS)));
    const bh = Math.max(1, Math.min(2048, Math.round(h * SS)));
    ringCanvas.width = bw;
    ringCanvas.height = bh;

    const g = ringCtx;
    const k = bw / w;
    g.setTransform(k, 0, 0, k, -ringBox.x * k, -ringBox.y * k);
    g.clearRect(ringBox.x, ringBox.y, w, h);

    g.save();
    g.translate(cx, cy);
    g.scale(1, sinA);

    g.beginPath();
    g.ellipse(0, 0, rOut, rOut, 0, 0, TAU, false);
    g.ellipse(0, 0, rIn, rIn, 0, 0, TAU, true);
    g.clip();

    const grad = g.createRadialGradient(0, 0, rIn, 0, 0, rOut);
    for (let i = 0; i < STOPS; i++) {
      const t = i / (STOPS - 1);
      const den = density(t);
      grad.addColorStop(t, colorAt(t, Math.min(0.92, den * 0.78)));
    }
    g.fillStyle = grad;
    g.fillRect(-rOut, -rOut, rOut * 2, rOut * 2);

    g.globalCompositeOperation = 'source-atop';
    const light = g.createLinearGradient(-rOut, -rOut, rOut * 0.7, rOut);
    light.addColorStop(0, 'rgba(255,255,255,0.18)');
    light.addColorStop(0.42, 'rgba(255,255,255,0.02)');
    light.addColorStop(0.75, 'rgba(6,16,48,0.16)');
    light.addColorStop(1, 'rgba(0,8,30,0.34)');
    g.fillStyle = light;
    g.fillRect(-rOut, -rOut, rOut * 2, rOut * 2);

    const sheen = g.createLinearGradient(-rOut, rOut * 0.55, rOut * 0.15, -rOut);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.48, 'rgba(236,246,255,0.22)');
    sheen.addColorStop(0.62, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(-rOut, -rOut, rOut * 2, rOut * 2);

    if (noiseTex) {
      g.globalAlpha = 0.16;
      g.fillStyle = g.createPattern(noiseTex, 'repeat') || '#fff';
      g.fillRect(-rOut, -rOut, rOut * 2, rOut * 2);
      g.globalAlpha = 1;
    }

    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(226, 240, 255, 0.34)';
    g.beginPath(); g.ellipse(0, 0, rOut - g.lineWidth * 0.6, rOut - g.lineWidth * 0.6, 0, 0, TAU, false); g.stroke();
    g.strokeStyle = 'rgba(210, 232, 255, 0.26)';
    g.beginPath(); g.ellipse(0, 0, rIn + g.lineWidth * 0.6, rIn + g.lineWidth * 0.6, 0, 0, TAU, false); g.stroke();

    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);

    const gw = Math.round(bw / 2), gh = Math.round(bh / 2);
    if (!glowCanvas) glowCanvas = document.createElement('canvas');
    glowCanvas.width = gw;
    glowCanvas.height = gh;
    const gc = glowCanvas.getContext('2d');
    gc.clearRect(0, 0, gw, gh);
    if ('filter' in gc) gc.filter = 'blur(4px)';
    gc.drawImage(ringCanvas, 0, 0, gw, gh);
  }

  function drawRingHalf(front) {
    if (!ringCanvas || !ringBox) return;
    ctx.save();
    ctx.beginPath();
    if (front) ctx.rect(-2, -2, cssW + 4, cy + 2);
    else       ctx.rect(-2, cy, cssW + 4, cssH - cy + 4);
    ctx.clip();

    if (glowCanvas) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.30;
      ctx.drawImage(glowCanvas, ringBox.x, ringBox.y, ringBox.w, ringBox.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(ringCanvas, ringBox.x, ringBox.y, ringBox.w, ringBox.h);
    ctx.restore();
  }

  const spots = [];
  for (let i = 0; i < 12; i++) {
    spots.push({
      lon: Math.random() * TAU,
      lat: (Math.random() - 0.5) * 1.55,
      size: 0.12 + Math.random() * 0.18,
      dark: Math.random() > 0.45
    });
  }

  function drawSphere(phase) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();

    const base = ctx.createRadialGradient(
      cx - R * 0.38, cy - R * 0.42, R * 0.05, cx, cy, R * 1.12
    );
    base.addColorStop(0, '#c2d8ff');
    base.addColorStop(0.22, '#5f92e8');
    base.addColorStop(0.55, '#274a92');
    base.addColorStop(0.82, '#101c3d');
    base.addColorStop(1, '#05070f');
    ctx.fillStyle = base;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    for (let k = 0; k < spots.length; k++) {
      const sp = spots[k];
      const lon = sp.lon + phase;
      const cosL = Math.cos(lon);
      const cosLat = Math.cos(sp.lat);
      if (cosL * cosLat <= 0.02) continue;

      const x = cx + R * Math.sin(lon) * cosLat;
      const y = cy + R * Math.sin(sp.lat);
      const vis = Math.pow(cosL * cosLat, 0.6);
      const rad = R * sp.size * vis;
      if (rad < 0.5) continue;

      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      if (sp.dark) {
        gr.addColorStop(0, 'rgba(8, 18, 46,' + (0.55 * vis).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(8, 18, 46, 0)');
      } else {
        gr.addColorStop(0, 'rgba(180, 210, 255,' + (0.40 * vis).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(180, 210, 255, 0)');
      }
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, y, rad, rad * 0.82, 0, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const sh = ctx.createLinearGradient(cx, cy - R * 0.95, cx, cy + R * 0.45);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(0.45, 'rgba(0,0,0,0.22)');
    sh.addColorStop(0.62, 'rgba(0,0,0,0.10)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    const limb = ctx.createRadialGradient(cx, cy, R * 0.64, cx, cy, R);
    limb.addColorStop(0, 'rgba(0,0,0,0)');
    limb.addColorStop(0.74, 'rgba(0,0,0,0.20)');
    limb.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = limb;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    const hi = ctx.createRadialGradient(
      cx - R * 0.36, cy - R * 0.40, 0,
      cx - R * 0.36, cy - R * 0.40, R * 0.55
    );
    hi.addColorStop(0, 'rgba(255,255,255,0.44)');
    hi.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rim = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.06);
    rim.addColorStop(0, 'rgba(120, 170, 255, 0)');
    rim.addColorStop(0.55, 'rgba(120, 170, 255, 0.20)');
    rim.addColorStop(1, 'rgba(120, 170, 255, 0)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.07, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width || 500;
    cssH = rect.height || 500;
    if (!cssW || !cssH) return;
    canvas.width = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = cssW / 2;
    cy = cssH / 2;
    R = cssW * 0.16;
    buildRing();
  }

  function frame(tms) {
    if (!running) return;
    const time = tms / 1000;
    const phase = time * 0.22;
    if (!cssW) resize();

    ctx.clearRect(0, 0, cssW, cssH);

    const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.75);
    glow.addColorStop(0, 'rgba(92, 141, 255, 0.22)');
    glow.addColorStop(0.45, 'rgba(92, 141, 255, 0.07)');
    glow.addColorStop(1, 'rgba(92, 141, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.8, 0, TAU);
    ctx.fill();

    drawRingHalf(false);
    drawSphere(phase);
    drawRingHalf(true);

    rafId = requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  });

  window.addEventListener('resize', function () {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(resize, 160);
  });

  buildNoise();
  resize();
  rafId = requestAnimationFrame(frame);
})();

(function linkGuard() {
  const KEY = [0x5b, 0xa3, 0x17, 0xcc, 0x6e, 0x92, 0x41, 0xd8, 0x2f, 0x77, 0xb4, 0x09, 0xe6, 0x53, 0x8a, 0x3d];
  window.openLkUrl = function (token) {
    const p = token.indexOf(':');
    const n = parseInt(token.slice(0, p), 10) || 0;
    const s = atob(token.slice(p + 1));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const k = (i + n) & 15;
      out += String.fromCharCode(s.charCodeAt(i) ^ KEY[k] ^ (((i + n) * 7) & 255));
    }
    return out;
  };
  window.openLk = function (el) {
    let u = '';
    try { u = window.openLkUrl(el.getAttribute('data-lk')); } catch (e) { return false; }
    if (!u) return false;
    const w = window.open(u, '_blank');
    if (w) { try { w.opener = null; } catch (e) {} } else { location.href = u; }
    return false;
  };
})();
