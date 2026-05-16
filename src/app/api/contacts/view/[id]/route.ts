import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await prisma.contactSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const contacts = JSON.parse(session.contacts);

    return NextResponse.json({
      id: session.id,
      contacts,
      count: session.count,
      createdAt: session.createdAt,
    });
  } catch (error: any) {
    console.error("View error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve contacts" },
      { status: 500 }
    );
  }
}
