/**
 * Client-side profanity & evasion filter for Display Names and Room Codes.
 *
 * Designed for clinical music-therapy rooms (UK & US English):
 * - Catches explicit profanity, slurs, sexual/abusive terms, and common bypasses
 *   (leetspeak, symbol substitutions, Unicode lookalikes, spaced-out letters,
 *   repeated characters, wildcard censoring like f*ck / sh*t, and phonetic variants).
 * - Protects innocent music & clinical vocabulary (e.g. "Bass", "Brass", "Classical",
 *   "Therapist", "Acoustic", "Document", "Analysis", "Cassie", "Hello").
 */

// Homoglyph / Cyrillic / Greek / leetspeak map to ASCII lowercase
const CHAR_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '|': 'i',
  '¡': 'i',
  '€': 'e',
  '£': 'l',
  '¥': 'y',
  '¢': 'c',
  '+': 't',
  // Cyrillic & Greek lookalikes
  'а': 'a',
  'е': 'e',
  'о': 'o',
  'р': 'p',
  'с': 'c',
  'у': 'y',
  'х': 'x',
  'і': 'i',
  'ј': 'j',
  'ѕ': 's',
  'к': 'k',
  'м': 'm',
  'т': 't',
  'ν': 'v',
  'α': 'a',
  'ε': 'e',
  'ο': 'o',
  'ρ': 'p',
};

// Also test an alternate digit map where 1 -> l (e.g. "s1ut" -> "slut", "bo11ocks" -> "bollocks")
const CHAR_MAP_L: Record<string, string> = {
  ...CHAR_MAP,
  '1': 'l',
  '|': 'l',
  '!': 'l',
};

/**
 * Tier A: Unambiguous profanity, slurs, and bypass stems blocked even as substrings
 * inside compact/joined text (catches "myfuckroom", "f.u.c.k", "fuuuuck", "phuck", etc.).
 */
const SUBSTRING_BLOCKED: string[] = [
  // Core F-word & bypasses
  'fuck',
  'fuk',
  'fvck',
  'fuxk',
  'fckin',
  'fcking',
  'fking',
  'phuck',
  'phuk',
  'phuq',
  'fookin',
  'motherfuk',
  'mofo',
  'mtherf',
  // Core S-word & bypasses
  'shit',
  'shyt',
  'sh1t',
  'bullsh',
  'dipsh',
  'horsesh',
  'apesh',
  // Core C-word & bypasses
  'cunt',
  'cvnt',
  'kunt',
  'kvnt',
  // B-words
  'bitch',
  'biatch',
  'bytch',
  'beyotch',
  'bastard',
  'bastrd',
  'bollock',
  'bollok',
  'bolox',
  'bellend',
  'bugger',
  // UK & US insults / profanity
  'wanker',
  'wank',
  'wnkr',
  'twat',
  'tosser',
  'knobhead',
  'nobhead',
  'dickhead',
  'dikhead',
  'cocksuck',
  'arsehole',
  'asshole',
  'ashole',
  'azzhole',
  'dumbass',
  'jackass',
  'fatass',
  'smartass',
  'prick',
  'minger',
  'pillock',
  // Sexual / explicit terms
  'whore',
  'slut',
  'skank',
  'pussy',
  'penis',
  'vagina',
  'dildo',
  'blowjob',
  'handjob',
  'rimjob',
  'cumshot',
  'jizz',
  'spunk',
  'porn',
  'hentai',
  'orgasm',
  'masturbat',
  'testicle',
  'scrotum',
  'clitoris',
  'fellate',
  'felch',
  'bukkake',
  'milf',
  'nsfw',
  'choad',
  'schlong',
  // Severe slurs, hate speech & safeguarding
  'nigger',
  'nigga',
  'nigg',
  'faggot',
  'fagot',
  'faggit',
  'dyke',
  'tranny',
  'retard',
  'spastic',
  'kike',
  'chink',
  'gook',
  'wetback',
  'paki',
  'raghead',
  'towelhead',
  'darkie',
  'coonass',
  'nazi',
  'hitler',
  'swastika',
  'paedo',
  'pedo',
  'nonce',
  'rapist',
  'rape',
  'kys',
];

/**
 * Tier B: Whole-word / standalone blocked words & shorthand bypasses.
 * Kept token-bounded so innocent words like "Bass", "Brass", "Classical", "Therapist",
 * "Document", "Analysis", "Cassie", "Hancock", "Dickens", "Cocktail" are never blocked.
 */
