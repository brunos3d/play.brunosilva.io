/**
 * What a browser's push service hands a device, for the tests that subscribe
 * one. The keys are public halves of two throwaway P-256 pairs: the server
 * checks that a key is a point of the curve, so a made-up string will not do.
 */
export const PUSH_KEYS = { p256dh: "BIH8lUeLwAnzK-kWk-mxhVIFHftyDCIQCo1OToY7HBzSpPsK9SvwM5kRcjSAtYP3sWqAyQ3cmqfMJkk3LHPoqF0", auth: "a".repeat(22) };
/** The keys of another device: valid, and not the ones above. */
export const OTHER_PUSH_KEYS = { p256dh: "BOZNnPW2Orq1HDIRD9o4QaRdoMYVGSKn2BWZ7Uo03SPDP6Yl4WZScjTA3UETV4XRwCnLlS1xVEqKIuULlbaWLek", auth: "b".repeat(22) };

/** An endpoint shaped like Chrome's, unique to the caller. */
export const pushEndpoint = (): string => `https://fcm.googleapis.com/fcm/send/${Math.random().toString(36).slice(2, 14)}:APA91b${"x".repeat(40)}`;
