/**
 * npm run termo:words:en -- --data <directory with the source files> [--report] [--dropped] [--from 0 --candidates 3000]
 *
 * Builds the English word modules under src/games/termo/engine/words/en/ from
 * three sources. The directory must hold them under these names:
 *
 *   scowl-2020.12.07/final/        SCOWL 2020.12.07 (http://wordlist.aspell.net), the unpacked release
 *   enable1.txt                    ENABLE, the public domain word list
 *   frequency-alpha-alldicts.txt   hackerb9/gwordlist at commit 5e99024, word counts of the Google Books Ngram Corpus v3
 *
 * To fetch them:
 *
 *   curl -L -o scowl.tar.gz https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz
 *   tar -xzf scowl.tar.gz
 *   curl -L -O https://norvig.com/ngrams/enable1.txt
 *   curl -L -O https://raw.githubusercontent.com/hackerb9/gwordlist/5e9902468ab09802474884c3df00d77463e5cb24/frequency-alpha-alldicts.txt
 *
 * What each source is for:
 *
 * - Accepted guesses: every five-letter word of ENABLE, plus every five-letter
 *   word of the SCOWL word lists up to size 70, in any spelling (American,
 *   British, Canadian, Australian and their variants). Size 80 is left out: it
 *   brings in a dictionary whose licence asks for its whole text to be shipped.
 * - Answers: words of SCOWL sizes 10 to 35 that are spelled the same in every
 *   dialect, so nobody has to guess between COLOR and COLOUR. Plurals in S and
 *   verb forms in S, ED and ING are dropped, as the Portuguese build drops
 *   inflections. The words of SCOWL's own taboo lists (its `misc` folder) are
 *   dropped too. scripts/termo/answers-exclude-en.txt drops what is left by
 *   hand (offensive words, names, jargon), and answers-include-en.txt adds
 *   words the filters or the size limit took out.
 * - Order: the answers run from the most common word down, by their count in
 *   the Google Books corpus. The easy tier draws from the first 700.
 *
 * Four flags print a list and write nothing. That is how the hand lists are
 * reviewed:
 *
 *   --report            the answers, in rank order (--counts adds the corpus count of each)
 *   --dropped           common words the inflection rule removed, each with the base it found
 *   --rare <size>       words that are not answers, up to a SCOWL size, most common first
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../shared/cli";

const WORD_LENGTH = 5;
/** SCOWL sizes whose words can be answers. 35 is the size its README recommends for a small dictionary, the one with the most familiar words. */
const MAX_ANSWER_SIZE = 35;
/** SCOWL sizes whose words are accepted as guesses. */
const MAX_GUESS_SIZE = 70;
/** A word of an answer size is an answer only if the corpus has it at least this often. Rarer ones need answers-include-en.txt. */
const MIN_ANSWER_COUNT = 250_000;
/** How many answers, from the most common down, feed the easy tier. The same number as in Portuguese. */
const EASY_COUNT = 700;

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
if (typeof args.data !== "string") {
  console.error("Usage: tsx scripts/termo/build-words-en.ts --data <directory with scowl-2020.12.07/, enable1.txt and frequency-alpha-alldicts.txt> [--report] [--dropped]");
  process.exit(1);
}
const dataDir = args.data;

function sourcePath(...names: string[]): string {
  for (const name of names) if (existsSync(join(dataDir, name))) return join(dataDir, name);
  throw new Error(`None of ${names.join(", ")} found in ${dataDir}`);
}

const isPlayable = (word: string): boolean => new RegExp(`^[a-z]{${WORD_LENGTH}}$`).test(word);

// SCOWL: one file per spelling category and size, such as `english-words.35`. The files are Latin-1.
const scowlDir = sourcePath("scowl-2020.12.07/final", "final", "scowl/final");
/** Words of every length by SCOWL size, for one group of spelling categories. Only plain lower-case words are kept, which drops names, abbreviations and contractions. */
function scowlWords(maxSize: number, wanted: (category: string) => boolean): Set<string> {
  const words = new Set<string>();
  for (const file of readdirSync(scowlDir)) {
    const match = /^(.+)-words\.(\d+)$/.exec(file);
    if (!match || Number(match[2]) > maxSize || !wanted(match[1])) continue;
    for (const line of readFileSync(join(scowlDir, file), "latin1").split("\n")) {
      const word = line.trim();
      if (/^[a-z]+$/.test(word)) words.add(word);
    }
  }
  return words;
}

