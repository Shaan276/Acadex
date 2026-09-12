/**
 * @module API/Admin/ResetPassword
 * @description Admin-only. Resets a specific user's password
 * to a temporary value (validated with Zod `resetPasswordSchema`).
 */
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { connectDB } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validations";
import User from "@/models/User";
import ActivityLog from "@/models/ActivityLog";

// POST /api/admin/reset-password - Reset a user's password
export async function POST(request: Request) {
  try {
    const userRole = request.headers.get("x-user-role");
    const adminId = request.headers.get("x-user-id");
    const isSuperAdmin = request.headers.get("x-is-super-admin") === "true";
    const adminSection = request.headers.get("x-user-section");

    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { userId } = parsed.data;

    await connectDB();

    const user = await User.findById(userId).select("name college_id role section isSuperAdmin");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // C-03: Prevent sub-admins from resetting super-admin passwords
    if (!isSuperAdmin && user.isSuperAdmin) {
      return NextResponse.json(
        { error: "You cannot reset a super-admin's password." },
        { status: 403 }
      );
    }

    // C-03: Prevent sub-admins from resetting users in other sections
    if (!isSuperAdmin && adminSection && user.section?.toString() !== adminSection) {
      return NextResponse.json(
        { error: "You can only reset passwords for users in your own section." },
        { status: 403 }
      );
    }

    // L-02: Use cryptographically secure random bytes instead of Math.random()
    const tempPassword = "T" + randomBytes(5).toString("hex").toUpperCase();

    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await User.findByIdAndUpdate(userId, {
      password_hash: passwordHash,
      must_change_password: true,
    });

    // Log activity
    await ActivityLog.create({
      user: adminId!,
      action: "PASSWORD_RESET",
      details: `Reset password for: ${user.name} (${user.college_id})`,
      section: user.section || null,
    });

    return NextResponse.json({
      success: true,
      tempPassword,
      message: `Temporary password generated for ${user.name}. They will be required to change it on next login.`,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
