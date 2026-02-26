import twilio from "twilio";
import { env } from "@/lib/env";

function normalizeCandidateUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function buildCandidateUrls(url: string): string[] {
  const normalized = normalizeCandidateUrl(url);
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>([normalized, `${normalized}/`]);

  if (normalized.includes("://www.")) {
    const withoutWww = normalized.replace("://www.", "://");
    candidates.add(withoutWww);
    candidates.add(`${withoutWww}/`);
  } else {
    const withWww = normalized.replace("://", "://www.");
    candidates.add(withWww);
    candidates.add(`${withWww}/`);
  }

  return [...candidates];
}

export function validateTwilioSignature(
  signature: string | null,
  url: string | string[],
  params: Record<string, string>,
): boolean {
  if (!env.twilioAuthToken) {
    return false;
  }

  if (!signature) {
    return false;
  }

  const urls = Array.isArray(url) ? url : [url];
  const candidates = urls.flatMap(buildCandidateUrls);

  return candidates.some((candidateUrl) =>
    twilio.validateRequest(env.twilioAuthToken, signature, candidateUrl, params),
  );
}

export function twimlMessage(message: string): string {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);
  return twiml.toString();
}
