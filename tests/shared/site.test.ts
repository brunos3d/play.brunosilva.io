import { describe, expect, it } from "vitest";
import { SITE_ORIGIN, resolveHostRedirect } from "@/shared/platform/site";

describe("shortcut domains", () => {
  it("opens each game on the canonical address", () => {
    expect(resolveHostRedirect("zip.brunosilva.io", "/")).toBe("https://play.brunosilva.io/zip");
    expect(resolveHostRedirect("patches.brunosilva.io", "/")).toBe("https://play.brunosilva.io/patches");
  });

  it("leaves the canonical address, previews and localhost alone", () => {
    for (const host of ["play.brunosilva.io", "localhost:3000", "zip-git-main.vercel.app", "brunosilva.io", "evilzip.brunosilva.io.example.com", "", null, undefined]) {
      expect(resolveHostRedirect(host, "/"), String(host)).toBeNull();
    }
  });

  it("maps game-relative paths into the game and keeps the query string", () => {
    expect(resolveHostRedirect("zip.brunosilva.io", "/practice")).toBe(`${SITE_ORIGIN}/zip/practice`);
    expect(resolveHostRedirect("zip.brunosilva.io", "/play", "?seed=ZIP%3Alucky%3A1%3Ahard%3A8")).toBe(`${SITE_ORIGIN}/zip/play?seed=ZIP%3Alucky%3A1%3Ahard%3A8`);
    expect(resolveHostRedirect("patches.brunosilva.io", "/play/", "?seed=7")).toBe(`${SITE_ORIGIN}/patches/play?seed=7`);
  });

  it("keeps paths that are already complete, including old Zip links", () => {
    expect(resolveHostRedirect("zip.brunosilva.io", "/hard/42")).toBe(`${SITE_ORIGIN}/hard/42`);
    expect(resolveHostRedirect("zip.brunosilva.io", "/zip/practice")).toBe(`${SITE_ORIGIN}/zip/practice`);
    expect(resolveHostRedirect("zip.brunosilva.io", "/patches")).toBe(`${SITE_ORIGIN}/patches`);
    expect(resolveHostRedirect("patches.brunosilva.io", "/zip")).toBe(`${SITE_ORIGIN}/zip`);
  });

  it("ignores case, ports and a trailing dot in the host", () => {
    expect(resolveHostRedirect("ZIP.BrunoSilva.io:443", "/")).toBe(`${SITE_ORIGIN}/zip`);
    expect(resolveHostRedirect("patches.brunosilva.io.", "/")).toBe(`${SITE_ORIGIN}/patches`);
  });

  it("can only ever redirect to this site", () => {
    for (const path of ["//evil.example", "/\\evil.example", "/https://evil.example", "/play"]) {
      expect(new URL(resolveHostRedirect("zip.brunosilva.io", path)!).origin, path).toBe(SITE_ORIGIN);
    }
  });
});
