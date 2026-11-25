/**
 * npm run termo:words -- --data <directory with fserb/pt-br> [--report] [--candidates 3000]
 *
 * Builds the three Portuguese word modules under
 * src/games/termo/engine/words/pt-br/ from the fserb/pt-br data set
 * (https://github.com/fserb/pt-br, MIT). The directory must hold `lexico`,
 * `icf` and `conjugações` (or `conjugacoes`), and `listas/negativas` (or
 * `negativas`). The English modules come from scripts/termo/build-words-en.ts.
 *
 * `--report` prints the answer candidates in rank order and writes nothing.
 * That is how scripts/termo/answers-exclude.txt is reviewed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../shared/cli";

const WORD_LENGTH = 5;
/**
 * Up to this ICF (a higher ICF means a rarer word) every dictionary entry is an
 * answer unless scripts/termo/answers-exclude.txt drops it. Past it most entries
 * are obscure, and a word is an answer only if answers-include.txt lists it.
 */
const MAX_ANSWER_ICF = 13.472;
/** How many answers, from the most common down, feed the easy tier. */
const EASY_COUNT = 700;

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
if (typeof args.data !== "string") {
  console.error("Usage: tsx scripts/termo/build-words.ts --data <directory with the fserb/pt-br files> [--report]");
  process.exit(1);
}
const dataDir = args.data;

function readList(...names: string[]): string[] {
  for (const name of names) {
    const path = join(dataDir, name);
    if (existsSync(path)) {
      return readFileSync(path, "utf8")
        .split("\n")
        .map((line) => line.trim().normalize("NFC"))
        .filter((line) => line !== "");
    }
  }
  throw new Error(`None of ${names.join(", ")} found in ${dataDir}`);
}

/** Accents and the cedilla come off: "maçã" is typed and matched as "maca". */
const plain = (word: string): string => word.normalize("NFD").replace(/[̀-ͯ]/g, "");
const isPlayable = (word: string): boolean => [...word].length === WORD_LENGTH && /^[a-z]{5}$/.test(plain(word));

const lexico = readList("lexico");
const conjugations = readList("conjugações", "conjugacoes");
const negatives = new Set(readList("listas/negativas", "negativas").map(plain));
const infinitives = new Set(readList("listas/verbos", "verbos"));
const icf = new Map<string, number>();
for (const line of readList("icf")) {
  const comma = line.lastIndexOf(",");
  icf.set(line.slice(0, comma), Number(line.slice(comma + 1)));
}
const rarity = (word: string): number => icf.get(word) ?? 99;

const lexicon = new Set(lexico);
const lexiconPlain = new Set(lexico.map(plain));
const conjugated = new Set(conjugations);

/**
 * True when `word` is a regular plural or feminine of a dictionary entry. The
 * dictionary lists lemmas only, so "gatos", "belas" and "leões" come from here.
 * Bases are compared without accents: "meses" finds "mês".
 */
function inflectionBase(word: string): string | null {
  const text = plain(word);
  const has = (base: string): string | null => (base.length >= 2 && lexiconPlain.has(base) ? base : null);
  if (text.endsWith("s")) {
    const stem = text.slice(0, -1);
    const found =
      has(stem) ?? // gato, gatos
      (text.endsWith("as") ? has(`${text.slice(0, -2)}o`) : null) ?? // belo, belas
      (text.endsWith("oes") || text.endsWith("aes") ? has(`${text.slice(0, -3)}ao`) : null) ?? // leão, leões
      (text.endsWith("es") && /[rzs]$/.test(text.slice(0, -2)) ? has(text.slice(0, -2)) : null) ?? // mar, mares
      (text.endsWith("is") ? has(`${text.slice(0, -2)}l`) : null) ?? // anel, anéis
      (text.endsWith("ns") ? has(`${text.slice(0, -2)}m`) : null); // item, itens
    if (found) return found;
  }
  if (text.endsWith("a")) return has(`${text.slice(0, -1)}o`); // amigo, amiga
  return null;
}

// Every accepted guess, keyed by its plain form. The value is the spelling shown: the most frequent one.
const shown = new Map<string, string>();
const consider = (word: string) => {
  if (!isPlayable(word)) return;
  const key = plain(word);
  const current = shown.get(key);
  if (current === undefined || rarity(word) < rarity(current) || (rarity(word) === rarity(current) && word === key)) shown.set(key, word);
};
for (const word of lexico) consider(word);
for (const word of conjugations) consider(word);
let inflected = 0;
for (const word of icf.keys()) {
  if (!isPlayable(word) || lexicon.has(word) || conjugated.has(word) || inflectionBase(word) === null) continue;
  inflected++;
  consider(word);
}
// The frequency list misses many everyday plurals ("gatos", "mesas"), so the two regular rules also run straight from the dictionary.
for (const word of lexico) {
  const regular = word.endsWith("ão") ? `${word.slice(0, -2)}ões` : /[aeiouáéíóúâêôã]$/.test(word) ? `${word}s` : /[rzs]$/.test(word) ? `${plain(word)}es` : null;
  if (regular === null || !isPlayable(regular) || shown.has(plain(regular))) continue;
  inflected++;
  consider(regular);
}

