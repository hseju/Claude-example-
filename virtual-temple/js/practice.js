// Breathwork and meditation for the meditation hut.
//
// A session is a timeline of events (spoken lines, breath phases, singing bowls, chanted Om) that a small
// clock plays through; the hut UI reads `session.state` every frame to draw the breathing light and captions.
// Guidance is spoken with the browser's own speech voices (Web Speech API), so it works offline and costs
// nothing; a recorded narration can replace any script through audio/manifest.json ("guided": { id: file }).
// All scripts here are original to this project.

// ---------------------------------------------------------------- breathwork
// pattern phases: in, hold, out, holdOut, hum, rest, and the alternate-nostril variants inL/inR/outL/outR
export const BREATHWORK = [
  {
    id: 'calm', icon: 'lotus', name: 'Calm breath', tag: 'Resonant breathing', sub: 'Slow, even breaths, about five seconds in and five out. Steadies the heart and the mind.',
    minutes: [3, 5, 10], def: 5, pattern: [['in', 5.5], ['out', 5.5]],
    intro: ['Welcome. Sit comfortably, with your spine tall and your shoulders soft.',
      'Rest your hands on your knees. Let your eyes close, or soften your gaze toward the lamp.',
      'We will breathe slowly and evenly through the nose: in for about five seconds, and out for about five. Never force the breath.',
      'Follow the light and the sound. Let us begin.'],
    tips: ['Let the breath be smooth, like a slow wave.', 'If the mind wanders, simply come back to the next breath.', 'Soften your jaw, your shoulders and your belly.', 'Feel the cool air coming in, and the warm air going out.'],
    close: ['Let go of the rhythm now, and breathe naturally.', 'Notice how you feel: calm, steady, present.', 'When you are ready, gently open your eyes.'],
  },
  {
    id: 'box', icon: 'box', name: 'Box breathing', tag: 'Sama vritti', sub: 'Four counts in, hold, out, hold. Even and focusing; good before work or study.',
    minutes: [3, 5, 8], def: 5, pattern: [['in', 4], ['hold', 4], ['out', 4], ['holdOut', 4]], holds: true,
    intro: ['Box breathing, sama vritti, means equal breath.',
      'Four counts breathing in, four counts holding, four counts breathing out, and four counts resting empty.',
      'Keep every hold soft and easy. If a hold ever feels uncomfortable, just keep breathing gently through it.',
      'Let us begin.'],
    tips: ['Picture tracing the four sides of a square.', 'Steady and even. Nothing to force.', 'Let the face and shoulders relax during the holds.'],
    close: ['Release the counting, and let the breath return to its own rhythm.', 'Notice the steadiness you have created.', 'Gently open your eyes.'],
  },
  {
    id: 'relax', icon: 'hourglass', name: '4-7-8 breath', tag: 'Relaxing breath', sub: 'In for four, hold for seven, a long sigh out for eight. Helps you unwind, or fall asleep.',
    minutes: [2, 4], def: 2, pattern: [['in', 4], ['hold', 7], ['out', 8]], holds: true,
    intro: ['The four, seven, eight breath helps the body settle.',
      'Breathe in quietly through the nose for four. Hold gently for seven. Then breathe out slowly through the mouth for eight, with a soft whoosh.',
      'If the counts feel long, keep the same rhythm at your own pace.',
      'First, breathe all the way out. Let us begin.'],
    tips: ['A long, slow out-breath. Let the body grow heavy.', 'Keep the hold gentle, never strained.'],
    close: ['Return to your natural breath.', 'Feel the heaviness and warmth in the body.', 'Take your time, and open your eyes when you are ready.'],
  },
  {
    id: 'nadi', icon: 'nadi', name: 'Nadi shodhana', tag: 'Alternate-nostril breath', sub: 'Breathe through one side, then the other. Balancing and clearing.',
    minutes: [3, 5, 8], def: 5, pattern: [['inL', 4], ['outR', 6], ['inR', 4], ['outL', 6]],
    intro: ['Nadi shodhana, alternate-nostril breathing, brings balance and calm.',
      'Raise your right hand. The thumb closes the right nostril, and the ring finger closes the left. If you prefer, simply imagine the breath moving from side to side.',
      'Breathe out completely. Now close the right nostril.',
      'Let us begin.'],
    tips: ['Keep the breath soft and silent.', 'The hand stays light. No pressure is needed.', 'Let each side feel equal.'],
    close: ['Release the hand, and breathe through both nostrils.', 'Notice the balance between left and right.', 'Gently open your eyes.'],
  },
  {
    id: 'bhramari', icon: 'hum', name: 'Bhramari', tag: 'Humming-bee breath', sub: 'Breathe in, then hum softly on the long out-breath. Soothing and warm.',
    minutes: [3, 5], def: 3, pattern: [['in', 4], ['hum', 8], ['rest', 2]],
    intro: ['Bhramari, the humming-bee breath, is soothing and warm.',
      'Close your lips gently, with the teeth slightly apart. On each out-breath, make a soft, steady hum, like a bee.',
      'You can rest your fingers lightly on your ears to hear the hum inside. Follow the hum you hear.',
      'Let us begin.'],
    tips: ['Let the hum vibrate through the face and the chest.', 'Keep the hum gentle and even, not loud.'],
    close: ['Let the humming go, and sit in the quiet it leaves behind.', 'Notice the stillness, and the warmth.', 'Gently open your eyes.'],
  },
  {
    id: 'dirga', icon: 'layers', name: 'Three-part breath', tag: 'Dirga pranayama', sub: 'Fill the belly, ribs and chest, then empty from the top down. Deep and grounding.',
    minutes: [3, 5], def: 3, pattern: [['in', 6], ['out', 6]], words: { in: 'Belly, ribs, chest', out: 'Chest, ribs, belly' },
    intro: ['Dirga pranayama, the three-part breath, fills the body gently from the bottom up.',
      'As you breathe in, let the belly rise, then the ribs widen, then the chest lift a little.',
      'As you breathe out, empty from the top down: chest, ribs, belly.',
      'Let us begin.'],
    tips: ['Slow and smooth, like pouring water into a jar.', 'Let the shoulders stay soft as the chest lifts.'],
    close: ['Let the breath become natural again.', 'Feel the whole body breathing.', 'Gently open your eyes.'],
  },
];
export const CUE = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', holdOut: 'Hold', hum: 'Hum', rest: 'Rest', inL: 'In through the left', inR: 'In through the right', outL: 'Out through the left', outR: 'Out through the right' };
export const PHASE_LABEL = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', holdOut: 'Hold', hum: 'Hum', rest: 'Rest', inL: 'In · left', inR: 'In · right', outL: 'Out · left', outR: 'Out · right', settle: 'Settle', intro: 'Settle in', close: 'Rest' };
const BASE = (p) => p.startsWith('in') ? 'in' : p.startsWith('out') ? 'out' : p;

