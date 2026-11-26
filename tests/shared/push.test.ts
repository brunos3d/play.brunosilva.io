import { describe, expect, it } from "vitest";
import { ENDPOINT_MAX_LENGTH, REMINDER_MIN_HOURS_LEFT, hoursLeftToday, isAuthSecret, isPushEndpoint, isReminderHour, isTimeZone, localHour, parseSubscription, reminderTtlSeconds } from "@/shared/online/push";

const KEYS = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
const FCM = "https://fcm.googleapis.com/fcm/send/abc123:APA91b-token_part";

describe("the endpoint of a push subscription", () => {
  it("is a URL at a browser vendor's push service", () => {
    // The second is what Chrome Beta, Dev and Canary subscribe at.
    for (const endpoint of [FCM, "https://jmt17.google.com/fcm/send/abc123:APA91b-token_part", "https://updates.push.services.mozilla.com/wpush/v2/gAAAA", "https://wns2-by3p.notify.windows.com/w/?token=AwYAAAD", "https://web.push.apple.com/QGpP3"]) {
      expect(isPushEndpoint(endpoint), endpoint).toBe(true);
    }
  });

  it("is nothing else: the server sends requests to it", () => {
    const refused = [
      "http://fcm.googleapis.com/fcm/send/abc", // not https
      "https://fcm.googleapis.com:8443/fcm/send/abc", // another port
      "https://user:pass@fcm.googleapis.com/fcm/send/abc", // credentials in the URL
      "https://fcm.googleapis.com.evil.example/fcm/send/abc", // a look-alike host
      "https://evil.example/?https://fcm.googleapis.com/", // the name in the wrong place
      "https://evilfcm.googleapis.com/fcm/send/abc",
      "https://jmt17.google.com.evil.example/fcm/send/abc",
      "https://169.254.169.254/latest/meta-data/", // a cloud metadata address
      "https://localhost/internal",
      "https://10.0.0.1/",
      "https://[::1]/",
      "file:///etc/passwd",
      "javascript:alert(1)",
      `https://fcm.googleapis.com/${"a".repeat(ENDPOINT_MAX_LENGTH)}`,
      "",
      "not a url",
      42,
      null,
      undefined,
      { href: FCM },
    ];
    for (const endpoint of refused) expect(isPushEndpoint(endpoint), String(endpoint).slice(0, 60)).toBe(false);
  });
});

describe("a subscription as a client sends it", () => {
  const body = { subscription: { endpoint: FCM, keys: KEYS }, locale: "pt-br", timezone: "America/Sao_Paulo" };

  it("is taken when every piece is what it should be", () => {
    expect(parseSubscription(body)).toEqual({ endpoint: FCM, ...KEYS, locale: "pt-br", timezone: "America/Sao_Paulo" });
  });

  it("is refused otherwise", () => {
    const broken: Record<string, unknown>[] = [
      {},
      { ...body, subscription: null },
      { ...body, subscription: "x" },
      { ...body, subscription: { endpoint: "https://evil.example/", keys: KEYS } },
      { ...body, subscription: { endpoint: FCM } },
      { ...body, subscription: { endpoint: FCM, keys: { ...KEYS, p256dh: "short" } } },
      { ...body, subscription: { endpoint: FCM, keys: { ...KEYS, p256dh: `${"B".repeat(86)}'` } } },
      { ...body, subscription: { endpoint: FCM, keys: { ...KEYS, auth: "has spaces in it !!!!!!" } } },
      { ...body, subscription: { endpoint: FCM, keys: { ...KEYS, auth: 7 } } },
      { ...body, locale: "fr" },
      { ...body, locale: "en'; drop table players; --" },
      { ...body, timezone: "Mars/Olympus_Mons" },
      { ...body, timezone: "'; select pg_sleep(10); --" },
      { ...body, timezone: 3 },
    ];
    for (const input of broken) expect(parseSubscription(input), JSON.stringify(input).slice(0, 90)).toBeNull();
  });
});

describe("the secret of a subscription", () => {
  it("is 16 bytes of base64url, and nothing a database would choke on", () => {
    expect(isAuthSecret("a".repeat(22))).toBe(true);
    // 16 characters are 12 bytes: too few to encrypt a message with.
    for (const refused of ["", "short", "a".repeat(16), "a".repeat(21), "a".repeat(41), `${"a".repeat(21)}\u0000`, `${"a".repeat(21)}'`, 22, null, undefined]) expect(isAuthSecret(refused), String(refused)).toBe(false);
  });
});

