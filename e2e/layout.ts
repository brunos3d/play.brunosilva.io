import type { Page } from "@playwright/test";

/**
 * Phone widths every screen has to fit: 320 px is the narrowest phone still in
 * use, 360 px is the most common Android width, and 412 px is a large phone.
 */
export const PHONE_WIDTHS = [320, 360, 412] as const;
export const PHONE_HEIGHT = 780;

/**
 * Looks at the page the way a thumb and an eye do, and returns what is wrong
 * with it at the current width. An empty list means the screen fits.
 *
 * It checks that nothing scrolls or sticks out sideways, that no button,
 * tab, chip or title breaks into two lines, that no text is cut off (by an
 * ellipsis or by its box), that placeholders and selects show their whole text, and
 * that every control is at least 24 px in both directions (WCAG 2.5.8).
 *
 * With a dialog open it looks at the dialog only: the page under it is inert.
 */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const viewport = document.documentElement.clientWidth;
    const scope: Element = document.querySelector("dialog[open]") ?? document.body;

    const describe = (element: Element): string => {
      const id = element.getAttribute("data-testid");
      const name = `${element.tagName.toLowerCase()}${id ? `[${id}]` : element.classList.length > 0 ? `.${[...element.classList].filter((item) => item.startsWith("mg-"))[0] ?? element.classList[0]}` : ""}`;
      const text = ((element as HTMLInputElement).placeholder || (element as HTMLInputElement).value || element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim();
      return `${name} "${text.slice(0, 48)}"`;
    };

    const shown = (element: Element): boolean => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      // The debug panels only exist in `next dev`.
      if (element.closest(".sr-only, nextjs-portal, [hidden], [data-testid$='-debug']")) return false;
      const style = getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none";
    };

    /** Lines of text inside an element, counted from where its words actually sit. */
    const lines = (element: Element): number => {
      const middles: number[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || node.parentElement?.closest(".sr-only")) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width < 1) continue;
          const middle = rect.top + rect.height / 2;
          if (!middles.some((known) => Math.abs(known - middle) < rect.height * 0.6)) middles.push(middle);
        }
      }
      return middles.length;
    };

    const canvas = document.createElement("canvas").getContext("2d");
    const textWidth = (text: string, style: CSSStyleDeclaration): number => {
      if (!canvas) return 0;
      canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const spacing = Number.parseFloat(style.letterSpacing) || 0;
      const shownText = style.textTransform === "uppercase" ? text.toUpperCase() : style.textTransform === "capitalize" ? text.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : text;
      return canvas.measureText(shownText).width + spacing * text.length;
    };
    const innerWidth = (element: Element, style: CSSStyleDeclaration): number => element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);

    if (document.documentElement.scrollWidth > viewport + 1) problems.push(`the page scrolls sideways: ${document.documentElement.scrollWidth} px of content in ${viewport} px`);

    // A box that holds content. Nothing inside one may stick out of it.
    const BOXES = ".mg-card, .mg-row, .mg-dialog, .mg-menu, .mg-toast, .mg-race, .mg-button, .mg-segment, .mg-stat, .mg-status, .mg-shell, .mg-controls";
    // What has to stay on one line: a control or a title that breaks in two reads as a layout mistake.
    const ONE_LINE = ".mg-button, .mg-segment button, .mg-chip, .mg-tag, .mg-menu-item, .mg-race-quit, .mg-toast button, .mg-header nav a, .mg-header h1, .mg-stat dt, [data-one-line]";

    const outside = new Set<Element>();
    for (const element of scope.querySelectorAll("*")) {
      if (!shown(element)) continue;
      // The inside of a board is the game's own business, and it is clipped by the board.
      if (element.closest("svg") && element.tagName.toLowerCase() !== "svg") continue;
      const board = element.closest(".mg-board");
      if (board && board !== element) continue;

      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const parentOutside = element.parentElement !== null && outside.has(element.parentElement);

      if (rect.left < -1 || rect.right > viewport + 1) {
        outside.add(element);
        if (!parentOutside) problems.push(`off the screen: ${describe(element)} spans ${Math.round(rect.left)} to ${Math.round(rect.right)} px`);
      } else {
        const box = element.parentElement?.closest(BOXES);
        if (box) {
          const frame = box.getBoundingClientRect();
          if (rect.left < frame.left - 1 || rect.right > frame.right + 1) {
            outside.add(element);
            if (!parentOutside) problems.push(`sticks out of its box: ${describe(element)} in ${describe(box).split(" ")[0]}, by ${Math.round(Math.max(frame.left - rect.left, rect.right - frame.right))} px`);
          }
        } else if (parentOutside) outside.add(element);
      }

      if (element.matches(ONE_LINE) && lines(element) > 1) problems.push(`breaks into ${lines(element)} lines: ${describe(element)}`);

      const tag = element.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") {
        const input = element as HTMLInputElement;
        if (input.type !== "range" && input.type !== "checkbox" && input.type !== "radio") {
          // What a field shows before it is touched: its placeholder, or the value of a field that cannot be edited. A value being typed scrolls with the caret.
          const text = input.readOnly ? input.value : input.placeholder;
          const needed = textWidth(text, style);
          const room = innerWidth(input, style);
          if (needed > room + 1) problems.push(`${input.readOnly ? "value" : "placeholder"} cut off: ${describe(element)} "${text}" needs ${Math.round(needed)} px, has ${Math.round(room)}`);
        }
      } else if (tag === "select") {
        const select = element as HTMLSelectElement;
        // Every option is measured, not just the one picked: the box has to fit whatever the player chooses.
        const needed = Math.max(...[...select.options].map((option) => textWidth(option.text, style)));
        const room = innerWidth(select, style);
        if (needed > room + 1) problems.push(`option cut off: ${describe(element)} needs ${Math.round(needed)} px, has ${Math.round(room)}`);
      } else {
        const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
        // Text wider than the element that holds it runs over whatever sits beside it: a title over the buttons of its header.
        const holder = element.parentElement;
        if (ownText && holder && !outside.has(element) && style.position !== "absolute" && style.position !== "fixed" && getComputedStyle(holder).display !== "contents") {
          const frame = holder.getBoundingClientRect();
          if (rect.right > frame.right + 1.5 || rect.left < frame.left - 1.5) problems.push(`runs over what is beside it: ${describe(element)}, by ${Math.round(Math.max(frame.left - rect.left, rect.right - frame.right))} px`);
        }
        if (ownText && style.display !== "inline" && element.scrollWidth > element.clientWidth + 1) problems.push(`${style.overflowX === "visible" ? "text runs out of its box" : "text cut off"}: ${describe(element)} needs ${element.scrollWidth} px, has ${element.clientWidth}`);
        if (ownText && style.overflowY !== "visible" && style.overflowY !== "auto" && style.overflowY !== "scroll" && element.scrollHeight > element.clientHeight + 2) problems.push(`text clipped at the bottom: ${describe(element)} needs ${element.scrollHeight} px, has ${element.clientHeight}`);
      }

      if (element.matches("a[href], button, select, input, [role='switch']") && style.display !== "inline" && !(element as HTMLButtonElement).disabled) {
        if (rect.width < 24 || rect.height < 24) problems.push(`too small to tap: ${describe(element)} is ${Math.round(rect.width)}×${Math.round(rect.height)} px`);
      }
    }
    return problems;
  });
}

/**
 * Runs the checks at every phone width and returns each problem with the width
 * it shows at. `onWidth` runs after the page has settled at each width, which
 * is where a caller takes a screenshot.
 */
export async function phoneProblems(page: Page, onWidth?: (width: number) => Promise<void>, widths: readonly number[] = PHONE_WIDTHS): Promise<string[]> {
  const problems: string[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: PHONE_HEIGHT });
    // Two frames: one for the layout, one for anything that measures itself after it.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const problem of await layoutProblems(page)) problems.push(`${width} px: ${problem}`);
    await onWidth?.(width);
  }
  return problems;
}
