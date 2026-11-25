"use client";

import { useEffect, useRef } from "react";
import { LOCALE_META } from "@/i18n/config";
import type { StatusMessage } from "@/shared/ui/status-line";
import type { Coach, CoachMood } from "../../engine/coach";
import type { CoachEntry } from "../../hooks/use-chess-game";
import { CoachAvatar } from "./coach-avatar";

type Props = {
  /** The coach in the game language. Her name, role and fixed labels come from here. */
  coach: Coach;
  messages: readonly CoachEntry[];
  /** The latest thing that happened, for screen readers and tests. It may be a line that is not in the chat, such as an illegal move. */
  status: StatusMessage;
  /** The coach is working something out, or the opponent is about to move. */
  thinking: boolean;
  /** A wrong move is waiting on the board. */
  awaitingTakeBack: boolean;
};

/**
 * The coach's side of the conversation. It takes the place of the status line:
 * under the board on a phone, where only the latest line shows, and beside the
 * board on a wide screen, where the whole exchange stays in view.
 *
 * The panel is in the game language, which may differ from the page around it,
 * so it carries its own `lang`. A line said before the player changed the game
 * language keeps the `lang` it was said in.
 */
export function CoachPanel({ coach, messages, status, thinking, awaitingTakeBack }: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const { text } = coach;
  const lang = LOCALE_META[coach.language].htmlLang;
  const label = `${text.name}, ${text.role.toLowerCase()}`;
  const latest = messages[messages.length - 1];
  const mood: CoachMood = thinking ? "thinking" : (latest?.mood ?? "calm");
  // An illegal move is said once, in place of the chat's last line, and never stored in the chat.
  const aside = status.kind === "invalid" && status.text !== latest?.text ? status.text : null;

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, thinking, aside]);

  return (
    <aside className="chess-coach" lang={lang} aria-label={label} data-testid="chess-coach">
      <div className="chess-coach-who">
        <CoachAvatar mood={mood} label={label} className="chess-coach-avatar" />
        <div className="chess-coach-name">
          <strong>{text.name}</strong>
          <span data-testid="chess-coach-role">{text.role}</span>
        </div>
      </div>
      <div ref={logRef} className="chess-coach-log" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((message) => (
          <p key={message.id} className="chess-bubble" data-mood={message.mood} lang={message.lang === lang ? undefined : message.lang}>
            {message.text}
          </p>
        ))}
        {aside && (
          <p className="chess-bubble" data-mood="worried" data-aside="true">
            {aside}
          </p>
        )}
        {thinking && (
          <p className="chess-bubble chess-typing" aria-label={text.thinking}>
            <span />
            <span />
            <span />
          </p>
        )}
        {awaitingTakeBack && !thinking && <p className="chess-coach-note">{text.takeBack}</p>}
      </div>
      {/* The one line tests and assistive tools read as the game's status, like the status line of the other games. */}
      <p className="sr-only" data-testid="game-status" data-kind={status.kind}>
        {status.text}
      </p>
    </aside>
  );
}
