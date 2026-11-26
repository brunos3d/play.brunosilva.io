/**
 * Names for players who have not picked one: an animal and a number, in the
 * language of the page they first played on. Nothing in a name identifies
 * anyone, and a player can change it at any time.
 */
const ANIMALS: Record<string, readonly string[]> = {
  en: ["Fox", "Otter", "Owl", "Lynx", "Heron", "Badger", "Falcon", "Panda", "Koala", "Tiger", "Wolf", "Hare", "Seal", "Crane", "Moose", "Gecko", "Raven", "Bison", "Lemur", "Finch"],
  "pt-br": ["Raposa", "Lontra", "Coruja", "Lince", "Garça", "Tucano", "Falcão", "Panda", "Coala", "Tigre", "Lobo", "Lebre", "Foca", "Arara", "Capivara", "Jabuti", "Quati", "Onça", "Sagui", "Sabiá"],
};

export const NAME_MAX_LENGTH = 20;

export function randomPlayerName(locale: string, random: () => number = Math.random): string {
  // Own keys only: "constructor" or "toString" as a locale would otherwise find something that is not a list of animals.
  const animals = Object.hasOwn(ANIMALS, locale) ? ANIMALS[locale] : ANIMALS.en;
  return `${animals[Math.floor(random() * animals.length)]} ${Math.floor(random() * 900) + 100}`;
}

/** One emoji of a joined sequence: a picture, with the mark that makes it colourful or gives it a skin tone. */
const EMOJI_PART = "\\p{Extended_Pictographic}[\\u{FE0F}\\u{1F3FB}-\\u{1F3FF}]?";
const INVISIBLE = new RegExp(
  `(\\u{1F3F4}[\\u{E0030}-\\u{E0039}\\u{E0061}-\\u{E007A}]{1,6}\\u{E007F}|${EMOJI_PART}(?:\\u200D${EMOJI_PART})+)` +
    "|[\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}\\p{Cs}\\p{Zl}\\p{Zp}\\u115f\\u1160\\u3164\\uffa0\\u2800\\ufffc]",
  "gu",
);

const keepEmoji = (_match: string, emoji?: string): string => emoji ?? "";

/** A name as it will be stored: one line, trimmed, bounded. Null when nothing readable is left. */
export function cleanPlayerName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input
    .normalize("NFC")
    // What cannot be seen, or changes what is seen around it: control and format characters (zero-width ones, the marks
    // that reorder text), private-use and unassigned code points, line separators, and the letters that render as
    // nothing. In someone else's table they would make a row look empty, or look like another player's. Two uses of
    // invisible characters are emoji, and are kept whole: the flags of England, Scotland and Wales (a black flag, the
    // region's letters as tag characters and a closing tag), and emoji joined into one picture by zero-width joiners.
    .replace(INVISIBLE, keepEmoji)
    .replace(/\s+/g, " ")
    .trim();
  // The cut can fall inside a joined emoji or a flag. Cleaning once more drops the joiner or the tags left hanging.
  const clipped = [...name].slice(0, NAME_MAX_LENGTH).join("").replace(INVISIBLE, keepEmoji).trim();
  // Something has to be there to read: a letter, a digit, a sign or a picture. Marks on their own show as nothing.
  return /[\p{L}\p{N}\p{P}\p{S}]/u.test(clipped) ? clipped : null;
}

/** The seed of an avatar: letters, digits and dashes. The picture is generated from it on each device. */
export function cleanAvatarSeed(input: unknown): string | null {
  return typeof input === "string" && /^[A-Za-z0-9-]{4,40}$/.test(input) ? input : null;
}

export function randomAvatarSeed(random: () => number = Math.random): string {
  let seed = "";
  for (let index = 0; index < 12; index++) seed += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(random() * 36)];
  return seed;
}

/**
 * A nickname is the one thing about a player that nobody else can have. A
 * display name is free text and two players may pick the same one, so the
 * nickname is what tells them apart in a ranking or a room: "@sabia175".
 * Lower case letters, digits and underscores only, so two nicknames never
 * look alike while being different.
 */
export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;

/** Names that would pass for the site itself. */
const RESERVED_NICKNAMES = new Set(["admin", "administrator", "moderator", "mod", "minigames", "system", "support", "staff", "official"]);

/** A nickname as it will be stored, or null when it is not one. A leading "@" and upper case are forgiven. */
export function cleanNickname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const nickname = input.trim().replace(/^@/, "").toLowerCase();
  if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) return null;
  return /^[a-z0-9_]+$/.test(nickname) && !RESERVED_NICKNAMES.has(nickname) ? nickname : null;
}

/** The nickname a new player starts with, made from their name: "Sabiá 175" gives "sabia175". The server adds a suffix when it is taken. */
export function nicknameFromName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 15);
  const nickname = base.length >= NICKNAME_MIN_LENGTH ? base : `player${base}`;
  return RESERVED_NICKNAMES.has(nickname) ? `${nickname}_` : nickname;
}
