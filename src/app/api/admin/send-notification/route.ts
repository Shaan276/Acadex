/**
 * @module API/Admin/SendNotification
 * @description Admin-only. Sends a notification (title + body)
 * to an individual user.
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { adminMessagePayload } from "@/lib/push/payloads";
import { sendPushToUsers } from "@/lib/push/send";
import { resolveUserIdsForAudience } from "@/lib/push/targets";

type AudienceType = "all" | "semester" | "section" | "users";

import mongoose from "mongoose";
import User from "@/models/User";
import { requireAdmin, canAdminManageSection } from "@/lib/rbac";

// POST /api/admin/send-notification — Send notification to individual user
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;
    const { authUser } = authResult;

    const body = await request.json();
    const {
      userId,
      userIds,
      targetType,
      semester,
      sectionId,
      title,
      message,
    } = body as {
      userId?: string;
      userIds?: string[];
      targetType?: AudienceType;
      semester?: number;
      sectionId?: string;
      title?: string;
      message?: string;
    };

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "title and message are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const audience: AudienceType =
      targetType || (Array.isArray(userIds) ? "users" : userId ? "users" : "all");

    let targetUserIds: string[] = [];
    if (audience === "all") {
      // Sub-admins broadcasting to "all" only broadcasts to their assigned section(s)
      if (!authUser.isSuperAdmin) {
        if (authUser.effectiveSectionIds.length === 0) {
          return NextResponse.json(
            { error: "You have no assigned sections to notify." },
            { status: 403 }
          );
        }
        const sectionUsers = await User.find({
          role: "student",
          status: "active",
          section: { $in: authUser.effectiveSectionIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
        }).select("_id").lean();
        targetUserIds = sectionUsers.map((u) => u._id.toString());
      } else {
        targetUserIds = await resolveUserIdsForAudience({ targetType: "all" });
      }
    } else if (audience === "semester") {
      if (!semester || Number.isNaN(Number(semester))) {
        return NextResponse.json({ error: "semester is required" }, { status: 400 });
      }
      
      // Only super admin can broadcast to an entire semester across all sections
      if (!authUser.isSuperAdmin) {
        return NextResponse.json(
          { error: "Only super-admins can broadcast to an entire semester." },
          { status: 403 }
        );
      }

      targetUserIds = await resolveUserIdsForAudience({
        targetType: "semester",
        semester: Number(semester),
      });
    } else if (audience === "section") {
      if (!sectionId) {
        return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
      }

      // Sub-admins can only broadcast to sections they are assigned to
      if (!canAdminManageSection(authUser, sectionId)) {
        return NextResponse.json(
          { error: "You can only broadcast to your assigned section(s)." },
          { status: 403 }
        );
      }

      targetUserIds = await resolveUserIdsForAudience({
        targetType: "section",
        sectionId,
      });
    } else {
      let normalized = Array.isArray(userIds)
        ? userIds
        : userId
          ? [userId]
          : [];

      // Sub-admins can only send direct messages to students in their assigned sections
      if (!authUser.isSuperAdmin) {
        const allowedUsers = await User.find({
          _id: { $in: normalized },
          section: { $in: authUser.effectiveSectionIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
        }).select("_id").lean();
        normalized = allowedUsers.map((u) => u._id.toString());
      }

      targetUserIds = await resolveUserIdsForAudience({
        targetType: "users",
        userIds: normalized,
      });
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "No eligible users found" }, { status: 404 });
    }

    await Notification.create({
      type: "admin_message",
      title: title.trim().slice(0, 200),
      message: message.trim().slice(0, 2000),
      link: "/user/dashboard/messages",
      targetUsers: targetUserIds,
    });

    await sendPushToUsers({
      userIds: targetUserIds,
      preferenceKey: "admin_message",
      payload: adminMessagePayload(title.trim().slice(0, 200), message.trim().slice(0, 2000)),
    });

    return NextResponse.json({ success: true, sentTo: targetUserIds.length });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
