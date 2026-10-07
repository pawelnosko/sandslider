/**
 * SandSlider — slideshow with sandpixel blow transitions.
 * Top image blows away while the next image is revealed underneath.
 *
 * Usage:
 *   import { SandSlider } from './sandslider.js';
 *   const slider = await SandSlider.create(el, {
 *     images: [
 *       './a.webp',
 *       {
 *         src: './b.webp',
 *         header: 'Title',
 *         subheader: 'Short line',
 *         cta: { label: 'Learn more', href: '#', target: '_blank' },
 *       },
 *     ],
 *     nav: true,          // side prev/next (default true)
 *     pagination: true,   // dots under image (default true)
 *   });
 *
 * Requires THREE as an ES module import map or bundler dependency.
 */
import * as THREE from 'three';

const MODE_IDLE = 0;
const MODE_BLOW = 1;

/**
 * Normalize slide entry: string URL or { src, header, subheader, cta }.
 * cta may be { label, href, target } or use ctaLabel / ctaHref shortcuts.
 */
export function normalizeSlide(item, index = 0) {
  if (typeof item === 'string') {
    return {
      src: item,
      header: '',
      subheader: '',
      cta: null,
      index,
    };
  }
  if (!item?.src) {
    throw new Error(`SandSlider: slide ${index} needs a src`);
  }

  let cta = null;
  if (item.cta && typeof item.cta === 'object') {
    cta = {
      label: item.cta.label || item.cta.text || 'CTA',
      href: item.cta.href || item.cta.url || '#',
      target: item.cta.target || undefined,
    };
  } else if (typeof item.cta === 'string') {
    cta = {
      label: item.cta,
      href: item.ctaHref || item.href || '#',
      target: item.ctaTarget || undefined,
    };
  } else if (item.ctaLabel) {
    cta = {
      label: item.ctaLabel,
      href: item.ctaHref || item.href || '#',
      target: item.ctaTarget || undefined,
    };
  }

  return {
    src: item.src,
    header: item.header || item.title || '',
    subheader: item.subheader || item.text || item.description || '',
    cta,
    index,
  };
}

const DEFAULTS = {
  /**
   * Slides: string URLs and/or objects
   * { src, header?, subheader?, cta?: { label, href, target? } }.
   */
  images: [],
  /** How long the sharp slide stays before blowing (ms). */
  holdMs: 3200,
  /** Max long side of the sand grid (density). */
  maxLongSide: 900,
  /** Wind release span (seconds of stagger across the image). */
  releaseSpan: 1.9,
  /** Background clear color. */
  background: 0x050608,
  /** Auto-advance. */
  autoplay: true,
  /** Loop back to first slide. */
  loop: true,
  /** Start index. */
  startIndex: 0,
  /** Fit mode inside the container: 'cover' | 'contain'. */
  fit: 'contain',
  /**
   * CSS-px inset inside the container when fitting the image.
   * Number = all sides, or { top, right, bottom, left }.
   * Use bottom space for pagination / chrome so nothing clips off-screen.
   * Sand still renders full-bleed outside the image frame.
   */
  fitPadding: { top: 28, right: 28, bottom: 52, left: 28 },
  /**
   * Dim the under image while the top is blowing away.
   * After the top plate is gone, dim fades out smoothly.
   */
  dimUnder: true,
  /** How strong the under-dim is (0 = none, 1 = black). */
  dimAmount: 0.55,
  /** Fade-out duration of under-dim after top plate is gone (ms). */
  dimFadeMs: 900,
  /** Side prev/next controls on the image frame. */
  nav: true,
  /** Dot pagination under the image. */
  pagination: true,
  /** Optional: call when slide settles after a transition. */
  onSlide: null,
  /** Optional: call when a transition starts (fromIndex → toIndex). */
  onTransition: null,
  /**
   * Optional: call when the on-screen image frame changes
   * ({ left, top, width, height } in CSS px relative to container).
   * Use this to place UI on the image; sand still renders full-bleed outside.
   */
  onFrame: null,
};

