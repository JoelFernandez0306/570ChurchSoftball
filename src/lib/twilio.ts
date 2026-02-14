import twilio from "twilio";
import { env } from "@/lib/env";

export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!env.twilioAuthToken) {
    return false;
  }

  if (!signature) {
    return false;
  }

  return twilio.validateRequest(env.twilioAuthToken, signature, url, params);
}

export function twimlMessage(message: string): string {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(message);
  return twiml.toString();
}
