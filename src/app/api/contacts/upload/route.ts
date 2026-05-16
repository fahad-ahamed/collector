import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contacts } = body;

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json(
        { error: "contacts array is required" },
        { status: 400 }
      );
    }

    // Store contacts as JSON
    const session = await prisma.contactSession.create({
      data: {
        contacts: JSON.stringify(contacts),
        count: contacts.length,
      },
    });

    return NextResponse.json({
      id: session.id,
      count: session.count,
      viewUrl: `/view/${session.id}`,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to store contacts" },
      { status: 500 }
    );
  }
}