const UI_CSS = /* css */ `
.sandslider-chrome{
  position:absolute;z-index:2;display:flex;flex-direction:column;
  pointer-events:none;max-width:100%;
}
.sandslider-frame{
  position:relative;width:100%;flex:0 0 auto;overflow:hidden;
  box-shadow:0 0 0 1px rgba(196,181,253,.12);
}
.sandslider-nav{
  position:absolute;top:50%;z-index:2;transform:translateY(-50%);
  width:2.85rem;height:2.85rem;padding:0;appearance:none;
  border:1px solid rgba(167,139,250,.55);border-radius:50%;
  background:rgba(20,10,40,.5);color:#f3eefc;display:grid;place-items:center;
  cursor:pointer;pointer-events:auto;backdrop-filter:blur(6px);
  transition:background .2s ease,border-color .2s ease,opacity .2s ease,transform .2s ease;
}
.sandslider-nav svg{
  width:1.1rem;height:1.1rem;display:block;fill:none;stroke:currentColor;
  stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round;
}
.sandslider-nav:hover:not(:disabled){
  background:rgba(124,58,237,.4);border-color:#c4b5fd;
}
.sandslider-nav:active:not(:disabled){transform:translateY(-50%) scale(.96)}
.sandslider-nav:disabled{opacity:.3;cursor:default}
.sandslider-nav-prev{left:.85rem}
.sandslider-nav-next{right:.85rem}
.sandslider-dots{
  display:flex;justify-content:center;align-items:center;flex-shrink:0;
  gap:.45rem;height:2rem;margin-top:.55rem;pointer-events:auto;
}
.sandslider-dots button{
  width:.55rem;height:.55rem;padding:0;border:none;border-radius:50%;
  background:rgba(196,181,253,.35);cursor:pointer;
  transition:background .2s ease,transform .2s ease;
}
.sandslider-dots button:hover{background:rgba(196,181,253,.65)}
.sandslider-dots button.active{background:#8b5cf6;transform:scale(1.2)}
@media (max-width:640px){
  .sandslider-nav{width:2.4rem;height:2.4rem}
  .sandslider-nav-prev{left:.45rem}
  .sandslider-nav-next{right:.45rem}
}
`;

function ensureUiStyles() {
  if (document.getElementById('sandslider-ui-css')) return;
  const style = document.createElement('style');
  style.id = 'sandslider-ui-css';
  style.textContent = UI_CSS;
  document.head.appendChild(style);
}

function makeChevron(dir) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  poly.setAttribute(
    'points',
    dir === 'prev' ? '15 6 9 12 15 18' : '9 6 15 12 9 18'
  );
  svg.appendChild(poly);
  return svg;
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Uneven wind front: top faster, mid slower bulge, bottom slightly faster. */
function windProfile(ny) {
  const mid = Math.sin(ny * Math.PI);
  let delayScale = 0.72 + mid * 0.55;
  delayScale -= smoothstep(0.55, 1, ny) * 0.12;
  const topBoost = (1 - ny) * 0.08;
  return { delayScale, topBoost };
}

function targetSize(imgW, imgH, maxLong) {
  const long = Math.max(imgW, imgH);
  if (long <= maxLong) return { width: imgW, height: imgH };
  const scale = maxLong / long;
  return {
    width: Math.max(1, Math.round(imgW * scale)),
    height: Math.max(1, Math.round(imgH * scale)),
  };
}

