/**
 * @module API/Streams
 * @description Stream management.
 * - GET  → lists all streams with populated subjects.
 * - POST → creates a new stream (super admin only).
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Stream from "@/models/Stream";
import Subject from "@/models/Subject";
import { requireSuperAdmin } from "@/lib/rbac";

// GET /api/streams - List all streams with populated subjects
export async function GET() {
  try {
    await connectDB();
    void Subject; // Ensure Subject model is registered for populate
    const streams = await Stream.find().populate("subjects").sort({ name: 1 }).lean();
    return NextResponse.json({ streams });
  } catch (error) {
    console.error("List streams error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/streams - Create a new stream (super admin only)
export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const body = await request.json();
    const { name, subjects } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Stream name is required" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check for duplicate
    const existing = await Stream.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A stream with this name already exists" },
        { status: 409 }
      );
    }

    // Validate subjects if provided
    if (subjects && Array.isArray(subjects) && subjects.length > 0) {
      const validSubjectCount = await Subject.countDocuments({
        _id: { $in: subjects },
      });
      if (validSubjectCount !== subjects.length) {
        return NextResponse.json(
          { error: "One or more selected subjects do not exist" },
          { status: 400 }
        );
      }
    }

    const stream = await Stream.create({
      name: name.trim(),
      subjects: subjects || [],
    });

    const populated = await Stream.findById(stream._id).populate("subjects");

    return NextResponse.json({ stream: populated }, { status: 201 });
  } catch (error) {
    console.error("Create stream error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