const readWords = (file: string): Set<string> =>
  new Set(
    readFileSync(join(here, file), "utf8")
      .split("\n")
      .flatMap((line) => line.replace(/#.*/, "").split(/\s+/))
      .filter((word) => word !== "")
      .map(plain),
  );
const exclude = readWords("answers-exclude.txt");
const include = readWords("answers-include.txt");

/** Verb endings that are never a noun or an adjective of their own. "falou", "comem", "tinha" go. "canto" and "venda" stay for the review. */
const VERB_ONLY = /(ou|am|em|ei|eu|iu|ia|ais|eis|mos|ava|ara|era|ira|sse|rei|ras|res|rao)$/;

function isAnswerCandidate(word: string): boolean {
  const key = plain(word);
  if (!lexicon.has(word) || !isPlayable(word)) return false;
  // The answer must be the spelling a guess of these letters shows, or the row would display another word.
  if (shown.get(key) !== word) return false;
  if (negatives.has(key)) return false;
  // The include list overrules the frequency cut-off and the automatic filters below: "verão" looks like a verb form and is not one.
  if (include.has(key)) return true;
  if (rarity(word) > MAX_ANSWER_ICF) return false;
  // Letters outside the Portuguese alphabet mark loanwords: "pizza" stays out of the answers but is still a valid guess.
  if (/[kwy]/.test(key)) return false;
  if (conjugated.has(word) && !infinitives.has(word) && VERB_ONLY.test(key)) return false;
  // Plurals and feminines of another entry: "todos", "horas". "lápis" and "atlas" have no such base and stay.
  if (key.endsWith("s") && inflectionBase(word) !== null) return false;
  return true;
}

const candidates = lexico.filter(isAnswerCandidate).sort((a, b) => rarity(a) - rarity(b) || a.localeCompare(b));
const answers = candidates.filter((word) => !exclude.has(plain(word)));
const answerKeys = new Set(answers.map(plain));
const notUsed = [...include].filter((key) => !answerKeys.has(key));
if (notUsed.length > 0) console.warn(`answers-include.txt lists words that did not become answers: ${notUsed.join(" ")}`);

if (args.dropped) {
  // Dictionary entries under the cut-off that the automatic filters removed. Good ones go to answers-include.txt.
  const dropped = lexico.filter((word) => isPlayable(word) && rarity(word) <= MAX_ANSWER_ICF && shown.get(plain(word)) === word && !negatives.has(plain(word)) && !isAnswerCandidate(word));
  console.log(dropped.sort((a, b) => rarity(a) - rarity(b)).join(" "));
  process.exit(0);
}

if (args.report) {
  const limit = Number(args.candidates ?? candidates.length);
  const from = Number(args.from ?? 0);
  console.log(`${candidates.length} candidates, ${answers.length} after the exclusion list. Showing ${from} to ${Math.min(limit, candidates.length)} of the ones still in.`);
  console.log(answers.slice(from, limit).join(" "));
  process.exit(0);
}

const guesses = [...shown.keys()].filter((key) => !answerKeys.has(key)).sort();
const accented = [...shown.values()].filter((word) => word !== plain(word)).sort((a, b) => plain(a).localeCompare(plain(b)));

const HEADER = `/**
 * GENERATED by scripts/termo/build-words.ts. Do not edit by hand.
 *
 * Built from fserb/pt-br (https://github.com/fserb/pt-br), used under the MIT License:
 *
 * Copyright 2021 Fernando Serboncini
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
`;

const outDir = join(here, "../../src/games/termo/engine/words/pt-br");
mkdirSync(outDir, { recursive: true });
const write = (file: string, body: string) => writeFileSync(join(outDir, file), `${HEADER}\n${body}`);

write(
  "answers.ts",
  [
    `/** ${answers.length} answers, five plain letters each, from the most common word down. The order is part of generator version 1. */`,
    `export const ANSWERS = "${answers.map(plain).join("")}";`,
    "",
    "/** The first words of the list, the most common ones, feed the easy tier. */",
    `export const EASY_ANSWER_COUNT = ${Math.min(EASY_COUNT, answers.length)};`,
    "",
  ].join("\n"),
);
write("guesses.ts", [`/** ${guesses.length} more words a guess may be, five plain letters each, sorted. Answers are accepted too and are not repeated here. */`, `export const GUESSES = "${guesses.join("")}";`, ""].join("\n"));
write("accents.ts", [`/** ${accented.length} words that are written with an accent or a cedilla, separated by spaces. Words that are not here are shown as typed. */`, `export const ACCENTED = "${accented.join(" ")}";`, ""].join("\n"));

console.log(`lexicon entries      ${lexico.filter(isPlayable).length}`);
console.log(`verb forms           ${conjugations.filter(isPlayable).length}`);
console.log(`plurals, feminines   ${inflected}`);
console.log(`accepted guesses     ${shown.size} (${answers.length} answers + ${guesses.length} others)`);
console.log(`accented spellings   ${accented.length}`);
console.log(`answer candidates    ${candidates.length}, ${candidates.length - answers.length} excluded by hand`);
console.log(`easy pool            ${Math.min(EASY_COUNT, answers.length)}`);
