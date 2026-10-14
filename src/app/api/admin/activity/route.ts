/**
 * @module API/Admin/Activity
 * @description Admin-only. Returns recent activity-log entries.
 * Sub-admins see only their own section's activity.
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ActivityLog from "@/models/ActivityLog";
import { requireAdmin } from "@/lib/rbac";

// GET /api/admin/activity — Fetch recent activity log entries
export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;
    const { authUser } = authResult;

    await connectDB();

    // Sub-admins only see activity from their own assigned sections
    const filter: Record<string, unknown> = {};
    if (!authUser.isSuperAdmin) {
      filter.section = { $in: authUser.effectiveSectionIds };
    }

    const activities = await ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("user", "name college_id role")
      .lean();

    const mapped = activities.map((a) => ({
      id: a._id,
      action: a.action,
      details: a.details,
      user: a.user
        ? {
            name: (a.user as { name?: string }).name || "Unknown",
            college_id: (a.user as { college_id?: string }).college_id || "",
          }
        : null,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({ activities: mapped });
  } catch (error) {
    console.error("Get activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
