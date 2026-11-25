import Link from "next/link";
import "./globals.css";
import "@/shared/ui/theme.css";

/**
 * Only reached by a path the proxy does not treat as a page, such as a file
 * that does not exist. Every page path is redirected into a locale first, and
 * a missing page there gets [locale]/not-found.tsx, in the visitor's language.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body>
        <div className="mg-root">
          <main className="mg-shell" style={{ justifyContent: "center", textAlign: "center" }}>
            <h1 className="text-2xl font-semibold">Not found</h1>
            {/* No locale here: the proxy picks the visitor's on the way to the hub. */}
            <Link href="/" prefetch={false} className="mg-button">
              See all games
            </Link>
          </main>
        </div>
      </body>
    </html>
  );
}
