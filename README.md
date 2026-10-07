<h1>
  SandSlider
</h1>
<p>
<strong>
  SandSlider
</strong>
is a WebGL-powered image slider built with
<strong>
  Three.js and custom GLSL shaders
</strong>
, featuring a particle-based sand blow transition between slides.
</p>
<p>
Instead of using a standard fade or horizontal slide animation, SandSlider transforms the outgoing image into thousands of colored particles. These particles inherit their colors directly from the source image, detach progressively according to an irregular wind front, and accelerate away while the next slide is revealed underneath.
</p>
<p>
The project evolved from my earlier SandPixel / sand blow experiment and turns that visual effect into a reusable slider component with a practical API.
</p>
<h2>
  Features
</h2>
<ul>
  <li>
    <p>
    WebGL rendering powered by
    <strong>
      Three.js
    </strong>
  </p>
</li>
<li>
  <p>
  Custom GLSL vertex and fragment shaders
</p>
</li>
<li>
  <p>
  Particle-based sand disintegration transition
</p>
</li>
<li>
  <p>
  Pixel colors sampled directly from source images
</p>
</li>
<li>
  <p>
  Irregular wind-front animation
</p>
</li>
<li>
  <p>
  Configurable particle density
</p>
</li>
<li>
  <p>
  Autoplay
</p>
</li>
<li>
  <p>
  Infinite looping
</p>
</li>
<li>
  <p>
  Previous / next navigation
</p>
</li>
<li>
  <p>
  Pagination dots
</p>
</li>
<li>
  <p>
  Direct slide navigation with
  <code>
    goTo()
  </code>
</p>
</li>
<li>
  <p>
  <code>
    play()
  </code>
  and
  <code>
    pause()
  </code>
  methods
</p>
</li>
<li>
  <p>
  <code>
    contain
  </code>
  and
  <code>
    cover
  </code>
  image fitting
</p>
</li>
<li>
  <p>
  Responsive resizing with
  <code>
    ResizeObserver
  </code>
</p>
</li>
<li>
  <p>
  Configurable frame padding
</p>
</li>
<li>
  <p>
  Incoming-slide dimming and fade
</p>
</li>
<li>
  <p>
  Slide metadata support:
</p>
<ul>
  <li>
    <p>
    title
  </p>
</li>
<li>
  <p>
  subheader
</p>
</li>
<li>
  <p>
  CTA label
</p>
</li>
<li>
  <p>
  CTA URL
</p>
</li>
</ul>
</li>
<li>
  <p>
  Transition callbacks
</p>
</li>
<li>
  <p>
  Slide-change callbacks
</p>
</li>
<li>
  <p>
  Frame-position callback for synchronizing HTML overlays
</p>
</li>
<li>
  <p>
  Proper WebGL cleanup with
  <code>
    dispose()
  </code>
</p>
</li>
<li>
  <p>
  No framework dependency
</p>
</li>
</ul>
<h2>
  Basic Usage
</h2>
<pre>
  <code>
    import { SandSlider } from './sandslider.js';

const slider = await SandSlider.create(
    document.getElementById('stage'),
    {
        images: [
            {
                src: './images/slide-01.webp',
                header: 'SandSlider',
                subheader: 'WebGL particle transition powered by Three.js.',
                cta: {
                    label: 'Learn more',
                    href: '#details'
                }
            },
            {
                src: './images/slide-02.webp',
                header: 'Particle Motion',
                subheader: 'The outgoing image is blown away like sand.'
            }
        ],

        holdMs: 3500,
        maxLongSide: 720,
        autoplay: true,
        loop: true,
        fit: 'contain',
        nav: true,
        pagination: true
    }
);
  </code>
</pre>
<h2>
  How It Works
</h2>
<p>
Each image is converted into a particle grid using an off-screen canvas.
</p>
<p>
For every sampled pixel, SandSlider stores data such as:
</p>
<ul>
  <li>
    <p>
    position,
  </p>
</li>
<li>
  <p>
  RGB color,
</p>
</li>
<li>
  <p>
  base speed,
</p>
</li>
<li>
  <p>
  acceleration,
</p>
</li>
<li>
  <p>
  vertical velocity,
</p>
</li>
<li>
  <p>
  animation phase,
</p>
</li>
<li>
  <p>
  individual release delay.
</p>
</li>
</ul>
<p>
The outgoing slide consists of two synchronized layers:
</p>
<ol>
  <li>
    <p>
    a sharp image rendered on a plane,
  </p>
</li>
<li>
  <p>
  a
  <code>
    THREE.Points
  </code>
  particle representation of the same image.
</p>
</li>
</ol>
<p>
A fragment shader gradually removes sections of the sharp image while the corresponding particles are released by the vertex shader.
</p>
<p>
At the same time, the next slide is already rendered underneath.
</p>
<p>
The result is a transition where the current image appears to physically disintegrate and blow away, gradually revealing the next slide.
</p>
<h2>
  Public API
</h2>
<pre>
  <code>
    slider.next();
slider.prev();
slider.goTo(2);

slider.play();
slider.pause();

slider.blow();

slider.currentIndex;
slider.currentSlide;
slider.length;
slider.busy;

slider.getFrameRect();

slider.dispose();
  </code>
</pre>
<h2>
  Running Locally
</h2>
<p>
Because images are loaded using
<code>
  fetch()
</code>
, the demo should be served over HTTP rather than opened directly with
<code>
  file://
</code>
.
</p>
<p>
For example:
</p>
<pre>
  <code>
    python3 -m http.server 5173
  </code>
</pre>
<p>
Then open:
</p>
<pre>
  <code>
    http://127.0.0.1:5173/
  </code>
</pre>
<h2>
  Project Page
</h2>
<p>
More information, documentation and the full tutorial are available on the project page:
</p>
<p>
<a href="https://pawelnosko.com/js-frontend-tools/sandslider-building-a-webgl-image-slider-with-sand-blow-transitions-in-three-js">
SandSlider — project page
</a>
</p>
<h2>
  Tech Stack
</h2>
<ul>
  <li>
    <p>
    JavaScript ES Modules
  </p>
</li>
<li>
  <p>
  Three.js
</p>
</li>
<li>
  <p>
  WebGL
</p>
</li>
<li>
  <p>
  GLSL
</p>
</li>
<li>
  <p>
  Canvas API
</p>
</li>
<li>
  <p>
  ResizeObserver
</p>
</li>
<li>
  <p>
  CSS animations
</p>
</li>
</ul>
<h2>
  Author
</h2>
<p>
Created by
<strong>
  Paweł Nosko
</strong>
.
</p>
<p>
SandSlider is part of my frontend experiments focused on WebGL, shaders, unconventional UI motion and reusable JavaScript components.
</p>
