/**
 * @module API/Streams/[id]
 * @description Single stream operations.
 * - PUT    → updates the stream's name/subjects (super admin only).
 * - DELETE → removes the stream (super admin only).
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Stream from "@/models/Stream";
import Subject from "@/models/Subject";
import User from "@/models/User";
import { requireSuperAdmin } from "@/lib/rbac";

// PUT /api/streams/[id] - Update a stream (super admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireSuperAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { id } = await params;
    const body = await request.json();
    const { name, subjects } = body;

    await connectDB();

    const stream = await Stream.findById(id);
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    // If renaming, check for duplicate
    if (name && name.trim() !== stream.name) {
      const existing = await Stream.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A stream with this name already exists" },
          { status: 409 }
        );
      }
      stream.name = name.trim();
    }

    if (subjects !== undefined) {
      if (Array.isArray(subjects) && subjects.length > 0) {
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
      stream.subjects = subjects;
    }

    await stream.save();

    void Subject; // Ensure Subject model is registered for populate
    const populated = await Stream.findById(id).populate("subjects");

    return NextResponse.json({ stream: populated });
  } catch (error) {
    console.error("Update stream error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/streams/[id] - Delete a stream (super admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireSuperAdmin(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { id } = await params;

    await connectDB();

    const stream = await Stream.findById(id);
    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }

    // Check if any students are assigned to this stream
    const studentCount = await User.countDocuments({ stream: id });
    if (studentCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete — ${studentCount} student${studentCount > 1 ? "s" : ""} are assigned to this stream. Reassign them first.`,
        },
        { status: 400 }
      );
    }

    await Stream.findByIdAndDelete(id);

    return NextResponse.json({ message: "Stream deleted successfully" });
  } catch (error) {
    console.error("Delete stream error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
