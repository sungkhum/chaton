import { franc } from "franc-min";

/**
 * ISO 639-3 (3-letter) → ISO 639-1 (2-letter) mapping for common languages.
 * franc-min returns 3-letter codes; we store 2-letter codes in msg:lang
 * for brevity and broader compatibility.
 */
const ISO3_TO_ISO1: Record<string, string> = {
  eng: "en",
  spa: "es",
  fra: "fr",
  deu: "de",
  por: "pt",
  ita: "it",
  nld: "nl",
  rus: "ru",
  zho: "zh",
  jpn: "ja",
  kor: "ko",
  ara: "ar",
  hin: "hi",
  ben: "bn",
  tur: "tr",
  pol: "pl",
  ukr: "uk",
  vie: "vi",
  tha: "th",
  swe: "sv",
  dan: "da",
  nor: "no",
  fin: "fi",
  ces: "cs",
  ron: "ro",
  hun: "hu",
  ell: "el",
  heb: "he",
  ind: "id",
  msa: "ms",
  fil: "tl",
  cat: "ca",
  hrv: "hr",
  srp: "sr",
  bul: "bg",
  slk: "sk",
  slv: "sl",
  lit: "lt",
  lav: "lv",
  est: "et",
  kat: "ka",
  urd: "ur",
  fas: "fa",
  tam: "ta",
  tel: "te",
  mal: "ml",
  kan: "kn",
  guj: "gu",
  mar: "mr",
  pan: "pa",
  swa: "sw",
  amh: "am",
  afr: "af",
};

/**
 * Synchronous language detection using franc (< 1ms).
 * Used on the SEND path — must not add perceptible latency.
 *
 * @returns ISO 639-1 language code or null if text is too short / undetermined
 */
export function detectLanguageSync(text: string): string | null {
  if (text.length < 10) return null;

  // Strip @mentions and emoji — they corrupt trigram-based detection
  // (e.g. "@natanwells hola mundo" was detected as French instead of Spanish,
  //  "😂😂😂 hola amigos 🎉" was detected as Plateau Malagasy)
  const cleaned = text
    .replace(/@\w+/g, "")
    .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "")
    .trim();
  if (cleaned.length < 10) return null;

  const iso3 = franc(cleaned);
  if (iso3 === "und") return null;

  return ISO3_TO_ISO1[iso3] || iso3;
}

/**
 * Async language detection — same as sync for now.
 * Used on the RECEIVE path for old messages without msg:lang.
 * Can be extended with a heavier model (e.g., cld3-asm) in the future.
 */
export async function detectLanguage(text: string): Promise<string | null> {
  return detectLanguageSync(text);
}