async function loadImage(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`SandSlider: failed to load ${src}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildPixelGrid(img, maxLongSide, releaseSpan) {
  const { width, height } = targetSize(img.width, img.height, maxLongSide);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const count = width * height;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseSpeed = new Float32Array(count);
  const accel = new Float32Array(count);
  const speedY = new Float32Array(count);
  const phase = new Float32Array(count);
  const releaseDelay = new Float32Array(count);
  const gap = 1;
  let i = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      const i3 = i * 3;

      positions[i3] = (x - (width - 1) / 2) * gap;
      positions[i3 + 1] = -((y - (height - 1) / 2) * gap);
      positions[i3 + 2] = 0;

      colors[i3] = data[p] / 255;
      colors[i3 + 1] = data[p + 1] / 255;
      colors[i3 + 2] = data[p + 2] / 255;

      baseSpeed[i] = 80 + Math.random() * 220;
      accel[i] = 350 + Math.random() * 650;
      speedY[i] = (Math.random() - 0.5) * 90;
      phase[i] = Math.random() * Math.PI * 2;

      const fromRight = 1 - x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const { delayScale, topBoost } = windProfile(ny);
      releaseDelay[i] =
        fromRight * releaseSpan * delayScale - topBoost + Math.random() * 0.25;

      i++;
    }
  }

  return {
    positions,
    colors,
    baseSpeed,
    accel,
    speedY,
    phase,
    releaseDelay,
    count,
    width,
    height,
    worldW: width * gap,
    worldH: height * gap,
  };
}

function createPlateMaterial(texture, releaseSpan) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uBlowAge: { value: -1 },
      uReleaseSpan: { value: releaseSpan },
      uLag: { value: 0.04 },
    },
    transparent: false,
    depthWrite: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uBlowAge;
      uniform float uReleaseSpan;
      uniform float uLag;
      varying vec2 vUv;

      float releaseThreshold(vec2 uv) {
        float fromRight = 1.0 - uv.x;
        float ny = 1.0 - uv.y;
        float mid = sin(ny * 3.14159265);
        float delayScale = 0.72 + mid * 0.55;
        delayScale -= smoothstep(0.55, 1.0, ny) * 0.12;
        float topBoost = (1.0 - ny) * 0.08;
        float n = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        return fromRight * uReleaseSpan * delayScale - topBoost + n * 0.25;
      }

      void main() {
        if (uBlowAge >= 0.0 && (uBlowAge - uLag) > releaseThreshold(vUv)) {
          discard;
        }
        vec4 c = texture2D(uMap, vUv);
        gl_FragColor = vec4(c.rgb, 1.0);
      }
    `,
  });
}

