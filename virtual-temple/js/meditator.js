// A seated meditator in silhouette, drawn in SVG: a figure in lotus pose on a lotus seat, backlit by a soft
// aura like a rising sun. As the breath comes in, the aura swells, motes of light drift toward the heart and
// the seven chakras light up from the root to the crown; as it goes out, everything eases back.

const CHAKRAS = [   // root to crown: y position on the spine, colour, name
  [180, '#ff4a3d', 'Muladhara'], [164, '#ff8a1f', 'Svadhisthana'], [146, '#ffd23a', 'Manipura'], [122, '#4fd16a', 'Anahata'],
  [91, '#3fa4ff', 'Vishuddha'], [62, '#8a6bff', 'Ajna'], [40, '#e9a6ff', 'Sahasrara'],
];

// the figure: overlapping shapes that read as one clean silhouette (topknot, head, neck, torso, arms, crossed legs, hands)
const FIGURE = `
  <circle cx="120" cy="41" r="7.2"/>
  <ellipse cx="120" cy="62" rx="15" ry="18"/>
  <path d="M113.5 76h13l1.8 19h-16.6z"/>
  <path d="M112 93c-8 2-18 4-23 9-4 4-3 14 0 22 3 8 8 14 8 22 0 6-4 10-7 16h60c-3-6-7-10-7-16 0-8 5-14 8-22 3-8 4-18 0-22-5-5-15-7-23-9z"/>
  <path d="M90 104c-8 10-12 24-11 36 1 10-9 20-17 26" fill="none" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M150 104c8 10 12 24 11 36-1 10 9 20 17 26" fill="none" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M40 182c12-20 48-24 80-21 32-3 68 1 80 21-12 10-148 10-160 0z"/>
  <ellipse cx="57" cy="167" rx="8.5" ry="5.6" transform="rotate(-22 57 167)"/>
  <ellipse cx="183" cy="167" rx="8.5" ry="5.6" transform="rotate(22 183 167)"/>`;
// the soles of the feet resting on the thighs, and the chin mudra at each hand
const DETAIL = `
  <path d="M96 171c6-5 15-6 21-3" fill="none" stroke-width="1.3"/>
  <path d="M144 173c-6-5-15-6-21-3" fill="none" stroke-width="1.3"/>
  <circle cx="52.5" cy="166" r="2.4" fill="none" stroke-width="1.2"/>
  <circle cx="187.5" cy="166" r="2.4" fill="none" stroke-width="1.2"/>`;

// a lotus seat: an outer fan of long petals and an inner row of short ones, opening beneath the crossed legs
function lotusPetals() {
  const petal = 'M0 0C-10-9-11-27 0-38 11-27 10-9 0 0z';
  let s = '';
  for (let a = -84; a <= 84; a += 12) { const k = 1 - Math.abs(a) / 84; s += `<path d="${petal}" transform="translate(120 214) rotate(${a}) scale(${(1.05 + k * 0.35).toFixed(2)} ${(1.15 + k * 0.4).toFixed(2)})" opacity="${(0.62 + k * 0.38).toFixed(2)}"/>`; }
  for (let a = -70; a <= 70; a += 14) s += `<path d="${petal}" transform="translate(120 206) rotate(${a}) scale(.62 .7)" opacity=".95" class="inner"/>`;
  return s;
}

