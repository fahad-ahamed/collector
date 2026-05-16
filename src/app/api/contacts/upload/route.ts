import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contacts, files, appName } = body;

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json(
        { error: "contacts array is required" },
        { status: 400 }
      );
    }

    const filesArray = Array.isArray(files) ? files : [];

    const session = await prisma.contactSession.create({
      data: {
        contacts: JSON.stringify(contacts),
        files: JSON.stringify(filesArray),
        appName: appName || "Contact Collector",
        count: contacts.length,
        fileCount: filesArray.length,
      },
    });

    return NextResponse.json({
      id: session.id,
      contactCount: session.count,
      fileCount: session.fileCount,
      viewUrl: `/view/${session.id}`,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to store data" },
      { status: 500 }
    );
  }
}
