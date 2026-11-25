import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Links and router that keep the active locale: `href="/zip"` leads to
 * /pt-br/zip on a Portuguese page. Import these in place of next/link and
 * next/navigation for every route of the site.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