const WHOLE_WORD_BLOCKED = new Set<string>([
  'ass',
  'asses',
  'azz',
  'arse',
  'arses',
  'cock',
  'cocks',
  'kock',
  'kok',
  'dick',
  'dicks',
  'dik',
  'dck',
  'crap',
  'piss',
  'pissed',
  'pissing',
  'pisser',
  'tit',
  'tits',
  'titty',
  'titties',
  'boob',
  'boobs',
  'booby',
  'cum',
  'cums',
  'cumming',
  'fag',
  'fags',
  'fck',
  'fuc',
  'fk',
  'fkn',
  'fkr',
  'fack',
  'fock',
  'feck',
  'fook',
  'sht',
  'cnt',
  'btch',
  'wtf',
  'stfu',
  'gtfo',
  'shag',
  'shagged',
  'shagging',
  'slag',
  'slags',
  'slutty',
  'hoe',
  'hoes',
  'thot',
  'knob',
  'knobs',
  'spaz',
  'spazz',
  'spic',
  'spics',
  'coon',
  'coons',
  'wog',
  'wogs',
  'tart',
  'git',
  'twit',
  'anus',
  'anal',
  'boner',
  'horny',
  'sexy',
  'sex',
  'suck',
  'sucks',
  'turd',
  'smut',
  'fap',
]);

/**
 * Explicit regex patterns for asterisk/symbol-masked swears (e.g. "f*ck", "f**k",
 * "f***", "sh*t", "s**t", "b*tch", "c*nt", "c**t", "d*ck", "a**hole", "w*nker", "p*ss").
 */
