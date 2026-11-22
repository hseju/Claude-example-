// Keeping the temple's chat kind: the ready-made phrases, and the check every typed message (and every display
// name) passes before anyone sees it. The same file runs in the app, so you are told at once, and on the server
// (server/src/index.js imports it), which is the one that decides.
//
// A message is turned away, never shown with stars, if it carries abuse in English or Hindi/Hinglish, a slur, a
// sexual term, a threat, or contact details and links (to keep strangers in the public temple safe). The check sees
// through the usual disguises: spaced-out letters (f u c k), symbols for letters (sh1t, @ss, $), stretched letters,
// and stars standing in for letters (f*ck).

export const MAX_CHAT = 140;

// ready-made phrases: always allowed, sent by number
export const QUICK = [
  'Namaste 🙏', "Let's go!", "Let's do a prayer together", 'Shall we go to a temple?', "Let's meditate in the hut",
  'Join me for the aarti?', 'Follow me', 'Wait for me', 'Want to leave?', 'I have to go. Hari Om!', 'Thank you 🙏', 'Om Namah Shivaya',
];

// found even inside other words (long and unmistakable)
const ANYWHERE = [
  'fuck', 'motherf', 'shit', 'bitch', 'bastard', 'asshole', 'arsehole', 'dickhead', 'wanker', 'bollock', 'bullshit', 'jackass', 'douche',
  'nigger', 'nigga', 'faggot', 'porn', 'blowjob', 'handjob', 'masturbat', 'pedophil', 'paedophil',
  'chutiy', 'chutia', 'chodu', 'madarchod', 'maderchod', 'behenchod', 'bhenchod', 'benchod', 'behnchod', 'bhosd', 'bhosad', 'gaandu', 'gandu',
  'lavde', 'lavda', 'lawda', 'jhaant', 'chinal', 'kutiya', 'haramkhor', 'harami', 'bhadwa', 'bhadve',
];
// whole words only (short, or innocent inside other words)
const WORDS = [
  'ass', 'arse', 'asses', 'damn', 'dammit', 'crap', 'piss', 'pissed', 'dick', 'dicks', 'cock', 'cocks', 'cunt', 'cunts', 'twat', 'prick', 'slut', 'sluts', 'whore', 'whores', 'hoe', 'hoes',
  'tits', 'titty', 'boobs', 'boob', 'pussy', 'sex', 'sexy', 'horny', 'nude', 'nudes', 'naked', 'cum', 'rape', 'raped', 'retard', 'retarded', 'spastic',
  'wtf', 'stfu', 'gtfo', 'kys', 'fu', 'fk', 'fuk', 'fck', 'mf', 'mofo', 'rapist', 'rapists', 'gaand', 'lund', 'lauda', 'laude', 'raand', 'tatte', 'bc', 'mc', 'bsdk', 'bkl', 'mkc', 'tmkc', 'lodu', 'loda', 'randi', 'randwa', 'chut', 'kutte', 'kutti', 'kamina', 'kamine', 'kaminey', 'suar', 'suwar', 'ullu',
  'chink', 'paki', 'kike', 'spic', 'gook', 'wog', 'coon', 'katua', 'katwa', 'chamar', 'bhangi', 'mleccha', 'kafir', 'jihadi',
  'idiot', 'stupid', 'moron', 'loser', 'dumb', 'shut up', 'hate you', 'kill you', 'kill yourself', 'go die',
];
const LEET = { '@': 'a', '4': 'a', '8': 'b', '(': 'c', '3': 'e', '6': 'g', '9': 'g', '1': 'i', '!': 'i', '|': 'i', '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't', '2': 'z' };
const collapse = (s) => s.replace(/(.)\1+/g, '$1');
const anyColl = ANYWHERE.map(collapse);
const wordSet = new Set(WORDS.filter((w) => !w.includes(' ')));
const wordColl = new Set(WORDS.filter((w) => !w.includes(' ') && collapse(w).length >= 4).map(collapse));
const phrases = WORDS.filter((w) => w.includes(' '));

function normalise(text) {
  let s = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[@4813!|05$7+2(69]/g, (c) => LEET[c] || c);
  // letters spaced or dotted out ("f u c k", "s.h.i.t") are read as one word
  s = s.replace(/\b(?:[a-z*][\s._\-~]+){2,}[a-z*]\b/g, (m) => m.replace(/[\s._\-~]+/g, ''));
  return s;
}
const starMatch = (tok, list) => list.some((w) => w.length === tok.length && [...w].every((c, i) => tok[i] === '*' || tok[i] === c));

// { ok: true } or { ok: false, reason }
export function checkMessage(text) {
  const raw = String(text || '');
  if (!raw.trim()) return { ok: false, reason: 'empty' };
  if (raw.length > MAX_CHAT) return { ok: false, reason: 'long' };
  // contact details and links
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|in|io|co|me|xyz|gg|app|link|ly|tk)\b)/i.test(raw)) return { ok: false, reason: 'link' };
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(raw)) return { ok: false, reason: 'contact' };
  if ((raw.replace(/[\s\-().+]/g, '').match(/\d{7,}/) || []).length) return { ok: false, reason: 'contact' };
  if (/\b(insta(gram)?|snap(chat)?|whats ?app|telegram|discord)\b/i.test(raw)) return { ok: false, reason: 'contact' };
  const s = normalise(raw);
  const letters = collapse(s.replace(/[^a-z*\s]/g, ''));
  for (const w of anyColl) if (letters.replace(/\s+/g, ' ').split(' ').some((t) => t.includes(w))) return { ok: false, reason: 'unkind' };
  for (const p of phrases) if (s.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').includes(p)) return { ok: false, reason: 'unkind' };
  for (const tok of s.split(/[^a-z*]+/).filter(Boolean)) {
    if (wordSet.has(tok) || wordColl.has(collapse(tok))) return { ok: false, reason: 'unkind' };
    if (tok.includes('*') && (starMatch(tok, ANYWHERE) || starMatch(tok, [...wordSet]))) return { ok: false, reason: 'unkind' };
  }
  return { ok: true };
}
// a display name other people will see: anything unkind becomes plain "Devotee"
export function cleanName(name, fallback = 'Devotee') {
  const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
  if (!n) return fallback;
  const c = checkMessage(n);
  return c.ok || c.reason === 'empty' ? n : fallback;
}
export const REASONS = {
  unkind: 'Please keep the temple a peaceful place. That message was not sent.',
  link: 'Links cannot be shared in the temple. That message was not sent.',
  contact: 'For everyone’s safety, phone numbers, emails and social handles cannot be shared. That message was not sent.',
  long: `Messages can be up to ${MAX_CHAT} characters.`,
  slow: 'Slow down a little, then send again.',
  gone: 'They have left the temple, so the message could not be delivered.',
  empty: '',
};
