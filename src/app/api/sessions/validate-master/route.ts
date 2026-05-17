import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MASTER_CODE = process.env.MASTER_CODE || "32423";

function getMasterCode(): string {
  const passwordDir = path.join(process.cwd(), "app session password");
  const masterCodeFile = path.join(passwordDir, "master_code.txt");
  try {
    if (fs.existsSync(masterCodeFile)) {
      return fs.readFileSync(masterCodeFile, "utf-8").trim();
    }
  } catch {}
  return MASTER_CODE;
}

// POST /api/sessions/validate-master - Validate master code
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { masterCode } = body;

    if (!masterCode) {
      return NextResponse.json({ error: "Master code required", valid: false }, { status: 400 });
    }

    if (masterCode === getMasterCode()) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ error: "Invalid master code", valid: false }, { status: 403 });
  } catch (error: unknown) {
    console.error("Validate master error:", error);
    return NextResponse.json({ error: "Validation failed", valid: false }, { status: 500 });
  }
}
