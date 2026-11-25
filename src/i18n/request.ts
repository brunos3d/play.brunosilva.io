import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "./config";
import { loadMessages } from "./messages";
import { routing } from "./routing";

/** What next-intl needs on the server: the locale of the request, from the URL segment, and its messages. */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : DEFAULT_LOCALE;
  return { locale, messages: await loadMessages(locale) };
});
