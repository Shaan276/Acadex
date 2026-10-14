/**
 * @module API/Contact/[id]/Read
 * @description Admin-only. Marks a contact message as read.
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";

import { requireAdmin } from "@/lib/rbac";

// PATCH - mark message as read
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.response) return authResult.response;

    const { id } = await params;
    await connectDB();
    await ContactMessage.findByIdAndUpdate(id, { read: true });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
