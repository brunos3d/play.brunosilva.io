import type { ReactNode } from "react";

/**
 * Every page lives under a locale, and the document itself (<html>, fonts,
 * theme) is built there, in [locale]/layout.tsx, where the language is known.
 * This layout only exists because Next.js needs one at the root.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
