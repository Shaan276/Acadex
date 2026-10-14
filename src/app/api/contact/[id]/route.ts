/**
 * @module API/Contact/[id]
 * @description Admin-only. Deletes a contact message by ID.
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";

import { requireAdmin } from "@/lib/rbac";

// DELETE - remove a contact message
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    await connectDB();
    await ContactMessage.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
