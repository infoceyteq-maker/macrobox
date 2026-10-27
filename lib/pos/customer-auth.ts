import { z } from "zod";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL_IDENTIFIER = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keep only the leading plus and digits, so UI formatting never affects login. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function isEmailIdentifier(value: string): boolean {
  return EMAIL_IDENTIFIER.test(value.trim());
}

export function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  return isEmailIdentifier(trimmed) ? trimmed.toLowerCase() : normalizePhone(trimmed);
}

export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export const customerRegistrationSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(160),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phone: z
    .string()
    .trim()
    .min(8, "Enter a phone number with country code.")
    .max(24)
    .transform(normalizePhone)
    .refine((value) => E164_PHONE.test(value), "Use international format, for example +94…"),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(72, "Password is too long.")
    .refine(
      (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
      "Use at least one letter and one number.",
    ),
});

export const customerSignInSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or phone number.").max(254),
  password: z.string().min(1, "Enter your password.").max(72),
});

export type CustomerRegistrationInput = z.infer<typeof customerRegistrationSchema>;
export type CustomerSignInInput = z.infer<typeof customerSignInSchema>;

export interface CustomerAuthSuccess {
  userId: string;
  email: string;
  phone: string | null;
}