// ---------------------------------------------------------------- guided meditations
// [seconds, text] lines; 'bowl' and 'om' events; `len` is the total length in seconds
export const MEDITATIONS = [
  {
    id: 'breath', icon: 'breath', name: 'Breath awareness', tag: 'Anapanasati', min: 5, len: 300, sub: 'Rest your attention on the natural breath. A simple, complete practice.',
    lines: [[3, 'Welcome. Settle into your seat, and let your hands rest on your knees.'], [11, 'Close your eyes, or lower your gaze to the lamp in front of you.'],
      [18, 'Take one deep breath in, and let it go with a long sigh.'], [27, 'Once more. Breathe in, and let it go.'],
      [37, 'Now let the breath find its own natural rhythm. There is nothing to change.'], [48, 'Bring your attention to the tip of the nose, where the air enters and leaves.'],
      [62, 'Notice the coolness of the in-breath, and the warmth of the out-breath.'], [82, 'If you like, silently count each out-breath, from one to ten, and then begin again at one.'],
      [112, 'When the mind wanders, and it will, simply notice where it went, and gently come back to the breath. This coming back is the practice.'],
      [152, 'Breathing in, I know I am breathing in. Breathing out, I know I am breathing out.'],
      [196, 'Let the body be still and easy, like a mountain. Let the breath move like a quiet stream.'], [240, 'Stay with the next breath, and the next.'],
      [268, 'Begin to deepen the breath a little. Feel your seat, your hands, and the space around you.'], [283, 'Gently open your eyes, and carry this calm with you.']],
  },
  {
    id: 'body', icon: 'body', name: 'Body scan', tag: 'Relaxation', min: 8, len: 480, sub: 'Move slowly through the body, softening each part from head to toe.',
    lines: [[3, 'Welcome. Let the body settle on the cushion, heavy and supported.'], [11, 'Close your eyes, and take a slow breath in, and a long breath out.'],
      [22, 'We will move our attention slowly through the body. Wherever it rests, let that place soften.'],
      [38, 'Begin at the crown of the head. Feel the scalp, and let it loosen.'], [55, 'The forehead smooths. The space between the eyebrows widens.'],
      [72, 'Soften the eyes in their sockets. Let the cheeks and the jaw go slack, the tongue resting easily.'],
      [95, 'Feel the neck and the throat. Let the shoulders drop away from the ears.'], [118, 'Let warmth flow down the arms, to the elbows, the wrists, the hands, all the way to the fingertips.'],
      [148, 'Bring your attention to the chest. Feel it rise and fall on its own.'], [170, 'The upper back softens. The middle back. The lower back lets go.'],
      [195, 'Rest your attention in the belly. Let it be soft, moving with each breath.'], [220, 'Feel the hips and the pelvis, resting on the cushion, fully supported by the earth.'],
      [248, 'Let relaxation flow into the thighs, the knees, the calves.'], [272, 'Feel the ankles, the feet, the soles, and each toe.'],
      [300, 'Now feel the whole body at once, from head to toe, breathing as one.'], [330, 'If any place still holds tension, breathe into it, and let it melt on the out-breath.'],
      [370, 'Rest here, in a body at ease.'], [430, 'Slowly let a little movement return. Wiggle the fingers and the toes.'],
      [448, 'Take a deeper breath. And when you are ready, gently open your eyes.']],
  },
  {
    id: 'maitri', icon: 'heart', name: 'Loving-kindness', tag: 'Maitri', min: 7, len: 420, sub: 'Wish well to yourself, someone dear, someone neutral, and all beings.',
    lines: [[3, 'Welcome. Sit comfortably, and let the breath be easy.'], [11, 'Place a hand on your heart if you like, and feel its warmth.'],
      [22, 'We begin with ourselves. Silently, let these words arise.'], [32, 'May I be happy. May I be healthy. May I be peaceful. May I live with ease.'],
      [62, 'Let the words be gentle, like a kind voice speaking to a friend.'],
      [90, 'Now bring to mind someone you love easily. See their face, and offer them the same wishes.'], [104, 'May you be happy. May you be healthy. May you be peaceful. May you live with ease.'],
      [150, 'Now think of someone you hardly know: a neighbour, a shopkeeper, a person you passed today. They too wish to be happy.'], [166, 'May you be happy. May you be healthy. May you be peaceful.'],
      [210, 'If you are ready, bring to mind someone you find difficult. Only as far as feels right.'], [226, 'May you be free from suffering. May you find peace.'],
      [270, 'Now let your kindness spread in every direction, to all beings everywhere.'], [284, 'Lokah samastah sukhino bhavantu. May all beings everywhere be happy and free.'],
      [340, 'Rest in this warmth for a few breaths.'], [395, 'Gently open your eyes, and carry this kindness into your day.']],
  },
  {
    id: 'om', icon: 'om', name: 'Om chanting', tag: 'Mantra', min: 10, len: 600, sub: 'Chant Om with the guide, then repeat it silently and rest in the stillness it leaves.',
    lines: [[3, 'Welcome. Sit tall, with the shoulders soft and the hands resting on the knees.'], [12, 'Close your eyes. Take a slow breath in, and a long breath out.'],
      [22, 'Om is said in three parts: ah, rising from the belly; oh, through the chest; and mm, humming in the head. Then comes the silence that follows.'],
      [42, 'We will chant together. Breathe in, and join the sound.'], [127, 'Let each Om be a little softer than the one before.'],
      [170, 'Now chant on your own, in your own time. Let each Om ride on the out-breath. I will stay quiet.'],
      [260, 'Feel the hum in the chest, the throat and the head.'], [330, 'Let the sound become silent. Repeat Om only in the mind.'],
      [420, 'Rest in the silence between the thoughts.'], [498, 'Let us chant three more times, together.'],
      [546, 'Sit for a moment in the stillness that remains.'], [578, 'Gently open your eyes.']],
    oms: [50, 61, 72, 83, 94, 105, 116, 134, 145, 156, 506, 517, 528],
  },
  {
    id: 'stress', icon: 'leaf', name: 'Stress release', tag: 'Letting go', min: 10, len: 600, sub: 'Sighing breaths, releasing tension from the body, and making room around what weighs on you.',
    lines: [[3, 'Welcome. Whatever brought you here, you can set it down for these few minutes.'], [13, 'Let your hands rest, and let your eyes close or soften.'],
      [22, 'Let us begin with a sighing breath. Breathe in through the nose, take a little extra sip of air at the top, and then sigh it all out through the mouth.'],
      [42, 'Again. In, a little more, and sigh it out.'], [54, 'Once more. In, a little more, and let it all go.'],
      [68, 'Now let the breath settle, and make each out-breath a little longer than the in-breath.'],
      [96, 'Notice where you are holding tension. The jaw, the shoulders, the hands, the belly.'],
      [116, 'Let us release it. Lift the shoulders up toward the ears, hold for a moment, and let them drop.'], [134, 'Again. Lift, hold, and let go.'],
      [150, 'Make gentle fists with your hands, squeeze, and slowly open the fingers.'], [168, 'Scrunch the face, and release it. Let the forehead smooth and the jaw hang loose.'],
      [190, 'Now bring to mind what is weighing on you, just lightly. Name it to yourself in one or two words.'],
      [214, 'Notice where you feel it in the body. Perhaps a tightness, a heaviness, a flutter.'], [238, 'Breathe gently toward that place, as if the breath could make room around it.'],
      [264, 'You do not need to solve anything right now. Let it be there, held in a wider space.'],
      [302, 'Picture each out-breath carrying a little of the tension away, like a stream carrying leaves.'], [342, 'Breathing in, I calm the body. Breathing out, I let go.'],
      [402, 'Rest in this calm. Feel the cushion beneath you, solid and steady.'], [470, 'Remind yourself: I can come back to this breath whenever I need it.'],
      [530, 'Begin to deepen the breath. Stretch the fingers, and roll the shoulders.'], [560, 'When you are ready, open your eyes, and move gently into the rest of your day.']],
  },
  {
    id: 'sleep', icon: 'moon', name: 'Sleep meditation', tag: 'Yoga nidra', min: 15, len: 900, sleep: true, sub: 'A slow journey through the body and a countdown of breaths, to drift toward sleep. Best lying down.',
    lines: [[3, 'Welcome. This practice is made for rest. If you can, listen lying down, in bed, with the lights low.'], [16, 'Let the body be completely still and comfortable. Let the eyes close.'],
      [27, 'Take a long breath in, and a long, slow breath out. Let the body grow heavy.'], [41, 'There is nothing you need to do now. The day is done.'],
      [57, 'Set a small intention for your rest. Perhaps: may I sleep deeply, and wake refreshed.'],
      [82, 'Now we will travel through the body, resting the attention briefly in each place. Simply feel each part as it is named.'],
      [102, 'The right hand. The thumb, the first finger, the second, the third, the little finger. The palm, the back of the hand, the wrist.'],
      [126, 'The forearm, the elbow, the upper arm, the shoulder. The whole right arm, heavy and warm.'],
      [150, 'The left hand. The thumb, the first finger, the second, the third, the little finger. The palm, the back of the hand, the wrist.'],
      [174, 'The forearm, the elbow, the upper arm, the shoulder. The whole left arm, heavy and warm.'],
      [198, 'The right foot. The toes, the sole, the heel. The ankle, the calf, the knee, the thigh. The whole right leg, heavy.'],
      [224, 'The left foot. The toes, the sole, the heel. The ankle, the calf, the knee, the thigh. The whole left leg, heavy.'],
      [250, 'The hips, the lower back, the middle back, the shoulders. The belly, the chest, the throat.'],
      [274, 'The face. The jaw, the lips, the cheeks, the eyes, the forehead. The whole head, soft and still.'], [302, 'The whole body, heavy, warm and at rest.'],
      [334, 'Now count the breaths backwards, slowly, from twenty seven. Breathing in, twenty seven. Breathing out, twenty seven.'],
      [358, 'Breathing in, twenty six. Breathing out, twenty six. Continue on your own. If you lose count, simply begin again. There is no hurry.'],
      [446, 'Let the counting fade if it wants to. Let the breath breathe itself.'],
      [526, 'Imagine lying beside a calm lake at night. The water is still. The moon rests on it.'],
      [586, 'With each breath you sink a little deeper, like a leaf settling slowly to the bed of the lake.'],
      [656, 'Rest now. You are safe. You can let go completely.'], [764, 'Sleep well.']],
  },
  {
    id: 'trataka', icon: 'flame', name: 'Diya gazing', tag: 'Trataka', min: 5, len: 300, view: 'flame', sub: 'Gaze softly at the lamp, then close your eyes and hold its light within.',
    lines: [[3, 'Welcome. Sit comfortably, facing the lamp.'], [10, 'Rest your gaze on the flame. Blink when you need to, and keep the eyes soft, not staring.'],
      [24, 'Notice its colour, its shape, the small dance of the light.'], [50, 'Let the mind be as steady as the flame.'],
      [80, 'Now close your eyes. See the after-image of the flame at the space between your eyebrows.'], [100, 'When it fades, simply rest there, in the quiet light within.'],
      [140, 'Open your eyes softly, and gaze at the flame once more.'], [175, 'And close your eyes again. Hold the inner light, steady and warm.'],
      [215, 'Let the light spread through the whole body, from the brow to the heart.'], [265, 'Take a deeper breath.'], [280, 'Gently open your eyes.']],
  },
];