/** Sharp under-layer — no discard; revealed as top plate erodes. */
function createUnderMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      /** 0 = full brightness, 1 = black */
      uDim: { value: 0 },
    },
    transparent: false,
    depthWrite: true,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uDim;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        float bright = 1.0 - clamp(uDim, 0.0, 1.0);
        gl_FragColor = vec4(c.rgb * bright, 1.0);
      }
    `,
  });
}

function createSandMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBlowAge: { value: 0 },
      uTime: { value: 0 },
      uEdge: { value: -900 },
      uSize: { value: 1.2 },
      uActive: { value: 0 },
    },
    transparent: false,
    depthWrite: true,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aBaseSpeed;
      attribute float aAccel;
      attribute float aSpeedY;
      attribute float aPhase;
      attribute float aRelease;

      uniform float uBlowAge;
      uniform float uTime;
      uniform float uEdge;
      uniform float uSize;
      uniform float uActive;

      varying vec3 vColor;

      void main() {
        vColor = aColor;
        vec3 home = position;
        vec3 pos = home;

        if (uActive > 0.5) {
          float flyAge = uBlowAge - aRelease;
          if (flyAge > 0.0) {
            pos.x = home.x - (aBaseSpeed * flyAge + 0.5 * aAccel * flyAge * flyAge);
            pos.y = home.y + aSpeedY * flyAge
                  + sin(uTime * 8.0 + aPhase) * 18.0 * min(flyAge, 1.0);
            pos.z = home.z
                  + cos(uTime * 6.0 + aPhase) * 12.0 * min(flyAge, 1.0);
            if (pos.x < uEdge) pos.x = uEdge - 20.0;
          }
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = uSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
  });
}

function applyGridToGeometry(geometry, grid) {
  geometry.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(grid.colors, 3));
  geometry.setAttribute('aBaseSpeed', new THREE.BufferAttribute(grid.baseSpeed, 1));
  geometry.setAttribute('aAccel', new THREE.BufferAttribute(grid.accel, 1));
  geometry.setAttribute('aSpeedY', new THREE.BufferAttribute(grid.speedY, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(grid.phase, 1));
  geometry.setAttribute('aRelease', new THREE.BufferAttribute(grid.releaseDelay, 1));
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.aColor.needsUpdate = true;
  geometry.attributes.aBaseSpeed.needsUpdate = true;
  geometry.attributes.aAccel.needsUpdate = true;
  geometry.attributes.aSpeedY.needsUpdate = true;
  geometry.attributes.aPhase.needsUpdate = true;
  geometry.attributes.aRelease.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function setPlaneSize(mesh, worldW, worldH) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(worldW, worldH);
}

export class SandSlider {
  /**
   * @param {HTMLElement} container
   * @param {Partial<typeof DEFAULTS>} options
   */
  static async create(container, options = {}) {
    const slider = new SandSlider(container, options);
    await slider.init();
    return slider;
  }

  constructor(container, options = {}) {
    if (!container) throw new Error('SandSlider: container required');
    this.opts = { ...DEFAULTS, ...options };
    if (!this.opts.images?.length) {
      throw new Error('SandSlider: options.images must be a non-empty array');
    }

    this.slideData = this.opts.images.map((item, i) => normalizeSlide(item, i));

    this.container = container;
    this.index = Math.max(
      0,
      Math.min(this.opts.startIndex, this.slideData.length - 1)
    );
    this.mode = MODE_IDLE;
    this.blowAge = 0;
    this.holdTimer = 0;
    this.pendingIndex = null;
    this.disposed = false;
    this.slides = [];
    this.ui = null;
    this._raf = 0;
    this._ro = null;
    this._lastFrame = null;
  }

  get length() {
    return this.slideData.length;
  }

  get currentIndex() {
    return this.index;
  }

  /** Normalized meta for the current slide ({ src, header, subheader, cta }). */
  get currentSlide() {
    return this.slideData[this.index];
  }

  /** Normalized meta for slide at index. */
  getSlide(index) {
    const i = ((index % this.length) + this.length) % this.length;
    return this.slideData[i];
  }

  get busy() {
    return this.mode !== MODE_IDLE;
  }

  async init() {
    const { container, opts } = this;

    const style = getComputedStyle(container);
    if (style.position === 'static') container.style.position = 'relative';
    if (!container.style.width && style.width === '0px') {
      container.style.width = '100%';
    }
    if (!container.style.height && (style.height === '0px' || style.height === 'auto')) {
      container.style.height = '100%';
    }
    container.style.overflow = 'hidden';

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
    this.content = new THREE.Group();
    this.scene.add(this.content);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(opts.background, 1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    // Under image (revealed as top blows away)
    this.underMat = createUnderMaterial(null);
    this.underPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      this.underMat
    );
    this.underPlate.position.z = -1;
    this.underPlate.visible = false;
    this.content.add(this.underPlate);

    // Top sharp plate (discards with wind front)
    this.plateMat = createPlateMaterial(null, opts.releaseSpan);
    this.plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      this.plateMat
    );
    this.plate.position.z = -0.5;
    this.content.add(this.plate);

    // Sand of the top image
    this.geometry = new THREE.BufferGeometry();
    this.sandMat = createSandMaterial();
    this.sand = new THREE.Points(this.geometry, this.sandMat);
    this.sand.frustumCulled = false;
    this.sand.visible = false;
    this.sand.position.z = 0;
    this.content.add(this.sand);

    this.clock = new THREE.Clock();
    // Plate gone → under fully revealed; dim fades; then we settle (don't wait for sand trail).
    this.PLATE_GONE = opts.releaseSpan * 1.4 + 0.35;
    const dimEnd = this.PLATE_GONE + Math.max(0.05, opts.dimFadeMs / 1000);
    // Small settle after reveal — nav unlocks here via onSlide, not after leftover edge sand.
    this.BLOW_END = dimEnd + 0.25;

    for (const meta of this.slideData) {
      const img = await loadImage(meta.src);
      const grid = buildPixelGrid(img, opts.maxLongSide, opts.releaseSpan);
      const texture = new THREE.Texture(img);
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.slides.push({ ...meta, img, grid, texture });
    }

    this._buildUi();
    this._bindResize();
    this._showIdle(this.index);
    this._resize();

    this.holdTimer = opts.holdMs / 1000;
    this._tick();
  }

  _buildUi() {
    const { nav, pagination } = this.opts;
    if (!nav && !pagination) {
      this.ui = null;
      return;
    }

    ensureUiStyles();

    const chrome = document.createElement('div');
    chrome.className = 'sandslider-chrome';

    const frame = document.createElement('div');
    frame.className = 'sandslider-frame';
    chrome.appendChild(frame);

    let prevBtn = null;
    let nextBtn = null;
    if (nav) {
      prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'sandslider-nav sandslider-nav-prev';
      prevBtn.setAttribute('aria-label', 'Previous');
      prevBtn.appendChild(makeChevron('prev'));
      prevBtn.addEventListener('click', () => {
        if (this.prev()) this._setNavDisabled(true);
      });

      nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'sandslider-nav sandslider-nav-next';
      nextBtn.setAttribute('aria-label', 'Next');
      nextBtn.appendChild(makeChevron('next'));
      nextBtn.addEventListener('click', () => {
        if (this.next()) this._setNavDisabled(true);
      });

      frame.appendChild(prevBtn);
      frame.appendChild(nextBtn);
    }

    let dots = null;
    if (pagination) {
      dots = document.createElement('div');
      dots.className = 'sandslider-dots';
      dots.setAttribute('aria-label', 'Slides');
      this.slideData.forEach((slide, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = slide.header || `Slide ${i + 1}`;
        b.addEventListener('click', () => {
          if (this.goTo(i)) this._setNavDisabled(true);
        });
        dots.appendChild(b);
      });
      chrome.appendChild(dots);
    }

    this.container.appendChild(chrome);
    this.ui = { chrome, frame, prevBtn, nextBtn, dots };
    this._syncPagination(this.index);
  }

  _placeChrome(rect) {
    if (!this.ui?.chrome) return;
    this.ui.chrome.style.left = `${rect.left}px`;
    this.ui.chrome.style.top = `${rect.top}px`;
    this.ui.chrome.style.width = `${rect.width}px`;
    this.ui.frame.style.height = `${rect.height}px`;
  }

  _setNavDisabled(disabled) {
    if (this.ui?.prevBtn) this.ui.prevBtn.disabled = disabled;
    if (this.ui?.nextBtn) this.ui.nextBtn.disabled = disabled;
    if (this.ui?.dots) {
      this.ui.dots.querySelectorAll('button').forEach((b) => {
        b.disabled = disabled;
      });
    }
  }

  _syncPagination(index) {
    if (!this.ui?.dots) return;
    [...this.ui.dots.children].forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
  }

  _bindResize() {
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.container);
    }
  }

  _size() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    return { w, h };
  }

  _padding() {
    const p = this.opts.fitPadding;
    if (typeof p === 'number') {
      return { top: p, right: p, bottom: p, left: p };
    }
    return {
      top: Math.max(0, p?.top ?? 0),
      right: Math.max(0, p?.right ?? 0),
      bottom: Math.max(0, p?.bottom ?? 0),
      left: Math.max(0, p?.left ?? 0),
    };
  }

  _resize() {
    if (this.disposed) return;
    const { w, h } = this._size();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this._fitCamera();
    this._updateEdgeUniform();
    this._updatePointSize();
    this._emitFrame();
  }

  _fitCamera(extraSlide = null) {
    const a = this.slides[this.index];
    if (!a) return;
    let worldW = a.grid.worldW;
    let worldH = a.grid.worldH;
    if (extraSlide) {
      worldW = Math.max(worldW, extraSlide.grid.worldW);
      worldH = Math.max(worldH, extraSlide.grid.worldH);
    }

    const { w, h } = this._size();
    const pad = this._padding();
    const fitW = Math.max(1, w - pad.left - pad.right);
    const fitH = Math.max(1, h - pad.top - pad.bottom);
    const halfFov = (this.camera.fov * Math.PI) / 360;
    const margin = 0.52;

    // z so projected plate fits into the padded box (camera aspect = full container).
    const zFromH = (worldH * margin * h) / (fitH * Math.tan(halfFov));
    const zFromW =
      (worldW * margin * w) /
      (fitW * this.camera.aspect * Math.tan(halfFov));

    let z = Math.max(zFromH, zFromW);
    if (this.opts.fit === 'cover') {
      z = Math.min(zFromH, zFromW);
    }
    this.camera.position.set(0, 0, z);

    // Align image to the padded rect (not the raw viewport center).
    const viewH = 2 * z * Math.tan(halfFov);
    const targetCenterY = pad.top + fitH / 2;
    const deltaScreen = targetCenterY - h / 2;
    this.content.position.y = -(deltaScreen / h) * viewH;
    this.content.position.x =
      (((pad.left + fitW / 2) - w / 2) / w) *
      (viewH * this.camera.aspect);
  }

  /** World size of the current image frame (union during blow). */
  _frameWorldSize() {
    const a = this.slides[this.index];
    if (!a) return { worldW: 1, worldH: 1 };
    let worldW = a.grid.worldW;
    let worldH = a.grid.worldH;
    if (
      this.mode === MODE_BLOW &&
      this.pendingIndex != null &&
      this.slides[this.pendingIndex]
    ) {
      const b = this.slides[this.pendingIndex];
      worldW = Math.max(worldW, b.grid.worldW);
      worldH = Math.max(worldH, b.grid.worldH);
    }
    return { worldW, worldH };
  }

  /**
   * Screen-space rect of the image frame, CSS px relative to container.
   * Canvas stays full-bleed so sand can fly outside this rect.
   */
  getFrameRect() {
    const { w, h } = this._size();
    const { worldW, worldH } = this._frameWorldSize();
    const halfW = worldW / 2;
    const halfH = worldH / 2;
    const z = -0.5;

    this.content.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();
    const pts = [
      new THREE.Vector3(-halfW, -halfH, z),
      new THREE.Vector3(halfW, -halfH, z),
      new THREE.Vector3(halfW, halfH, z),
      new THREE.Vector3(-halfW, halfH, z),
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      p.applyMatrix4(this.content.matrixWorld);
      p.project(this.camera);
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (-p.y * 0.5 + 0.5) * h;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    return {
      left: minX,
      top: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }

  _emitFrame() {
    if (this.disposed) return;
    const rect = this.getFrameRect();
    const prev = this._lastFrame;
    if (
      prev &&
      Math.abs(prev.left - rect.left) < 0.5 &&
      Math.abs(prev.top - rect.top) < 0.5 &&
      Math.abs(prev.width - rect.width) < 0.5 &&
      Math.abs(prev.height - rect.height) < 0.5
    ) {
      return;
    }
    this._lastFrame = rect;
    this._placeChrome(rect);
    this.opts.onFrame?.(rect, this);
  }

  _updateEdgeUniform() {
    const halfH =
      Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const halfW = halfH * this.camera.aspect;
    this.sandMat.uniforms.uEdge.value = -halfW - 30;
  }

  _updatePointSize() {
    const { h } = this._size();
    const halfH =
      Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.position.z;
    const cssPerWorld = h / (2 * halfH);
    this.sandMat.uniforms.uSize.value =
      cssPerWorld * (this.camera.position.z / 300) * 1.35;
  }

  _bindTop(slide) {
    applyGridToGeometry(this.geometry, slide.grid);
    setPlaneSize(this.plate, slide.grid.worldW, slide.grid.worldH);
    this.plateMat.uniforms.uMap.value = slide.texture;
    this.plateMat.uniforms.uReleaseSpan.value = this.opts.releaseSpan;
  }

  _bindUnder(slide) {
    setPlaneSize(this.underPlate, slide.grid.worldW, slide.grid.worldH);
    this.underMat.uniforms.uMap.value = slide.texture;
  }

  _showIdle(index) {
    this.index = index;
    this.mode = MODE_IDLE;
    this.pendingIndex = null;
    this.blowAge = 0;

    const slide = this.slides[index];
    this._bindTop(slide);

    this.plate.visible = true;
    this.plateMat.uniforms.uBlowAge.value = -1;
    this.underPlate.visible = false;
    this.sand.visible = false;
    this.sandMat.uniforms.uActive.value = 0;
    this.sandMat.uniforms.uBlowAge.value = 0;

    this._fitCamera();
    this._updateEdgeUniform();
    this._updatePointSize();
    this._emitFrame();
  }

  _nextIndex(from = this.index) {
    const n = this.length;
    if (n <= 1) return from;
    const next = from + 1;
    if (next < n) return next;
    return this.opts.loop ? 0 : from;
  }

  /** Start blow → reveal next underneath. */
  next() {
    if (this.mode !== MODE_IDLE || this.disposed) return false;
    const to = this._nextIndex();
    if (to === this.index) return false;
    this._startBlow(to);
    return true;
  }

  prev() {
    if (this.mode !== MODE_IDLE || this.disposed) return false;
    const n = this.length;
    if (n <= 1) return false;
    const to = this.index === 0 ? (this.opts.loop ? n - 1 : 0) : this.index - 1;
    if (to === this.index) return false;
    this._startBlow(to);
    return true;
  }

  goTo(index) {
    if (this.mode !== MODE_IDLE || this.disposed) return false;
    const i = ((index % this.length) + this.length) % this.length;
    if (i === this.index) return false;
    this._startBlow(i);
    return true;
  }

  play() {
    this.opts.autoplay = true;
    if (this.mode === MODE_IDLE) this.holdTimer = this.opts.holdMs / 1000;
  }

  pause() {
    this.opts.autoplay = false;
    this.holdTimer = Infinity;
  }

  blow() {
    return this.next();
  }

  _setUnderDim(amount) {
    this.underMat.uniforms.uDim.value = Math.min(1, Math.max(0, amount));
  }

  _updateUnderDim() {
    if (!this.opts.dimUnder) {
      this._setUnderDim(0);
      return;
    }
    const amount = this.opts.dimAmount;
    if (this.blowAge < this.PLATE_GONE) {
      this._setUnderDim(amount);
      return;
    }
    const fadeSec = Math.max(0.05, this.opts.dimFadeMs / 1000);
    const t = smoothstep(0, 1, (this.blowAge - this.PLATE_GONE) / fadeSec);
    this._setUnderDim(amount * (1 - t));
  }

  _startBlow(toIndex) {
    const from = this.index;
    const next = this.slides[toIndex];
    this.pendingIndex = toIndex;
    this.mode = MODE_BLOW;
    this.blowAge = 0;

    // Next slide sits underneath; top + sand peel away over it.
    this._bindUnder(next);
    this.underPlate.visible = true;
    this._setUnderDim(this.opts.dimUnder ? this.opts.dimAmount : 0);

    this.plate.visible = true;
    this.plateMat.uniforms.uBlowAge.value = 0;

    this.sand.visible = true;
    this.sandMat.uniforms.uActive.value = 1;
    this.sandMat.uniforms.uBlowAge.value = 0;

    this._fitCamera(next);
    this._updateEdgeUniform();
    this._updatePointSize();
    this._emitFrame();

    this._setNavDisabled(true);
    this._syncPagination(toIndex);

    this.opts.onTransition?.(
      from,
      toIndex,
      this.getSlide(from),
      this.getSlide(toIndex),
      this
    );
  }

  _finishBlow() {
    const to = this.pendingIndex ?? this.index;
    this._setUnderDim(0);
    this._showIdle(to);
    this.holdTimer = this.opts.holdMs / 1000;
    this._setNavDisabled(false);
    this._syncPagination(this.index);
    this.opts.onSlide?.(this.index, this.currentSlide, this);
  }

  _tick = () => {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._tick);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.sandMat.uniforms.uTime.value = this.clock.elapsedTime;

    if (this.mode === MODE_IDLE) {
      if (this.opts.autoplay && this.length > 1) {
        this.holdTimer -= dt;
        if (this.holdTimer <= 0) this.next();
      }
    } else if (this.mode === MODE_BLOW) {
      this.blowAge += dt;
      this.sandMat.uniforms.uBlowAge.value = this.blowAge;
      this.plateMat.uniforms.uBlowAge.value = this.blowAge;
      this._updateUnderDim();

      // Top plate fully gone → only under + flying sand remain
      if (this.blowAge >= this.PLATE_GONE) {
        this.plate.visible = false;
      }

      if (this.blowAge >= this.BLOW_END) {
        this._finishBlow();
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this._ro?.disconnect();

    for (const s of this.slides) s.texture.dispose();
    this.geometry.dispose();
    this.plate.geometry.dispose();
    this.underPlate.geometry.dispose();
    this.plateMat.dispose();
    this.underMat.dispose();
    this.sandMat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.ui?.chrome?.remove();
    this.ui = null;
  }
}

export default SandSlider;