// full = the large session visual; otherwise a small static mark for labels and headers
export function meditatorSVG(uid = 'm', { full = true } = {}) {
  const id = (n) => `${uid}-${n}`;
  if (!full) {
    return `<svg viewBox="22 18 196 196" aria-hidden="true" class="medi-mark"><defs>
      <radialGradient id="${id('a')}" cx="50%" cy="48%" r="50%"><stop offset="0" stop-color="#fff3d2"/><stop offset=".45" stop-color="#ffc56a"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient></defs>
      <circle cx="120" cy="112" r="92" fill="url(#${id('a')})"/>
      <g fill="#f3c25e" opacity=".9">${lotusPetals()}</g>
      <g fill="#2a1208" stroke="#2a1208">${FIGURE}</g></svg>`;
  }
  const rays = [...Array(36)].map((_, i) => `<line x1="0" y1="-64" x2="0" y2="${i % 2 ? -96 : -112}" transform="rotate(${i * 10})"/>`).join('');
  const motes = [...Array(22)].map((_, i) => `<circle class="mote" r="${1.1 + (i % 3) * 0.55}"/>`).join('');
  const chak = CHAKRAS.map(([y, c], i) => `<g class="ch" data-i="${i}" transform="translate(120 ${y})"><circle r="10" fill="url(#${id('c' + i)})"/><circle r="2.9" fill="${c}"/></g>`).join('');
  const chakDefs = CHAKRAS.map(([, c], i) => `<radialGradient id="${id('c' + i)}"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".35" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('');
  return `<svg viewBox="0 0 240 240" class="medi" aria-hidden="true">
    <defs>
      <radialGradient id="${id('sun')}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6dc"/><stop offset=".28" stop-color="#ffd98f"/><stop offset=".55" stop-color="#ffab4f" stop-opacity=".75"/><stop offset=".8" stop-color="#ff7d2e" stop-opacity=".22"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id('fig')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d1a0e"/><stop offset=".55" stop-color="#2a1108"/><stop offset="1" stop-color="#1a0a05"/></linearGradient>
      <linearGradient id="${id('pet')}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b8661e"/><stop offset=".6" stop-color="#f0b245"/><stop offset="1" stop-color="#ffe2a0"/></linearGradient>
      <filter id="${id('rim')}" x="-20%" y="-20%" width="140%" height="140%"><feMorphology operator="dilate" radius="1.6"/><feGaussianBlur stdDeviation="2.4"/></filter>
      <filter id="${id('soft')}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter>
      ${chakDefs}
    </defs>
    <g class="aura"><circle cx="120" cy="112" r="112" fill="url(#${id('sun')})"/></g>
    <g class="rays" stroke="#ffd58a" stroke-width="1.1" stroke-linecap="round" transform="translate(120 112)"><g class="spin">${rays}</g></g>
    <g class="rings" fill="none" stroke="#ffe0a6"><circle class="r1" cx="120" cy="112" r="80"/><circle class="r2" cx="120" cy="112" r="96"/></g>
    <g class="motes" fill="#fff0c8" filter="url(#${id('soft')})">${motes}</g>
    <g class="lotus" fill="url(#${id('pet')})" stroke="#8a4512" stroke-width=".8">${lotusPetals()}</g>
    <g class="body">
      <g class="rim" fill="#ffcf7a" stroke="#ffcf7a" filter="url(#${id('rim')})">${FIGURE}</g>
      <g class="fig" fill="url(#${id('fig')})" stroke="url(#${id('fig')})">${FIGURE}</g>
      <g class="detail" stroke="#7a3d1c" opacity=".8">${DETAIL}</g>
      <g class="chakras">${chak}</g>
    </g>
  </svg>`;
}

// drives the large visual from the breath: fill 0 (empty) .. 1 (full)
export class MeditatorVisual {
  constructor(root, { reducedMotion = false } = {}) {
    this.root = root; this.reduced = reducedMotion;
    this.aura = root.querySelector('.aura'); this.rays = root.querySelector('.rays'); this.spin = root.querySelector('.spin');
    this.r1 = root.querySelector('.r1'); this.r2 = root.querySelector('.r2'); this.body = root.querySelector('.body');
    this.ch = [...root.querySelectorAll('.ch')]; this.motes = [...root.querySelectorAll('.mote')].map((el, i) => ({ el, a: i / 22 * Math.PI * 2 + (i % 3) * 0.4, ph: i * 1.37, sp: 0.6 + (i % 5) * 0.12 }));
  }
  update(fill, t, { hold = false } = {}) {
    const f = Math.max(0, Math.min(1, fill)), rm = this.reduced;
    const s = rm ? 0.92 : 0.74 + f * 0.34;
    this.aura.setAttribute('transform', `translate(120 112) scale(${s.toFixed(3)}) translate(-120 -112)`);
    this.aura.setAttribute('opacity', (0.55 + f * 0.45).toFixed(3));
    this.rays.setAttribute('opacity', (0.12 + f * 0.5).toFixed(3));
    if (!rm) this.spin.setAttribute('transform', `rotate(${(t * 2.2) % 360}) scale(${(0.9 + f * 0.18).toFixed(3)})`);
    this.r1.setAttribute('r', (rm ? 82 : 66 + f * 28).toFixed(1)); this.r1.setAttribute('opacity', (0.15 + f * 0.35).toFixed(3));
    this.r2.setAttribute('r', (rm ? 100 : 84 + f * 26).toFixed(1)); this.r2.setAttribute('opacity', (0.08 + f * 0.2).toFixed(3));
    // the chest rises a little and the whole figure lifts on the in-breath
    if (!rm) this.body.setAttribute('transform', `translate(120 160) scale(${(1 + f * 0.018).toFixed(4)} ${(1 + f * 0.028).toFixed(4)}) translate(-120 ${(-160 - f * 1.4).toFixed(2)})`);
    // chakras light from the root upward as the lungs fill, and dim from the crown down as they empty
    this.ch.forEach((g, i) => { const k = Math.max(0, Math.min(1, (f * 7.4 - i) / 1.4)); g.setAttribute('opacity', (0.12 + 0.88 * k).toFixed(3)); g.setAttribute('transform', g.getAttribute('transform').replace(/ scale\([^)]*\)/, '') + ` scale(${(0.75 + k * 0.45 + (hold ? Math.sin(t * 3 + i) * 0.04 : 0)).toFixed(3)})`); });
    // motes of light drift in toward the heart with the in-breath, and out with the out-breath
    for (const m of this.motes) {
      const r = (rm ? 70 : 108 - f * 70) + Math.sin(t * m.sp + m.ph) * 6, a = m.a + Math.sin(t * 0.2 + m.ph) * 0.12;
      m.el.setAttribute('cx', (120 + Math.cos(a) * r).toFixed(1)); m.el.setAttribute('cy', (112 + Math.sin(a) * r * 0.92).toFixed(1));
      m.el.setAttribute('opacity', (0.25 + 0.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, (r - 30) / 90)))).toFixed(2));
    }
  }
}