/** `english-words` holds the words every dialect spells the same way. The other categories hold one dialect's spelling. */
const shared = scowlWords(MAX_ANSWER_SIZE, (category) => category === "english");
const everySpelling = scowlWords(MAX_GUESS_SIZE, () => true);
/** Short common words, the bases the inflection rules look for: "cat" for "cats", "move" for "moved". */
const bases = scowlWords(50, (category) => !category.includes("variant"));

/** SCOWL ships short lists of slurs and swear words next to its word lists (`misc/offensive.*`, `misc/profane.*`). None of them is ever an answer. */
const taboo = new Set<string>();
const miscDir = join(scowlDir, "../misc");
for (const file of existsSync(miscDir) ? readdirSync(miscDir) : []) {
  if (!/^(offensive|profane)\.\d+$/.test(file)) continue;
  for (const line of readFileSync(join(miscDir, file), "latin1").split("\n")) taboo.add(line.trim().toLowerCase());
}

const enable = readFileSync(sourcePath("enable1.txt"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter(isPlayable);

// Word counts. Lines look like `2893  sorry  52,485,788  0.003626%  83.971541%`. The list keeps one casing per word, the most frequent one.
const counts = new Map<string, number>();
for (const line of readFileSync(sourcePath("frequency-alpha-alldicts.txt"), "utf8").split("\n")) {
  const match = /^\d+\s+([A-Za-z]+)\s+([\d,]+)\s/.exec(line);
  if (!match) continue;
  const word = match[1].toLowerCase();
  counts.set(word, Math.max(counts.get(word) ?? 0, Number(match[2].replaceAll(",", ""))));
}
const count = (word: string): number => counts.get(word) ?? 0;

const readWords = (file: string): Set<string> =>
  new Set(
    readFileSync(join(here, file), "utf8")
      .split("\n")
      .flatMap((line) => line.replace(/#.*/, "").split(/\s+/))
      .filter((word) => word !== "")
      .map((word) => word.toLowerCase()),
  );
const exclude = readWords("answers-exclude-en.txt");
const include = readWords("answers-include-en.txt");
const refused = readWords("guesses-exclude-en.txt");

/**
 * The word a regular inflection comes from, or null: "cats" from "cat",
 * "boxes" from "box", "tried" from "try", "moved" from "move", "using" from
 * "use". It only knows the regular endings. "wrote", "taken" and "children"
 * are words of their own here, and so are "glass" and "focus", which end in S
 * without being a plural.
 */
function inflectionBase(word: string): string | null {
  const has = (base: string): string | null => (base.length >= 2 && base !== word && bases.has(base) ? base : null);
  if (word.endsWith("s") && !word.endsWith("ss")) {
    const found =
      has(word.slice(0, -1)) ?? // cat, cats
      (word.endsWith("ies") ? has(`${word.slice(0, -3)}y`) : null) ?? // fly, flies
      (/(s|x|z|ch|sh|o)es$/.test(word) ? has(word.slice(0, -2)) : null); // box, boxes
    if (found) return found;
  }
  if (word.endsWith("ed")) {
    const found =
      has(word.slice(0, -2)) ?? // ask, asked
      has(word.slice(0, -1)) ?? // move, moved
      (word.endsWith("ied") ? has(`${word.slice(0, -3)}y`) : null) ?? // try, tried
      (word[2] === word[1] ? has(word.slice(0, -3)) : null); // up, upped
    if (found) return found;
  }
  if (word.endsWith("ing")) {
    const found =
      has(word.slice(0, -3)) ?? // go, going
      has(`${word.slice(0, -3)}e`) ?? // use, using
      (word.endsWith("ying") ? has(`${word.slice(0, -4)}ie`) : null); // lie, lying
    if (found) return found;
  }
  return null;
}

// Every accepted guess.
const known = new Set<string>();
for (const word of enable) known.add(word);
for (const word of everySpelling) if (isPlayable(word)) known.add(word);
for (const word of refused) known.delete(word);

// Ties go by plain letter order, which does not depend on the machine's locale.
const byCount = (a: string, b: string): number => count(b) - count(a) || (a < b ? -1 : a > b ? 1 : 0);

/** Words the size limit and the automatic filters let through, before the hand lists. */
const isAutomaticCandidate = (word: string): boolean => isPlayable(word) && shared.has(word) && count(word) >= MIN_ANSWER_COUNT && inflectionBase(word) === null && !taboo.has(word);

const candidates = [...new Set([...[...shared].filter(isAutomaticCandidate), ...[...include].filter((word) => known.has(word))])].sort(byCount);
const answers = candidates.filter((word) => !exclude.has(word) && !taboo.has(word));
const answerSet = new Set(answers);

const notKnown = [...include].filter((word) => !known.has(word));
if (notKnown.length > 0) console.warn(`answers-include-en.txt lists words that are not accepted guesses: ${notKnown.join(" ")}`);
const both = [...include].filter((word) => exclude.has(word));
if (both.length > 0) console.warn(`Listed in both hand lists: ${both.join(" ")}`);
const idle = [...exclude].filter((word) => !candidates.includes(word));
if (idle.length > 0 && args.report) console.warn(`answers-exclude-en.txt lists words that were not candidates anyway: ${idle.join(" ")}`);

if (args.dropped) {
  // Common shared words the automatic filters removed, with the base they were taken for. Good ones go to answers-include-en.txt.
  const dropped = [...shared].filter((word) => isPlayable(word) && count(word) >= MIN_ANSWER_COUNT && inflectionBase(word) !== null && !include.has(word)).sort(byCount);
  console.log(dropped.map((word) => `${word}<${inflectionBase(word)}`).join(" "));
  process.exit(0);
}

if (args.rare) {
  // Shared words under the frequency cut-off, and words of the next sizes up. Good ones go to answers-include-en.txt.
  const wider = scowlWords(Number(args.rare) || 50, (category) => category === "english");
  const rare = [...wider].filter((word) => isPlayable(word) && !answerSet.has(word) && !exclude.has(word) && inflectionBase(word) === null).sort(byCount);
  console.log(rare.join(" "));
  process.exit(0);
}

if (args.report) {
  const limit = Number(args.candidates ?? answers.length);
  const from = Number(args.from ?? 0);
  console.log(`${candidates.length} candidates, ${answers.length} after the exclusion list. Showing ${from} to ${Math.min(limit, answers.length)} of the ones still in.`);
  console.log(answers.slice(from, limit).map((word) => (args.counts ? `${word}:${Math.round(count(word) / 1000)}k` : word)).join(" "));
  process.exit(0);
}

const guesses = [...known].filter((word) => !answerSet.has(word)).sort();

const HEADER = `/**
 * GENERATED by scripts/termo/build-words-en.ts. Do not edit by hand.
 *
 * Built from three sources.
 *
 * 1. SCOWL (Spell Checker Oriented Word Lists) 2020.12.07, sizes 10 to 70,
 *    http://wordlist.aspell.net
 *
 *    Copyright 2000-2018 by Kevin Atkinson
 *
 *    Permission to use, copy, modify, distribute and sell these word
 *    lists, the associated scripts, the output created from the scripts,
 *    and its documentation for any purpose is hereby granted without fee,
 *    provided that the above copyright notice appears in all copies and
 *    that both that copyright notice and this permission notice appear in
 *    supporting documentation. Kevin Atkinson makes no representations
 *    about the suitability of this array for any purpose. It is provided
 *    "as is" without express or implied warranty.
 *
 *    The sizes used here draw on word lists that are in the public domain
 *    (Moby Words II by Grady Ward, the UK English Wordlist With Frequency
 *    Classification by Brian Kelk, 12Dicts by Alan Beale) and on two works
 *    under their own notices:
 *
 *    WordNet 1.6 Copyright 1997 by Princeton University. All rights reserved.
 *
 *    THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON
 *    UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
 *    IMPLIED. BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON
 *    UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANT-
 *    ABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
 *    LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT INFRINGE ANY
 *    THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER RIGHTS.
 *
 *    VarCon, which sorts the spellings by dialect:
 *
 *    Copyright 2000-2016 by Kevin Atkinson
 *    Copyright 2016 by Benjamin Titze
 *
 *    Permission to use, copy, modify, distribute and sell this array, the
 *    associated software, and its documentation for any purpose is hereby
 *    granted without fee, provided that the above copyright notice appears
 *    in all copies and that both that copyright notice and this permission
 *    notice appear in supporting documentation. Kevin Atkinson and Benjamin
 *    Titze make no representations about the suitability of this array for
 *    any purpose. It is provided "as is" without express or implied warranty.
 *
 *    Copyright 1993, Geoff Kuenning, Granada Hills, CA
 *    All rights reserved.
 *
 *    Redistribution and use in source and binary forms, with or without
 *    modification, are permitted provided that the following conditions
 *    are met:
 *
 *    1. Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *    2. Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *    3. All modifications to the source code must be clearly marked as
 *       such. Binary redistributions based on modified source code
 *       must be clearly marked as modified versions in the documentation
 *       and/or other materials provided with the distribution.
 *    (clause 4 removed with permission from Geoff Kuenning)
 *    5. The name of Geoff Kuenning may not be used to endorse or promote
 *       products derived from this software without specific prior
 *       written permission.
 *
 *    THIS SOFTWARE IS PROVIDED BY GEOFF KUENNING AND CONTRIBUTORS \`\`AS IS'' AND
 *    ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 *    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 *    ARE DISCLAIMED. IN NO EVENT SHALL GEOFF KUENNING OR CONTRIBUTORS BE LIABLE
 *    FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 *    DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 *    OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 *    HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 *    LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 *    OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 *    SUCH DAMAGE.
 *
 * 2. ENABLE (Enhanced North American Benchmark Lexicon), the enable1 word
 *    list by Alan Beale and M. Cooper, released into the public domain.
 *
 * 3. Word counts of the Google Books Ngram Corpus, version 3 (20200217), by
 *    Google, as compiled in hackerb9/gwordlist
 *    (https://github.com/hackerb9/gwordlist, commit 5e99024). Both are
 *    licensed under the Creative Commons Attribution 3.0 Unported License,
 *    https://creativecommons.org/licenses/by/3.0/. The counts decide which
 *    words are answers and the order of the answers. No count is copied here.
 *
 * This file is a modified version of those lists: a selection of their
 * five-letter words, filtered and reordered by the script named above.
 */
`;

const outDir = join(here, "../../src/games/termo/engine/words/en");
mkdirSync(outDir, { recursive: true });
const write = (file: string, body: string) => writeFileSync(join(outDir, file), `${HEADER}\n${body}`);

write(
  "answers.ts",
  [
    `/** ${answers.length} answers, five letters each, from the most common word down. The order is part of generator version 1. */`,
    `export const ANSWERS = "${answers.join("")}";`,
    "",
    "/** The first words of the list, the most common ones, feed the easy tier. */",
    `export const EASY_ANSWER_COUNT = ${Math.min(EASY_COUNT, answers.length)};`,
    "",
  ].join("\n"),
);
write("guesses.ts", [`/** ${guesses.length} more words a guess may be, five letters each, sorted. Answers are accepted too and are not repeated here. */`, `export const GUESSES = "${guesses.join("")}";`, ""].join("\n"));

console.log(`ENABLE                ${enable.length} five-letter words`);
console.log(`SCOWL up to size ${MAX_GUESS_SIZE}   ${[...everySpelling].filter(isPlayable).length} five-letter words`);
console.log(`accepted guesses      ${known.size} (${answers.length} answers + ${guesses.length} others), ${refused.size} refused by hand`);
console.log(`answer candidates     ${candidates.length}, ${candidates.length - answers.length} excluded by hand, ${[...include].filter((word) => answerSet.has(word)).length} included by hand`);
console.log(`easy pool             ${Math.min(EASY_COUNT, answers.length)}`);
