import { expect, test } from "@playwright/test";

/**
 * Drives the real proxy in the production server. The public host reaches the
 * app in x-forwarded-host, as it does behind Vercel's edge.
 */
const from = (host: string) => ({ headers: { "x-forwarded-host": host }, maxRedirects: 0 });

test("zip.brunosilva.io and patches.brunosilva.io open their game on play.brunosilva.io", async ({ request }) => {
  const zip = await request.get("/", from("zip.brunosilva.io"));
  expect(zip.status()).toBe(308);
  expect(zip.headers().location).toBe("https://play.brunosilva.io/zip");

  const patches = await request.get("/", from("patches.brunosilva.io"));
  expect(patches.status()).toBe(308);
  expect(patches.headers().location).toBe("https://play.brunosilva.io/patches");
});

test("deep links and old Zip links survive the move", async ({ request }) => {
  const seeded = await request.get("/play?seed=ZIP%3Alucky%3A1%3Ahard%3A8", from("zip.brunosilva.io"));
  expect(seeded.headers().location).toBe("https://play.brunosilva.io/zip/play?seed=ZIP%3Alucky%3A1%3Ahard%3A8");

  const legacy = await request.get("/hard/42", from("zip.brunosilva.io"));
  expect(legacy.headers().location).toBe("https://play.brunosilva.io/hard/42");

  const worker = await request.get("/sw.js", from("patches.brunosilva.io"));
  expect(worker.status()).toBe(308);
});

test("the canonical address and unknown hosts are served normally", async ({ request }) => {
  for (const host of ["play.brunosilva.io", "preview-abc.vercel.app"]) {
    const response = await request.get("/", from(host));
    expect(response.status(), host).toBe(200);
  }
  const plain = await request.get("/zip", { maxRedirects: 0 });
  expect(plain.status()).toBe(200);
});
