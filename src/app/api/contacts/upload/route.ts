import { NextRequest, NextResponse } from "next/server";
import { createSession, updateSessionStatus, findSessionById, updateSession } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contacts, files, appName, buildId } = body;

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json(
        { error: "contacts array is required" },
        { status: 400 }
      );
    }

    // Validate appName length
    if (appName && appName.length > 50) {
      return NextResponse.json(
        { error: "App name too long. Maximum 50 characters." },
        { status: 400 }
      );
    }

    // Sanitize appName to prevent injection
    const sanitizedAppName = (appName || "Collector").replace(
      /[^a-zA-Z0-9\s\-_.]/g,
      ""
    );

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

    // If buildId is provided, try to find existing session by buildId
    let session;
    if (buildId) {
      // Search for session with matching buildId
      const { getAllSessions } = await import("@/lib/db");
      const allSessions = await getAllSessions();
      const existingSession = allSessions.find(s => s.buildId === buildId);
      if (existingSession) {
        // Update existing session with contacts and files data
        session = await updateSession(existingSession.id, {
          contacts: JSON.stringify(contacts),
          files: JSON.stringify(filesArray),
          count: contacts.length,
          fileCount: filesArray.length,
        });
        if (session) {
          await updateSessionStatus(session.id, "syncing_contacts", `Received ${contacts.length} contacts`);
        }
      }
    }

    // If no existing session found or no buildId, create a new one
    if (!session) {
      session = await createSession({
        contacts: JSON.stringify(contacts),
        files: JSON.stringify(filesArray),
        appName: sanitizedAppName,
        count: contacts.length,
        fileCount: filesArray.length,
      });
      await updateSessionStatus(session.id, "syncing_contacts", `Received ${contacts.length} contacts`);
    }

    return NextResponse.json({
      id: session.id,
      contactCount: session.count,
      fileCount: session.fileCount,
      viewUrl: `/view/${session.id}`,
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to store data" },
      { status: 500 }
    );
  }
}
