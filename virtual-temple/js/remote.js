import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Avatar } from './avatar.js';
import { HUT } from './hut.js';

// Real devotees from your room, as they walk the grounds or sit in the meditation hut. (In a prayer hall they take
// their place through the hall's own list of places; see main.js.) Each one glides smoothly toward the latest
// position the server relayed, plays the same movement as on its owner's screen, and wears a name label marked
// apart from the simulated devotees.

const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
// the hut's cushions that its simulated sitters leave free, for friends who are practising there
const FREE_SEATS = HUT.ring.filter((s) => !HUT.sitterSeats.includes(s.deg));

export class RemotePlayers {
  constructor(scene, labelRoot, { shadows = true } = {}) {
    this.scene = scene; this.labelRoot = labelRoot; this.shadows = shadows;
    this.list = new Map();   // id -> { p, avatar, label, bubble, pick, seat, pos, rot, bowUntil }
    this.onTap = null;       // tapping a friend (their avatar or name tag): open a chat with them
    this._pickMat = new THREE.MeshBasicMaterial({ visible: false });
    this._pickGeo = new THREE.BoxGeometry(0.75, 1.45, 0.75).translate(0, 0.72, 0);
  }
  add(p) {
    if (this.list.has(p.id)) return this.list.get(p.id);
    const avatar = new Avatar(p.look, { simulated: false, shadows: this.shadows });
    avatar.root.visible = false; this.scene.add(avatar.root);
    const label = document.createElement('div'); label.className = 'nlabel friend'; label.title = 'Chat'; this.labelRoot.appendChild(label);
    label.addEventListener('click', () => this.onTap && this.onTap(p.id));
    const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.style.display = 'none'; this.labelRoot.appendChild(bubble);
    const pick = new THREE.Mesh(this._pickGeo, this._pickMat); pick.userData.remoteId = p.id; avatar.root.add(pick);   // an easy target for a tap
    const R = { p, avatar, label, bubble, pick, bubbleUntil: 0, seat: -1, pos: new THREE.Vector3(), rot: 0, fresh: true, bowUntil: 0 };
    this.list.set(p.id, R); this.setLabel(R); this.state(p);
    return R;
  }
  remove(p) { const R = this.list.get(p.id); if (!R) return; this.scene.remove(R.avatar.root); R.label.remove(); R.bubble.remove(); this.list.delete(p.id); }
  // a message they sent you, shown for a few seconds over their head
  say(p, text) { const R = this.list.get(p.id); if (!R) return; R.bubble.textContent = text; R.bubbleUntil = performance.now() + 8000; }
  // the friends you could tap right now
  picks() { const out = []; for (const R of this.list.values()) if (R.avatar.root.visible) out.push(R.pick); return out; }
  look(p) { const R = this.list.get(p.id); if (!R) return; R.avatar.setConfig(p.look); this.setLabel(R); }
  setLabel(R) { const n = R.p.name || 'Devotee'; R.label.innerHTML = `<i>${esc(n[0].toUpperCase())}</i>${esc(n)}`; }
  state(p) {
    const R = this.list.get(p.id); if (!R || !p.s) return;
    const s = p.s;
    if (s.m === 'u') { if (R.seat < 0) R.seat = this._freeSeat(); }
    else R.seat = -1;
    if (s.m === 'w' && R.fresh) { R.pos.set(s.x, s.y, s.z); R.rot = s.r; R.fresh = false; }
  }
  _freeSeat() {
    const used = new Set([...this.list.values()].map((R) => R.seat));
    for (let i = 0; i < FREE_SEATS.length; i++) if (!used.has(i)) return i;
    return -1;
  }
  // a pranam: they bow where they stand
  bow(p, dur = 2.6) { const R = this.list.get(p.id); if (R) R.bowUntil = performance.now() + dur * 1000; }
  // the nearest friend within reach of a position (for a pranam to a real person)
  nearest(pos, within = 4.5) {
    let best = null, bd = within;
    for (const R of this.list.values()) { if (!R.avatar.root.visible) continue; const d = R.avatar.root.position.distanceTo(pos); if (d < bd) { bd = d; best = R; } }
    return best;
  }
  visibleCount() { let n = 0; for (const R of this.list.values()) if (R.avatar.root.visible) n++; return n; }

  update(dt, t, { project, showLabels = true }) {
    const now = performance.now();
    for (const R of this.list.values()) {
      const s = R.p.s, A = R.avatar, root = A.root;
      const inWorld = s && s.m === 'w', inHut = s && s.m === 'u' && R.seat >= 0;
      root.visible = !!(inWorld || inHut);
      if (!root.visible) { R.label.style.display = 'none'; R.bubble.style.display = 'none'; R.fresh = true; continue; }
      if (inHut) {
        const seat = FREE_SEATS[R.seat]; root.position.copy(seat.pos); root.rotation.y = seat.rotY; A.speed = 0; A.setState('meditate');
      } else {
        // glide toward the relayed position; snap if it jumped (a teleport into or out of a building)
        const target = new THREE.Vector3(s.x, s.y, s.z);
        if (target.distanceTo(R.pos) > 6) R.pos.copy(target); else R.pos.lerp(target, 1 - Math.exp(-dt * 9));
        R.rot = lerpA(R.rot, s.r, 1 - Math.exp(-dt * 10));
        root.position.copy(R.pos); root.rotation.y = R.rot;
        const moving = R.pos.distanceTo(target) > 0.05 || s.a === 'walk';
        A.speed = moving ? Math.max(1.2, s.sp || 2) : 0;
        A.setState(now < R.bowUntil ? 'bow' : moving ? 'walk' : (s.a === 'walk' ? 'idle' : s.a || 'idle'));
      }
      A.update(dt, t);
      if (showLabels && project) project(root.position, R.label, inHut ? 1.15 : 1.55); else R.label.style.display = 'none';
      if (now < R.bubbleUntil && project) project(root.position, R.bubble, inHut ? 1.6 : 2.0); else R.bubble.style.display = 'none';
    }
  }
  hideLabels() { for (const R of this.list.values()) { R.label.style.display = 'none'; R.bubble.style.display = 'none'; } }
  clear() { for (const R of [...this.list.values()]) this.remove(R.p); }
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
