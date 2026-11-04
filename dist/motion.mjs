// Presentation only. This module never reads or changes transaction state.
const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const control = document.getElementById('motion-toggle');
const canvas = document.getElementById('terrain-canvas');
const context = canvas?.getContext('2d', {alpha: true});
const section = document.getElementById('landscape');
let paused = false, visible = false, frame = 0, last = 0, elapsed = 0;
let width = 0, height = 0, pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;

function running() {
  return !paused && !reduced.matches && !document.hidden && body.dataset.page === 'home';
}

function paint(time) {
  if (!context || !width || !height) return;
  context.clearRect(0, 0, width, height);
  const columns = width < 600 ? 130 : 210;
  const rows = width < 600 ? 55 : 74;
  // Layered point terrain, intentionally decorative rather than network data.
  for (let row = rows; row >= 0; row--) {
    const depth = row / rows;
    const perspective = 1 - depth * .36;
    const points = [];
    for (let col = 0; col <= columns; col++) {
      const x = col / columns * 2.8 - 1.4;
      const left = 1.1 * Math.exp(-Math.pow((x + .95 - depth * .24) / .43, 2));
      const right = 1.2 * Math.exp(-Math.pow((x - .9 + depth * .25) / .39, 2));
      const ridge = .24 * Math.sin(x * 6 + depth * 7) * depth;
      const detail = .04 * Math.sin(x * 27 + depth * 19) + .025 * Math.cos(x * 41 - depth * 23);
      const breath = Math.sin(time * .3 + depth * 4 + x * 2) * .018;
      const elevation = Math.max(.02, left + right + ridge + detail + breath);
      const px = width / 2 + x * width * .54 * perspective + pointerX * (1 - depth) * 9;
      const py = height * (.98 - depth * .32 - elevation * .43 * perspective) + pointerY * depth * 5;
      points.push([px, py]);
    }
    context.beginPath();
    context.moveTo(points[0][0], height);
    for (const [x, y] of points) context.lineTo(x, y);
    context.lineTo(points.at(-1)[0], height);
    context.closePath();
    // Depth shading makes the point field read as a landscape, with a pale horizon.
    const shade = Math.round(30 + depth * 150);
    context.fillStyle = `rgba(${shade},${shade},${shade},${.25 + depth * .15})`;
    context.fill();
    context.fillStyle = `rgba(247,247,247,${.22 + depth * .2})`;
    for (let col = 0; col < points.length; col++) {
      const [x, y] = points[col];
      const size = (.8 + (1 - depth) * .7) * (width < 600 ? .8 : 1);
      context.fillRect(x, y, size, size);
      if (row % 2 === 0) {
        const drift = (Math.sin(col * 67.1 + row * 12.7) + 1) * 2.3;
        context.fillRect(x + drift, y + 3 + drift, size * .65, size * .65);
      }
      if (row === 0) {
        for (let grain = 1; grain < 28; grain++) {
          const noise = (Math.sin(col * 71.3 + grain * 29.7) + 1) / 2;
          const gy = y + (height - y) * grain / 28;
          context.fillRect(x + noise * 3, gy, .6 + noise, .6 + noise);
        }
      }
    }
  }
  const fog = context.createLinearGradient(0, height * .67, 0, height);
  fog.addColorStop(0, 'rgba(247,247,247,0)');
  fog.addColorStop(.72, 'rgba(247,247,247,0.15)');
  fog.addColorStop(1, 'rgba(247,247,247,0.65)');
  context.fillStyle = fog;
  context.fillRect(0, 0, width, height);
  const valley = context.createRadialGradient(width * .5, height * .91, 0, width * .5, height * .91, width * .48);
  valley.addColorStop(0, 'rgba(247,247,247,0.85)');
  valley.addColorStop(.45, 'rgba(247,247,247,0.34)');
  valley.addColorStop(1, 'rgba(247,247,247,0)');
  context.fillStyle = valley;
  context.fillRect(0, 0, width, height);
  canvas.dataset.ready = 'true';
}

function tick(now) {
  frame = 0;
  if (!running() || !visible) { last = 0; return; }
  if (!last || now - last >= 1000 / 30) {
    if (last) elapsed += Math.min(now - last, 70) / 1000;
    last = now;
    pointerX += (targetX - pointerX) * .045;
    pointerY += (targetY - pointerY) * .045;
    paint(elapsed);
  }
  frame = requestAnimationFrame(tick);
}

function sync() {
  const enabled = running();
  // Reconcile against the current layout when resuming. Observer callbacks can
  // arrive after a visibility or layout transition, so their last value alone
  // must not decide whether a fresh animation loop starts.
  const box = section.getBoundingClientRect();
  visible = box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
  body.dataset.motion = enabled ? 'running' : 'paused';
  control.disabled = reduced.matches;
  control.setAttribute('aria-pressed', String(!enabled));
  control.querySelector('span').textContent = reduced.matches ? 'Motion reduced' : paused ? 'Resume motion' : 'Pause motion';
  cancelAnimationFrame(frame);
  frame = 0;
  last = 0;
  if (context && enabled && visible) frame = requestAnimationFrame(tick);
}

function resize() {
  if (!context || !canvas) return;
  const box = canvas.getBoundingClientRect();
  if (!box.width || !box.height) return;
  width = box.width; height = box.height;
  const ratio = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  paint(elapsed);
}

control?.addEventListener('click', () => { paused = !paused; sync(); });
reduced.addEventListener('change', () => { sync(); paint(elapsed); });
document.addEventListener('visibilitychange', sync);
new MutationObserver(sync).observe(body, {attributes: true, attributeFilter: ['data-page']});

if (context) {
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) resize();
    sync();
  }).observe(section);
  section.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !running()) return;
    const box = section.getBoundingClientRect();
    targetX = (event.clientX - box.left) / box.width * 2 - 1;
    targetY = (event.clientY - box.top) / box.height * 2 - 1;
  }, {passive: true});
  section.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
  resize();
}

// Reveal once; navigation and reduced-motion mode never hide essential content.
const reveals = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    entry.target.classList.add('is-revealed');
    reveals.unobserve(entry.target);
  }
}, {threshold: .12});
document.querySelectorAll('[data-reveal]').forEach(element => reveals.observe(element));
body.classList.add('motion-ready');
sync();
