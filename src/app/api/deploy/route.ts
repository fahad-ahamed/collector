import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import crypto from "crypto";

// Deploy endpoint - allows self-updating from GitHub
// Protected by a deploy token

const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN || "collector-deploy-2026";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, action } = body;

    // Validate deploy token
    if (token !== DEPLOY_TOKEN) {
      return NextResponse.json({ error: "Invalid deploy token" }, { status: 403 });
    }

    if (action === "deploy") {
      // Pull latest code from GitHub
      const pullOutput = execSync("cd /home/fahad/collector-final && git pull origin main 2>&1", {
        encoding: "utf-8",
        timeout: 60000,
      });

      // Rebuild Next.js
      const buildOutput = execSync("cd /home/fahad/collector-final && npm run build 2>&1", {
        encoding: "utf-8",
        timeout: 120000,
      });

      // Restart PM2
      const restartOutput = execSync("pm2 restart all 2>&1", {
        encoding: "utf-8",
        timeout: 30000,
      });

      return NextResponse.json({
        success: true,
        pull: pullOutput.slice(-200),
        build: buildOutput.slice(-200),
        restart: restartOutput.slice(-200),
      });
    }

    if (action === "status") {
      const gitLog = execSync("cd /home/fahad/collector-final && git log --oneline -3 2>&1", {
        encoding: "utf-8",
        timeout: 10000,
      });
      const pm2Status = execSync("pm2 list 2>&1", {
        encoding: "utf-8",
        timeout: 10000,
      });
      return NextResponse.json({
        gitLog,
        pm2Status: pm2Status.slice(-300),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
