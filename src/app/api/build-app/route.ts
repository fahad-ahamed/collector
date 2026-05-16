import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import fs from "fs";

const ANDROID_HOME = "/home/z/android-sdk";
const BUILD_TOOLS = join(ANDROID_HOME, "build-tools/34.0.0");
const PLATFORM_JAR = join(ANDROID_HOME, "platforms/android-34/android.jar");
const JAVAC = "/tmp/jdk-21.0.11/bin/javac";
const APP_TEMPLATE = "/home/z/my-project/android-app";

export async function POST(req: NextRequest) {
  let buildDir = "";

  try {
    const formData = await req.formData();
    const appName = formData.get("appName") as string;
    const logoFile = formData.get("logo") as File | null;

    if (!appName || !appName.trim()) {
      return NextResponse.json({ error: "App name is required" }, { status: 400 });
    }

    // Validate app name length
    if (appName.trim().length > 30) {
      return NextResponse.json({ error: "App name must be 30 characters or less" }, { status: 400 });
    }

    // Sanitize app name to prevent command injection
    const sanitizedAppName = appName.trim().replace(/[^a-zA-Z0-9\s\-_.]/g, "");
    if (sanitizedAppName !== appName.trim()) {
      return NextResponse.json(
        { error: "App name contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores." },
        { status: 400 }
      );
    }

    const buildId = randomUUID();
    buildDir = join(tmpdir(), `apk-build-${buildId}`);

    // Step 1: Copy template
    execSync(`cp -r "${APP_TEMPLATE}/app" "${buildDir}"`);

    // Create build directories
    const dirs = [
      join(buildDir, "build"),
      join(buildDir, "build/apk"),
      join(buildDir, "build/gen"),
      join(buildDir, "build/obj"),
      join(buildDir, "build/dex"),
    ];
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Step 2: Get the website base URL from request origin
    let websiteBaseUrl = req.headers.get("origin") || "";
    if (!websiteBaseUrl) {
      const host = req.headers.get("host");
      if (host) {
        const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
        websiteBaseUrl = `${protocol}://${host}`;
      }
    }
    if (!websiteBaseUrl) {
      websiteBaseUrl = "https://your-app.vercel.app";
    }

    // Step 3: Update app name in strings.xml
    const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(sanitizedAppName)}</string>
</resources>`;
    fs.writeFileSync(join(buildDir, "src/main/res/values/strings.xml"), stringsXml);

    // Step 4: Update AndroidManifest with app name reference
    const manifestPath = join(buildDir, "src/main/AndroidManifest.xml");
    let manifest = fs.readFileSync(manifestPath, "utf-8");
    manifest = manifest.replace(
      /android:label="[^"]*"/,
      `android:label="@string/app_name"`
    );
    fs.writeFileSync(manifestPath, manifest);

    // Step 5: Update layout with app name
    const layoutPath = join(buildDir, "src/main/res/layout/activity_main.xml");
    let layout = fs.readFileSync(layoutPath, "utf-8");
    layout = layout.replace(
      />Contact Collector</g,
      `>${escapeXml(sanitizedAppName)}<`
    );
    layout = layout.replace(
      />Collector</g,
      `>${escapeXml(sanitizedAppName)}<`
    );
    fs.writeFileSync(layoutPath, layout);

    // Step 6: Replace WEBSITE_BASE_URL in MainActivity.java with actual deployed URL
    const mainActivityPath = join(buildDir, "src/main/java/com/contactcollector/app/MainActivity.java");
    if (fs.existsSync(mainActivityPath)) {
      let mainActivitySrc = fs.readFileSync(mainActivityPath, "utf-8");
      mainActivitySrc = mainActivitySrc.replace(
        /private static final String WEBSITE_BASE_URL = "[^"]*";/,
        `private static final String WEBSITE_BASE_URL = "${websiteBaseUrl}";`
      );
      fs.writeFileSync(mainActivityPath, mainActivitySrc);
    }

    // Step 7: Handle logo if provided - copy as mipmap icon
    if (logoFile) {
      try {
        const logoBuffer = Buffer.from(await logoFile.arrayBuffer());

        // Validate logo size (max 2MB)
        if (logoBuffer.length > 2 * 1024 * 1024) {
          cleanupBuildDir(buildDir);
          return NextResponse.json(
            { error: "Logo file is too large. Maximum size is 2MB." },
            { status: 400 }
          );
        }

        // Copy logo as mipmap icons (use the same PNG for all densities)
        const mipmapDirs = [
          "mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi",
          "mipmap-xxhdpi", "mipmap-xxxhdpi"
        ];
        for (const dir of mipmapDirs) {
          const mipmapDir = join(buildDir, "src/main/res", dir);
          if (!fs.existsSync(mipmapDir)) {
            fs.mkdirSync(mipmapDir, { recursive: true });
          }
          fs.writeFileSync(join(mipmapDir, "ic_launcher.png"), logoBuffer);
        }

        // Update manifest to use the default icon (not adaptive)
        manifest = fs.readFileSync(manifestPath, "utf-8");
        manifest = manifest.replace(
          /android:roundIcon="[^"]*"/,
          `android:roundIcon="@mipmap/ic_launcher"`
        );
        fs.writeFileSync(manifestPath, manifest);
      } catch (logoErr: unknown) {
        const msg = logoErr instanceof Error ? logoErr.message : "Unknown logo error";
        console.error("Logo processing error:", msg);
        // Continue without logo if it fails
      }
    }

    // Step 8: Compile resources
    execSync(
      `"${BUILD_TOOLS}/aapt2" compile --dir "${buildDir}/src/main/res" -o "${buildDir}/build/compiled_resources.zip"`,
      { stdio: "pipe" }
    );

    // Step 9: Link resources
    execSync(
      `"${BUILD_TOOLS}/aapt2" link --java "${buildDir}/build/gen" --manifest "${buildDir}/src/main/AndroidManifest.xml" -I "${PLATFORM_JAR}" --auto-add-overlay -o "${buildDir}/build/apk/base.apk" "${buildDir}/build/compiled_resources.zip"`,
      { stdio: "pipe" }
    );

    // Step 10: Compile Java
    const sourcesFile = join(buildDir, "build/sources.txt");
    let sourcePaths = "";
    const genDir = join(buildDir, "build/gen");
    const javaDir = join(buildDir, "src/main/java");

    function findJavaFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) findJavaFiles(fullPath);
        else if (entry.name.endsWith(".java")) sourcePaths += fullPath + "\n";
      }
    }
    findJavaFiles(genDir);
    findJavaFiles(javaDir);
    fs.writeFileSync(sourcesFile, sourcePaths.trim());

    execSync(
      `"${JAVAC}" -source 11 -target 11 -classpath "${PLATFORM_JAR}" -sourcepath "${genDir}":"${javaDir}" -d "${buildDir}/build/obj" @"${sourcesFile}"`,
      { stdio: "pipe" }
    );

    // Step 11: Convert to DEX (exclude all R.class and R$*.class)
    const objDir = join(buildDir, "build/obj/com/contactcollector/app");
    const classFiles = fs.readdirSync(objDir).filter(f =>
      f.endsWith(".class") && f !== "R.class" && !f.startsWith("R$")
    );

    const classFilePaths = classFiles.map(f => `"${join(objDir, f)}"`).join(" ");

    execSync(
      `"${BUILD_TOOLS}/d8" --lib "${PLATFORM_JAR}" --output "${buildDir}/build/dex/" ${classFilePaths}`,
      { stdio: "pipe" }
    );

    // Step 12: Add DEX to APK
    execSync(`cp "${buildDir}/build/apk/base.apk" "${buildDir}/build/apk/app-unsigned.apk"`, { stdio: "pipe" });
    execSync(`cd "${buildDir}/build/apk" && zip -j app-unsigned.apk "${buildDir}/build/dex/classes.dex"`, { stdio: "pipe" });

    // Step 13: Align
    execSync(
      `"${BUILD_TOOLS}/zipalign" -f 4 "${buildDir}/build/apk/app-unsigned.apk" "${buildDir}/build/apk/app-aligned.apk"`,
      { stdio: "pipe" }
    );

    // Step 14: Sign with debug key
    const keystorePath = join(APP_TEMPLATE, "build/keystore/debug.keystore");
    execSync(
      `"${BUILD_TOOLS}/apksigner" sign --ks "${keystorePath}" --ks-key-alias debugkey --ks-pass pass:android --key-pass pass:android --out "${buildDir}/build/apk/app-signed.apk" "${buildDir}/build/apk/app-aligned.apk"`,
      { stdio: "pipe" }
    );

    // Step 15: Read the final APK
    const apkPath = join(buildDir, "build/apk/app-signed.apk");
    const apkBuffer = fs.readFileSync(apkPath);

    // Step 16: Cleanup build directory
    cleanupBuildDir(buildDir);

    // Return APK file
    const safeName = sanitizedAppName.replace(/\s+/g, "-").toLowerCase();
    return new NextResponse(apkBuffer, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${safeName}.apk"`,
        "Content-Length": apkBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Build error:", message);
    if (buildDir) cleanupBuildDir(buildDir);
    return NextResponse.json(
      { error: "Failed to build APK", details: message },
      { status: 500 }
    );
  }
}

function cleanupBuildDir(buildDir: string) {
  try {
    execSync(`rm -rf "${buildDir}"`, { stdio: "pipe" });
  } catch {
    // Ignore cleanup errors
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
