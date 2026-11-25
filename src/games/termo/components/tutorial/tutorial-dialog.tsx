"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { LEGACY_WORD_LANGUAGE } from "@/i18n/game-language";
import type { Settings } from "@/shared/storage/settings";
import { Dialog } from "@/shared/ui/dialog";
import { TERMO_EXAMPLES, type TermoExample } from "../../engine/config";
import { type TermoLanguage, WORD_LENGTH } from "../../engine/words";

type Props = {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  /** Language of the words being played. The example words follow it. The explanations follow the interface. */
  language: TermoLanguage;
};

function ExampleRow({ example }: { example: TermoExample }) {
  const t = useTranslations("termo.tutorial");
  const word = example.word.toUpperCase();
  const text = t(example.mark, { letter: word[example.at] });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="termo-example" role="img" aria-label={t("example", { word, text })}>
        {[...word].map((letter, index) => (
          <div key={index} className="termo-tile" data-mark={index === example.at ? example.mark : undefined} style={{ "--column": index } as CSSProperties}>
            {letter}
          </div>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{text}</p>
    </div>
  );
}

export function TermoTutorialDialog({ open, onClose, language }: Props) {
  const t = useTranslations("termo.tutorial");
  const common = useTranslations("common.tutorial");
  return (
    <Dialog open={open} onClose={onClose} title={t("title")} testId="game-tutorial">
      <div className="termo-stage flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{t("intro", { length: WORD_LENGTH })}</p>

        {TERMO_EXAMPLES[language].map((example) => (
          <ExampleRow key={example.word} example={example} />
        ))}

        <ul className="text-sm leading-relaxed text-[var(--ink-soft)] list-disc pl-5 flex flex-col gap-1">
          {/* Only Portuguese words carry accents. */}
          {language === LEGACY_WORD_LANGUAGE && <li>{t("accents")}</li>}
          <li>{t("repeats")}</li>
          <li>{t("keyboard")}</li>
          <li>{t("modes")}</li>
          <li>{t("controls")}</li>
        </ul>

        <button type="button" className="mg-button" data-variant="primary" onClick={onClose}>
          {common("start")}
        </button>
      </div>
    </Dialog>
  );
}