// ---------------------------------------------------------------- silent sitting
export const TIMER = { id: 'timer', icon: 'timer', name: 'Silent sitting', tag: 'Dhyana', sub: 'Sit in silence with a bell at the start, between intervals, and at the end.', minutes: [5, 10, 15, 20], def: 10 };

// ---------------------------------------------------------------- spoken guidance
export class Guide {
  constructor() {
    this.ok = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
    this.voiceURI = null; this.rate = 0.88; this.pitch = 0.98; this.volume = 1; this.muted = false; this.onCaption = null;
    this._list = [];
    if (this.ok) { const load = () => { this._list = speechSynthesis.getVoices(); }; load(); speechSynthesis.addEventListener?.('voiceschanged', load); }
  }
  // English voices, best first: Indian English and "natural" voices lead
  voices() {
    const score = (v) => { const n = v.name.toLowerCase(), l = (v.lang || '').toLowerCase(); let s = 0;
      if (/natural|neural|online|enhanced|premium|siri/.test(n)) s += 4; if (l === 'en-in') s += 3; if (/google/.test(n)) s += 2;
      if (/veena|rishi|neerja|prabhat|heera|ravi|samantha|karen|moira|daniel|serena|aria|jenny|libby|sonia/.test(n)) s += 1; if (v.localService) s += 0.5; return s; };
    return this._list.filter(v => /^en/i.test(v.lang || '')).sort((a, b) => score(b) - score(a));
  }
  get voice() { const vs = this.voices(); return vs.find(v => v.voiceURI === this.voiceURI) || vs[0] || null; }
  unlock() { if (!this.ok) return; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }   // iOS needs a first utterance from a tap
  say(text, { caption = true } = {}) {
    if (caption && this.onCaption) this.onCaption(text);
    if (!this.ok || this.muted) return;
    try {
      const u = new SpeechSynthesisUtterance(text); const v = this.voice;
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
      u.rate = this.rate; u.pitch = this.pitch; u.volume = this.volume;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  cancel() { if (this.ok) try { speechSynthesis.cancel(); } catch (e) {} }
}
// rough speaking time, so lines never overlap
const speakTime = (text, rate = 0.88) => 0.6 + text.split(/\s+/).length / (2.55 * rate) + (text.match(/[,.;:]/g) || []).length * 0.25;

// ---------------------------------------------------------------- a session
export class Session {
  // kind: 'breath' | 'meditation' | 'timer'; voice: 'every' | 'guide' | 'tones'
  constructor(kind, def, { minutes, voice = 'guide', tones = true, audio, guide, recorded = null }) {
    Object.assign(this, { kind, def, voiceMode: voice, tones, audio, guide, recorded });
    this.minutes = kind === 'meditation' ? def.min : minutes || def.def;
    this.events = []; this.elapsed = 0; this.running = false; this.done = false; this.i = 0; this.cycles = 0;
    this.state = { phase: 'intro', label: 'Settle in', progress: 0, fill: 0.5, left: 0, count: 0 };
    this._build();
    this.total = this.events.length ? Math.max(...this.events.map(e => e.t + (e.dur || 0))) : this.minutes * 60;
  }
  _say(t, text, opts = {}) { this.events.push({ t, type: 'say', text, ...opts }); return t + speakTime(text, this.guide?.rate); }
  _build() {
    const E = this.events, speak = this.voiceMode !== 'tones';
    if (this.kind === 'meditation') {
      E.push({ t: 0, type: 'bowl' });
      for (const [t, text] of this.def.lines) this._say(t, text);
      for (const t of this.def.oms || []) E.push({ t, type: 'om', dur: 7.5 });
      const end = this.def.len - 6;
      if (this.def.sleep) E.push({ t: end, type: 'bowl', s: 0.3 }, { t: this.def.len, type: 'end' });
      else E.push({ t: end, type: 'bowl' }, { t: end + 2.5, type: 'bowl', s: 0.8 }, { t: end + 5, type: 'bowl', s: 0.6 }, { t: this.def.len, type: 'end' });
      return;
    }
    if (this.kind === 'timer') {
      const len = this.minutes * 60;
      E.push({ t: 0, type: 'bowl' });
      this._say(2, 'Let us sit together in silence. I will ring the bell when the time is complete.', { quiet: !speak });
      for (let m = 5; m < this.minutes; m += 5) E.push({ t: m * 60, type: 'bowl', s: 0.55 });
      E.push({ t: len - 5, type: 'bowl' }, { t: len - 2.5, type: 'bowl', s: 0.8 });
      this._say(len - 1, 'The time is complete. Gently open your eyes.', { quiet: !speak });
      E.push({ t: len + 4, type: 'end' });
      return;
    }
    // breathwork: intro, cycles until the time is used, then a closing
    const total = this.minutes * 60, pattern = this.def.pattern, cycleLen = pattern.reduce((a, p) => a + p[1], 0);
    E.push({ t: 0, type: 'bowl', s: 0.8 });
    let t = 2.5;
    for (const line of this.def.intro) t = this._say(t, line, { quiet: !speak }) + 0.6;
    const closeLen = this.def.close.reduce((a, l) => a + speakTime(l) + 0.8, 0) + 8;
    const start = t + 1, cycles = Math.max(3, Math.floor((total - start - closeLen) / cycleLen));
    this.breathStart = start; this.breathEnd = start + cycles * cycleLen;
    let ct = start; const tips = this.def.tips.slice(); let tipAt = start + cycleLen * 5;
    for (let c = 0; c < cycles; c++) {
      for (const [ph, d] of pattern) {
        const speakCue = this.voiceMode === 'every' || (this.voiceMode === 'guide' && (c < 4 || (c % 10 === 0 && ph === pattern[0][0])));
        E.push({ t: ct, type: 'phase', phase: ph, dur: d, cycle: c, cue: speak && speakCue ? (this.def.words?.[BASE(ph)] && (this.voiceMode === 'every' || c < 3) ? this.def.words[BASE(ph)] : CUE[ph]) : null });
        ct += d;
      }
      // encouragement in "guide" mode, placed during a long phase so it does not crowd the cues
      if (this.voiceMode === 'guide' && ct > tipAt && c < cycles - 3 && tips.length) { E.push({ t: ct - cycleLen + 0.4, type: 'say', text: tips.shift(), tip: true }); tipAt = ct + cycleLen * 6; }
    }
    if (this.voiceMode !== 'tones' && cycles > 8) { const half = start + Math.floor(cycles / 2) * cycleLen; E.push({ t: half + 0.3, type: 'say', text: 'Halfway. Keep going, gently.', tip: true }); }
    let tc = ct + 1;
    for (const line of this.def.close) tc = this._say(tc, line, { quiet: !speak }) + 0.8;
    E.push({ t: tc + 1, type: 'bowl' }, { t: tc + 3.5, type: 'bowl', s: 0.7 }, { t: tc + 7, type: 'end' });
  }
  start() { this.running = true; this.events.sort((a, b) => a.t - b.t); this._fire(); }
  pause() { this.running = false; this.guide?.cancel(); }
  resume() { this.running = true; }
  stop() { this.running = false; this.done = true; this.guide?.cancel(); }
  update(dt) {
    if (!this.running || this.done) return;
    this.elapsed += dt; this._fire();
    // the breathing light: how full the lungs are, and how far through the phase we are
    const st = this.state, p = this._phase;
    if (this.kind === 'breath' && p && this.elapsed < p.t + p.dur + 0.01 && this.elapsed >= this.breathStart) {
      const k = Math.min(1, (this.elapsed - p.t) / p.dur), base = BASE(p.phase), ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
      st.phase = p.phase; st.label = PHASE_LABEL[p.phase]; st.progress = k; st.left = Math.max(0, Math.ceil(p.dur - (this.elapsed - p.t)));
      st.fill = base === 'in' ? ease(k) : base === 'out' || base === 'hum' ? 1 - ease(k) : base === 'hold' ? 1 : 0;
      st.count = p.cycle + 1;
    } else {
      const before = this.kind === 'breath' && this.elapsed < (this.breathStart || 0);
      st.phase = before ? 'intro' : this.kind === 'breath' ? 'close' : 'settle'; st.label = PHASE_LABEL[st.phase] || ''; st.left = 0; st.progress = 0;
      st.fill = 0.5 + 0.5 * Math.sin(this.elapsed * (2 * Math.PI / 10));   // a slow natural breath for the light
    }
  }
  _fire() {
    const E = this.events;
    while (this.i < E.length && E[this.i].t <= this.elapsed) {
      const e = E[this.i++];
      if (e.type === 'say') { if (!e.quiet && !this.recorded) this.guide?.say(e.text); else this.guide?.onCaption?.(e.text); }
      else if (e.type === 'phase') { this._phase = e; if (this.tones) this.audio?.breathCue(BASE(e.phase) === 'in' ? 'in' : BASE(e.phase) === 'out' ? 'out' : e.phase, e.dur); if (e.cue) this.guide?.say(e.cue, { caption: false }); this.cycles = e.cycle + 1; }
      else if (e.type === 'bowl') this.audio?.bowl(e.s ?? 1);
      else if (e.type === 'om') this.audio?.om(e.dur);
      else if (e.type === 'end') { this.done = true; this.running = false; this.onEnd?.(); }
    }
  }
  get remaining() { return Math.max(0, this.total - this.elapsed); }
  // jump back or forward; the guide picks up at the next line and the breath at the next phase
  seek(delta) {
    const t = Math.max(0, Math.min(this.total - 1, this.elapsed + delta));
    this.guide?.cancel(); this.elapsed = t;
    this.i = this.events.findIndex(e => e.t > t); if (this.i < 0) this.i = this.events.length;
    const done = this.events.slice(0, this.i);
    this._phase = [...done].reverse().find(e => e.type === 'phase') || null;
    const line = [...done].reverse().find(e => e.type === 'say' && !e.tip);
    if (line) this.guide?.onCaption?.(line.text);
  }
}

// ---------------------------------------------------------------- practice log (this device only)
const LOG = 'vt.practice.v1';
export const PracticeLog = {
  load() { try { return JSON.parse(localStorage.getItem(LOG)) || { sessions: [] }; } catch (e) { return { sessions: [] }; } },
  add(entry) { const d = this.load(); d.sessions.push({ ...entry, at: Date.now() }); d.sessions = d.sessions.slice(-400); try { localStorage.setItem(LOG, JSON.stringify(d)); } catch (e) {} return d; },
  summary() {
    const s = this.load().sessions, day = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
    const now = Date.now(), week = s.filter(x => now - x.at < 7 * 864e5), today = s.filter(x => day(x.at) === day(now));
    const days = new Set(s.map(x => day(x.at))); let streak = 0;
    for (let i = 0; i < 400; i++) { if (days.has(day(now - i * 864e5))) streak++; else if (i > 0) break; }
    const mins = (a) => Math.round(a.reduce((t, x) => t + (x.minutes || 0), 0));
    return { today: mins(today), week: mins(week), weekSessions: week.length, streak, total: s.length };
  },
};
