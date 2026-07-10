// Supabase's verifyOtp() doesn't distinguish a wrong code from an expired
// one in its response — both return error_code "otp_expired" (confirmed
// empirically: a freshly-sent, incorrectly-typed code returns the same
// "otp_expired" as a genuinely stale one). So instead of trusting the
// server's error code, we approximate "expired" client-side from elapsed
// time since the code was sent.
//
// Must match Supabase Dashboard → Authentication → Sign In / Providers →
// Email → "Email OTP Expiration" for this project (currently 3600s / 1
// hour). Update this constant if that dashboard setting ever changes.
export const OTP_EXPIRY_MS = 3600 * 1000

export function otpErrorMessage(sentAt: number): string {
  return Date.now() - sentAt >= OTP_EXPIRY_MS
    ? "This OTP has expired"
    : "This code is incorrect"
}
