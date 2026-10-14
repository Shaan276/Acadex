/**
 * @module API/Sections
 * @description Section management.
 * - GET  → lists sections (public/student/superadmin sees all; sub-admin sees only assigned sections).
 * - POST → creates a new section (super admin only).
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Section from "@/models/Section";
import { getAuthUser, requireSuperAdmin } from "@/lib/rbac";

// GET /api/sections — list sections
// Public/Students/Superadmins get all sections. Sub-admins get only their assigned sections.
export async function GET(request: Request) {
  try {
    await connectDB();

    const userRole = request.headers.get("x-user-role");
    const isSuperAdmin = request.headers.get("x-user-is-super-admin") === "true";

    // Sub-admin section scoping
    if (userRole === "admin" && !isSuperAdmin) {
      const authUser = await getAuthUser(request);
      if (authUser && authUser.effectiveSectionIds.length > 0) {
        const sections = await Section.find({
          _id: { $in: authUser.effectiveSectionIds },
        })
          .sort({ name: 1 })
          .lean();
        return NextResponse.json({ sections });
      }
      return NextResponse.json({ sections: [] });
    }

    const sections = await Section.find().sort({ name: 1 }).lean();
    return NextResponse.json({ sections });
  } catch (error) {
    console.error("List sections error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/sections — create section (super admin only)
export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Section name is required" },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: "Section name too long (max 50 characters)" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check for duplicate
    const existing = await Section.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A section with this name already exists" },
        { status: 409 }
      );
    }

    const section = await Section.create({ name: name.trim() });

    return NextResponse.json(
      { success: true, section },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create section error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