describe("the hour of a reminder", () => {
  it("is read in the device's own time zone", () => {
    const now = new Date("2026-11-26T22:30:00Z");
    expect(localHour("UTC", now)).toBe(22);
    expect(localHour("America/Sao_Paulo", now)).toBe(19);
    expect(localHour("Asia/Tokyo", now)).toBe(7);
    // Midnight is hour 0, not 24.
    expect(localHour("UTC", new Date("2026-11-26T00:10:00Z"))).toBe(0);
  });

  // 26 November 2026: Pacific time is UTC-8, so the day of the puzzles ends at 08:00 UTC.
  const utc = (day: number, hour: number, minute = 5) => new Date(Date.UTC(2026, 10, day, hour, minute));
  /** The local hours of one Pacific day (08:00 UTC on the 26th to 08:00 UTC on the 27th) at which a device there is due. */
  const dueHours = (zone: string): number[] => {
    const hours: number[] = [];
    for (let step = 0; step < 24; step++) {
      const now = utc(26, 8 + step);
      if (isReminderHour(zone, now)) hours.push(localHour(zone, now));
    }
    return hours;
  };

  it("counts the hours left in the day of the puzzles", () => {
    expect(hoursLeftToday(utc(26, 8, 0))).toBe(24);
    expect(hoursLeftToday(utc(26, 22))).toBe(10);
    expect(hoursLeftToday(utc(27, 7, 59))).toBe(1);
  });

  it("is early evening where the evening comes before the deadline", () => {
    // Sao Paulo: the day ends at 05:00 there. Lisbon: at 08:00. Los Angeles and New York: at midnight and 03:00.
    expect(dueHours("America/Sao_Paulo")).toEqual([19, 20, 21]);
    expect(dueHours("Europe/Lisbon")).toEqual([19, 20, 21]);
    expect(dueHours("America/New_York")).toEqual([19, 20, 21]);
    expect(dueHours("America/Los_Angeles")).toEqual([19, 20, 21]);
    // The same instant is the hour in one place and not in another.
    expect(isReminderHour("America/Sao_Paulo", new Date("2026-11-26T22:30:00Z"))).toBe(true);
    expect(isReminderHour("Asia/Tokyo", new Date("2026-11-26T22:30:00Z"))).toBe(false);
  });

  it("is earlier in the day where the evening would be too late", () => {
    // Tokyo: the day ends at 17:00 there, so 19:00 is two hours into the next one. Sydney: at 19:00. Auckland: at 21:00.
    expect(dueHours("Asia/Tokyo")).toEqual([12, 13, 14, 15, 16]);
    expect(dueHours("Australia/Sydney")).toEqual([14, 15, 16, 17, 18]);
    expect(dueHours("Pacific/Auckland")).toEqual([16, 17, 18, 19, 20]);
    expect(dueHours("Pacific/Pago_Pago")).toEqual([16, 17, 18, 19, 20]);
    // Dubai: the day ends at noon, and nobody is woken up for it. India is half an hour off the grid.
    expect(dueHours("Asia/Dubai")).toEqual([9, 10, 11]);
    // The day ends at 13:30 there, and these runs fall at 35 past the hour.
    expect(dueHours("Asia/Kolkata")).toEqual([9, 10, 11, 12]);
  });

  it("finds an hour for every time zone, never at night and never in the first hours of a day", () => {
    const zones = ["UTC", ...Array.from({ length: 12 }, (_, index) => `Etc/GMT+${index + 1}`), ...Array.from({ length: 14 }, (_, index) => `Etc/GMT-${index + 1}`), "Asia/Kolkata", "Asia/Kathmandu", "Australia/Adelaide"];
    for (const zone of zones) {
      const hours = dueHours(zone);
      expect(hours.length, zone).toBeGreaterThan(0);
      for (const hour of hours) expect(hour >= 9 && hour <= 21, `${zone} at ${hour}`).toBe(true);
    }
    // The run at the very start of a Pacific day, and the seven after it, remind nobody anywhere: whoever is marked as
    // reminded for a day cannot come up again in it, and nobody is told their streak is ending with a whole day ahead.
    for (let step = 0; step < 8; step++) for (const zone of zones) expect(isReminderHour(zone, utc(26, 8 + step, 0)), `${zone} +${step}h`).toBe(false);
    // The first hour a device is due leaves the time promised, except where the only civil hour is closer than that.
    for (const zone of ["America/Sao_Paulo", "Europe/Lisbon", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland", "Asia/Dubai"]) {
      const first = Array.from({ length: 24 }, (_, step) => utc(26, 8 + step)).find((now) => isReminderHour(zone, now));
      expect(first && hoursLeftToday(first), zone).toBeGreaterThanOrEqual(REMINDER_MIN_HOURS_LEFT);
    }
  });

  it("lets a push service hold a reminder until the day ends or the night begins, whichever is first, and four hours at most", () => {
    // 22:05 UTC: 14:05 Pacific and 19:05 in Sao Paulo. Night there is 2 h 55 min away, the deadline almost ten hours.
    expect(reminderTtlSeconds("America/Sao_Paulo", utc(26, 22))).toBe(2 * 3600 + 55 * 60);
    // 03:05 UTC: 19:05 Pacific, 12:05 in Tokyo. Nothing is closer than the four hours.
    expect(reminderTtlSeconds("Asia/Tokyo", utc(27, 3))).toBe(4 * 3600);
    // 07:05 UTC: 23:05 Pacific, 16:05 in Tokyo. The day ends in 55 minutes, and the message with it.
    expect(reminderTtlSeconds("Asia/Tokyo", utc(27, 7))).toBe(55 * 60);
    // On the stroke of the last minute there is still a minute.
    expect(reminderTtlSeconds("Asia/Tokyo", new Date(Date.UTC(2026, 10, 27, 7, 59, 30)))).toBe(60);
  });

  it("only knows real time zones", () => {
    for (const zone of ["UTC", "America/Sao_Paulo", "Europe/Lisbon", "Etc/GMT+3"]) expect(isTimeZone(zone), zone).toBe(true);
    for (const zone of ["Mars/Olympus_Mons", "", "x".repeat(80), 5, null, "America/Sao_Paulo'; --"]) expect(isTimeZone(zone), String(zone)).toBe(false);
  });
});
