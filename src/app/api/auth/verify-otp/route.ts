/**
 * @module API/Auth/VerifyOTP
 * @description Authenticated. Verifies an OTP code for password_change
 * or email_change purposes.
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import OTP from "@/models/OTP";

export async function POST(request: Request) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, purpose } = await request.json();

    if (!code || !purpose) {
      return NextResponse.json(
        { error: "OTP code and purpose are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const otpRecord = await OTP.findOne({
      user: userId,
      purpose,
      verified: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "No OTP found. Please request a new one." },
        { status: 404 }
      );
    }

    // Check expiry
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 410 }
      );
    }

    // H-06: Brute-force protection — reject if too many failed attempts
    const MAX_ATTEMPTS = 5;
    if ((otpRecord.failedAttempts ?? 0) >= MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new OTP." },
        { status: 429 }
      );
    }

    // Verify code
    if (otpRecord.code !== code.toString().trim()) {
      // Increment failed attempts counter
      await OTP.updateOne({ _id: otpRecord._id }, { $inc: { failedAttempts: 1 } });
      const attemptsLeft = MAX_ATTEMPTS - ((otpRecord.failedAttempts ?? 0) + 1);
      return NextResponse.json(
        { error: `Invalid OTP code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.` },
        { status: 400 }
      );
    }

    // Mark as verified
    otpRecord.verified = true;
    await otpRecord.save();

    return NextResponse.json({
      message: "OTP verified successfully",
      otpId: otpRecord._id,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
