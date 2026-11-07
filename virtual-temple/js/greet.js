// Returning a pranam: the devotee turns until they are facing you, only then bows, and keeps facing you (wherever you
// step) through the bow. Shared by the devotees in the grounds, in the prasad line and in the prayer halls.
// av.greet = { at: when to begin, target: a live Vector3 (your position) }; returns true once the bow is complete.
export function greetStep(av, dt, now) {
  const G = av.greet, p = av.root.position, want = Math.atan2(G.target.x - p.x, G.target.z - p.z);
  const diff = Math.atan2(Math.sin(want - av.root.rotation.y), Math.cos(want - av.root.rotation.y));
  av.root.rotation.y += diff * (1 - Math.exp(-dt * 10));
  av.speed = 0; if (av.state === 'walk') av.setState('idle');
  if (!G.bowAt && now > G.at && (Math.abs(diff) < 0.15 || now > G.at + 1.4)) { G.bowAt = now; av.setState('bow'); }
  if (G.bowAt && now > G.bowAt + 2.6) { av.setState('namaste'); return true; }
  return false;
}