const MASKED_SWEAR_PATTERNS: RegExp[] = [
  /\bf[\W_]{1,2}c?k/i,
  /\bf[*#$@!]{2,}/i,
  /\bfu[\W_]+k/i,
  /\bs[\W_]?h[\W_]+t\b/i,
  /\bs[*#$@!]{2,}t\b/i,
  /\bsh[\W_]+t/i,
  /\bb[\W_]+tch/i,
  /\bb[*#$@!]{2,}h\b/i,
  /\bc[\W_]+nt/i,
  /\bc[*#$@!]{2,}t\b/i,
  /\bd[\W_]+ck\b/i,
  /\bc[\W_]+ck\b/i,
  /\ba[*#$@!]{2,}h?o?l?e?\b/i,
  /\bw[\W_]+nk/i,
  /\bp[\W_]+ss\b/i,
  /\bt[\W_]+at\b/i,
  /\bn[\W_]+gg/i,
  /\bf[\W_]+gg?o?t/i,
];

/** Safe allowlist of innocent words that contain a short substring match (e.g. "therapist" -> "rapist") */
const SAFE_WORDS = new Set<string>([
  'therapist',
  'therapists',
  'psychotherapist',
  'musictherapist',
  'drape',
  'drapes',
  'draped',
  'grape',
  'grapes',
  'grapefruit',
  'scrape',
  'scraped',
  'scraper',
  'trapeze',
  'parapet',
  'scunthorpe',
  'penistone',
  'shiloh',
  'mishit',
  'shiitake',
  'shitake',
  'cockatoo',
  'cocktail',
  'peacock',
  'hancock',
  'hitchcock',
  'woodcock',
  'shuttlecock',
  'dickens',
  'benedict',
  'predict',
  'verdict',
  'bass',
  'brass',
  'class',
  'classic',
  'classical',
  'pass',
  'passage',
  'compass',
  'grass',
  'glass',
  'cassie',
  'cassette',
  'cassandra',
  'document',
  'circumstance',
  'analysis',
  'canal',
  'title',
  'titus',
  'entitle',
  'appetite',
  'attitude',
  'gratitude',
  'multitude',
  'piano',
  'marimba',
  'xylophone',
  'saxophone',
  'symphony',
  'microphone',
  'headphone',
  'headphones',
]);

function normalizeChars(input: string, map: Record<string, string>): string {
  // Strip diacritics (e.g. "fück" -> "fuck", "shít" -> "shit")
  const ascii = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Preserve standalone pure-digit chunks (like room numbers "455", "717", "617") so they
  // are never falsely mapped to leetspeak words ("ass", "tit", "git").
  return ascii.replace(/\S+/g, (chunk) => {
    // Split on hyphens/underscores/dots to check each sub-chunk
    return chunk
      .split(/([-_.]+)/)
      .map((part) => {
        if (/^\d+$/.test(part) && part.length >= 2 && part.length <= 4) {
          return part;
        }
        let out = '';
        for (const ch of part) {
          out += map[ch] ?? ch;
        }
        return out;
      })
      .join('');
  });
}

/** Collapse 3+ repeated letters to 1, and also return a 2+ collapsed variant (e.g. "fuuck" -> "fuk"/"fuck") */
function squeezeRepeats(text: string, maxRun: number): string {
  const re = new RegExp(`([a-z])\\1{${maxRun},}`, 'g');
  return text.replace(re, (_, ch: string) => ch.repeat(maxRun));
}

function checkNormalizedVariant(normalized: string): boolean {
  // Tokenize on non-letters
  const rawTokens = normalized.split(/[^a-z]+/).filter(Boolean);
  if (rawTokens.length === 0) return false;

  // Filter out known innocent words (like "therapist", "grape", "shiitake") before substring checks
  const filteredTokens = rawTokens.filter((t) => !SAFE_WORDS.has(t));

  // 1. Check each individual token (both raw, max-2 repeat squeeze, and max-1 repeat squeeze)
  for (const token of filteredTokens) {
    const sq2 = squeezeRepeats(token, 2);
    const sq1 = squeezeRepeats(token, 1);

    if (
      WHOLE_WORD_BLOCKED.has(token) ||
      WHOLE_WORD_BLOCKED.has(sq2) ||
      WHOLE_WORD_BLOCKED.has(sq1)
    ) {
      return true;
    }

    for (const stem of SUBSTRING_BLOCKED) {
      if (token.includes(stem) || sq2.includes(stem) || sq1.includes(stem)) {
        return true;
      }
    }
  }

  // 2. Compact check on non-safe tokens (catches "f u c k", "f.u.c.k", "s-h-i-t", "w a n k e r")
  const compact = filteredTokens.join('');
  if (compact.length > 0) {
    const compactSq2 = squeezeRepeats(compact, 2);
    const compactSq1 = squeezeRepeats(compact, 1);

    for (const stem of SUBSTRING_BLOCKED) {
      if (compact.includes(stem) || compactSq2.includes(stem) || compactSq1.includes(stem)) {
        return true;
      }
    }

    // 3. Spaced-out spelling check for Tier B words (e.g. "a s s", "c.o.c.k", "d-i-c-k", "p i s s")
    // Trigger when multiple short fragments (len <= 2) are joined together
    const hasShortFragments =
      filteredTokens.length >= 2 && filteredTokens.every((t) => t.length <= 2);
    if (hasShortFragments) {
      if (
        WHOLE_WORD_BLOCKED.has(compact) ||
        WHOLE_WORD_BLOCKED.has(compactSq2) ||
        WHOLE_WORD_BLOCKED.has(compactSq1)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns true if the input contains profanity, slurs, or common evasion/bypass patterns.
 */
export function containsInappropriateLanguage(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  // 1. Check asterisk/symbol-masked swears on raw input before stripping punctuation
  for (const pattern of MASKED_SWEAR_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // 2. Check standard leetspeak/homoglyph normalization (1 -> i)
  const normI = normalizeChars(trimmed, CHAR_MAP);
  if (checkNormalizedVariant(normI)) return true;

  // 3. Check alternate leetspeak normalization (1 -> l, e.g. "s1ut", "bo11ocks")
  const normL = normalizeChars(trimmed, CHAR_MAP_L);
  if (normL !== normI && checkNormalizedVariant(normL)) return true;

  // 4. Check "vv" -> "w" bypass (e.g. "vvanker")
  if (normI.includes('vv')) {
    if (checkNormalizedVariant(normI.replace(/vv/g, 'w'))) return true;
  }

  return false;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDisplayName(rawName: string): ValidationResult {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { valid: true }; // Empty falls back cleanly to "Guest"
  }
  if (containsInappropriateLanguage(trimmed)) {
    return {
      valid: false,
      error: 'Please choose a different display name — that word is not allowed.',
    };
  }
  return { valid: true };
}

export function validateRoomCode(rawCode: string): ValidationResult {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Please enter a Room Code or tap New Code to create a private room.',
    };
  }
  if (trimmed.length < 3) {
    return {
      valid: false,
      error: 'Room Code should be at least 3 characters so others do not join by accident.',
    };
  }
  if (containsInappropriateLanguage(trimmed)) {
    return {
      valid: false,
      error: 'Please choose a different Room Code — that word is not allowed.',
    };
  }
  return { valid: true };
}

const ROOM_WORDS = [
  'MAPLE',
  'CEDAR',
  'WILLOW',
  'BIRCH',
  'HAZEL',
  'ALDER',
  'ROWAN',
  'LINDEN',
  'AMBER',
  'OCHRE',
  'CORAL',
  'CLOVER',
  'MEADOW',
  'BROOK',
  'HARBOR',
  'LANTERN',
  'CHIME',
  'MELODY',
  'CADENCE',
  'TEMPO',
  'SONATA',
  'LYRIC',
  'OCTAVE',
  'CHORD',
  'HARP',
  'LUTE',
  'REED',
  'FLUTE',
  'ROBIN',
  'WREN',
  'FINCH',
  'OTTER',
  'ACORN',
  'MOSS',
  'FERN',
  'PEBBLE',
];

/** Generates a warm, easy-to-read private room code (e.g. "WILLOW-482") */
export function generateRoomCode(): string {
  for (let i = 0; i < 10; i++) {
    const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
    const num = Math.floor(100 + Math.random() * 900);
    const code = `${word}-${num}`;
    if (validateRoomCode(code).valid) return code;
  }
  return `MAPLE-${Math.floor(200 + Math.random() * 700)}`;
}
