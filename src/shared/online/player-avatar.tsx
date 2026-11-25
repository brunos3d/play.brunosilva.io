"use client";

import { createAvatar } from "@dicebear/core";
import * as thumbs from "@dicebear/thumbs";
import { useMemo } from "react";

/**
 * A player's picture, drawn on the device from the avatar seed. The seed is
 * all the server stores: no image is uploaded or fetched.
 *
 * The drawings are DiceBear's "Thumbs" style (https://www.dicebear.com),
 * design under CC0 1.0, code under MIT.
 */
const cache = new Map<string, string>();

export function avatarDataUri(seed: string): string {
  let uri = cache.get(seed);
  if (!uri) {
    uri = createAvatar(thumbs, { seed, radius: 50 }).toDataUri();
    cache.set(seed, uri);
  }
  return uri;
}

export function PlayerAvatar({ seed, size = 36, className }: { seed: string; size?: number; className?: string }) {
  const uri = useMemo(() => avatarDataUri(seed), [seed]);
  // A data URI: next/image has nothing to optimize, and the picture is decorative next to the player's name.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={uri} alt="" width={size} height={size} className={`rounded-full flex-none bg-[var(--linen-deep)] ${className ?? ""}`} draggable={false} />;
}
