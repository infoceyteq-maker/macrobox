import { z } from "zod";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL_IDENTIFIER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fixed OTP used only by the sandboxed PGlite preview. Never sent in production. */
export const LOCAL_CUSTOMER_OTP = "123456";

/** Keep only the leading plus and digits, so UI formatting never affects login. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : `+${digits}`;
}

export function isEmailIdentifier(value: string): boolean {
  return EMAIL_IDENTIFIER.test(value.trim());
}

export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export const phoneOtpRequestSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(8, "Enter a phone number with country code.")
    .max(24)
    .transform(normalizePhone)
    .refine((value) => E164_PHONE.test(value), "Use international format, for example +94…"),
});

export const phoneOtpVerifySchema = z.object({
  phone: z
    .string()
    .trim()
    .min(8)
    .max(24)
    .transform(normalizePhone)
    .refine((value) => E164_PHONE.test(value), "Use international format, for example +94…"),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your SMS."),
});

/** Sri Lankan delivery cities offered by the lead-registration autocomplete. */
export const LEAD_CITIES = [
  "Colombo",
  "Kandy",
  "Galle",
  "Negombo",
  "Nugegoda",
  "Mount Lavinia",
  "Malabe",
  "Dehiwala",
] as const;

/**
 * Optional lead details collected on the registration screen before the OTP
 * is sent. Only the phone number is mandatory for identity: the name is
 * requested up front on /customer/register, while email and delivery city
 * stay optional and can be completed later in My Profile. The email is a
 * lead contact only — it is never treated as a verified sign-in email.
 */
const leadDetailsShape = {
  name: z.string().trim().max(160).default(""),
  email: z
    .string()
    .trim()
    .max(254)
    .default("")
    .refine(
      (value) => value === "" || EMAIL_IDENTIFIER.test(value),
      "Enter a valid email address.",
    )
    .transform((value) => value.toLowerCase()),
  location: z.string().trim().max(160).default(""),
};

export const leadOtpRequestSchema = z.object({
  phone: phoneOtpRequestSchema.shape.phone,
  ...leadDetailsShape,
});

export const leadOtpVerifySchema = z.object({
  phone: phoneOtpRequestSchema.shape.phone,
  token: phoneOtpVerifySchema.shape.token,
  ...leadDetailsShape,
});

export interface LeadProfileDetails {
  name?: string;
  email?: string;
  location?: string;
}

export const emailLinkSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
});

export const customerProfileSchema = z.object({
  name: z.string().trim().max(160).default(""),
  deliveryAddress: z.string().trim().max(2000).default(""),
  deliveryNotes: z.string().trim().max(2000).default(""),
});

export type PhoneOtpRequestInput = z.infer<typeof phoneOtpRequestSchema>;
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;
export type LeadOtpRequestInput = z.infer<typeof leadOtpRequestSchema>;
export type LeadOtpVerifyInput = z.infer<typeof leadOtpVerifySchema>;
export type EmailLinkInput = z.infer<typeof emailLinkSchema>;
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;

export interface CustomerAuthSuccess {
  userId: string;
  email: string;
  phone: string | null;
}

export interface CustomerOtpSendResult {
  phone: string;
  otpSent: boolean;
  /** Present only in local PGlite preview mode. */
  devOtp?: string;
}

/** Convert GoTrue's digits-only phone back to E.164 where possible. */
export function authPhoneToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (trimmed.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}
