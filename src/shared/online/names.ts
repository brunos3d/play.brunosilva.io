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
  const animals = ANIMALS[locale] ?? ANIMALS.en;
  return `${animals[Math.floor(random() * animals.length)]} ${Math.floor(random() * 900) + 100}`;
}

/** A name as it will be stored: one line, trimmed, bounded. Null when nothing readable is left. */
export function cleanPlayerName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input
    .normalize("NFC")
    // Control characters, zero-width characters and bidirectional marks: they can hide or reorder text in someone else's table.
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const clipped = [...name].slice(0, NAME_MAX_LENGTH).join("").trim();
  return clipped.length > 0 ? clipped : null;
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
