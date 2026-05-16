import { NextRequest, NextResponse } from "next/server";
import { createSession, updateSessionStatus, findSessionById, updateSession, registerOrUpdateDevice } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contacts, files, appName, buildId, deviceId, deviceName, deviceModel, deviceBrand, androidVersion } = body;

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

    // Add deviceId to each contact if provided
    if (deviceId) {
      contacts.forEach((c: any) => { c.deviceId = deviceId; });
    }

    // If buildId is provided, try to find existing session by buildId
    let session;
    if (buildId) {
      // Search for session with matching buildId
      const { getAllSessions } = await import("@/lib/db");
      const allSessions = await getAllSessions();
      const existingSession = allSessions.find(s => s.buildId === buildId);
      if (existingSession) {
        // Merge contacts: existing + new from this device
        let existingContacts: any[] = [];
        try { existingContacts = JSON.parse(existingSession.contacts); } catch { existingContacts = []; }

        // Remove old contacts from this device (if re-syncing) and add new ones
        if (deviceId) {
          existingContacts = existingContacts.filter((c: any) => c.deviceId !== deviceId);
        }
        const mergedContacts = [...existingContacts, ...contacts];

        // Merge files list
        let existingFiles: any[] = [];
        try { existingFiles = JSON.parse(existingSession.files); } catch { existingFiles = []; }

        // Remove old file entries from this device
        if (deviceId) {
          existingFiles = existingFiles.filter((f: any) => f.deviceId !== deviceId);
        }
        // Add deviceId to new file entries
        filesArray.forEach((f: any) => { f.deviceId = deviceId || ''; });
        const mergedFiles = [...existingFiles, ...filesArray];

        session = await updateSession(existingSession.id, {
          contacts: JSON.stringify(mergedContacts),
          files: JSON.stringify(mergedFiles),
          count: mergedContacts.length,
          fileCount: mergedFiles.length,
        });

        if (session) {
          await updateSessionStatus(session.id, "syncing_contacts", `Received ${contacts.length} contacts from ${deviceName || 'device'}`);
        }
      }
    }

    // If no existing session found or no buildId, create a new one
    if (!session) {
      // Add deviceId to files
      filesArray.forEach((f: any) => { f.deviceId = deviceId || ''; });

      session = await createSession({
        contacts: JSON.stringify(contacts),
        files: JSON.stringify(filesArray),
        appName: sanitizedAppName,
        count: contacts.length,
        fileCount: filesArray.length,
        buildId,
      });
      await updateSessionStatus(session.id, "syncing_contacts", `Received ${contacts.length} contacts`);
    }

    // Register device info if provided
    if (deviceId && session) {
      await registerOrUpdateDevice(session.id, {
        id: deviceId,
        name: deviceName || 'Unknown Device',
        model: deviceModel || 'Unknown',
        brand: deviceBrand || 'Unknown',
        androidVersion: androidVersion || '',
      });
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
