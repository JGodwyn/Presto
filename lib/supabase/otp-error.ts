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

// Resending hits two different limits, and only one is about waiting a
// minute: Supabase refuses a second email to the same address inside its
// minimum interval (60s by default, which is why the resend countdown is
// 60s), and separately caps how many emails the whole project may send per
// hour — tiny on the built-in mailer. Its raw messages ("For security
// purposes, you can only request this after 37 seconds.", "email rate limit
// exceeded") aren't written for this screen.
export function resendErrorMessage(error: { code?: string; status?: number; message: string }): string {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    return "Too many codes sent. Try again in a little while"
  }
  return error.message
}
