/**
 * Sharing: Web Share API first, clipboard second, legacy textarea copy last.
 * The caller gets back which path worked so the UI can word its confirmation.
 */

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export type SharePayload = {
  title?: string;
  text: string;
  url?: string;
};

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(area);
  return copied;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or insecure context. Fall through to the legacy path.
  }
  return legacyCopy(text);
}

export async function share(payload: SharePayload): Promise<ShareOutcome> {
  const combined = payload.url ? `${payload.text}\n${payload.url}` : payload.text;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const data: ShareData = { title: payload.title, text: payload.text, url: payload.url };
    const allowed = typeof navigator.canShare !== "function" || navigator.canShare(data);
    if (allowed) {
      try {
        await navigator.share(data);
        return "shared";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
        // Any other failure falls back to the clipboard.
      }
    }
  }

  return (await copyText(combined)) ? "copied" : "failed";
}
