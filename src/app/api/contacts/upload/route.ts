import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    // Validate contacts array size (prevent abuse)
    if (contacts.length > 50000) {
      return NextResponse.json(
        { error: "Too many contacts. Maximum 50,000." },
        { status: 400 }
      );
    }

    const filesArray = Array.isArray(files) ? files : [];

    // Validate files array size
    if (filesArray.length > 100000) {
      return NextResponse.json(
        { error: "Too many files. Maximum 100,000." },
        { status: 400 }
      );
    }

    const session = await db.contactSession.create({
      data: {
        contacts: JSON.stringify(contacts),
        files: JSON.stringify(filesArray),
        appName: appName || "Collector",
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
