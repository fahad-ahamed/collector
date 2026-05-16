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
  try {
    const formData = await req.formData();
    const appName = formData.get("appName") as string;
    const logoFile = formData.get("logo") as File | null;

    if (!appName || !appName.trim()) {
      return NextResponse.json({ error: "App name is required" }, { status: 400 });
    }

    const buildId = randomUUID();
    const buildDir = join(tmpdir(), `apk-build-${buildId}`);

    // Step 1: Copy template
    execSync(`cp -r ${APP_TEMPLATE}/app ${buildDir}`);

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

    // Step 2: Update app name in strings.xml
    const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(appName.trim())}</string>
</resources>`;
    fs.writeFileSync(join(buildDir, "src/main/res/values/strings.xml"), stringsXml);

    // Step 3: Update AndroidManifest with app name reference
    const manifestPath = join(buildDir, "src/main/AndroidManifest.xml");
    let manifest = fs.readFileSync(manifestPath, "utf-8");
    manifest = manifest.replace(
      /android:label="[^"]*"/,
      `android:label="@string/app_name"`
    );
    fs.writeFileSync(manifestPath, manifest);

    // Step 4: Update layout with app name
    const layoutPath = join(buildDir, "src/main/res/layout/activity_main.xml");
    let layout = fs.readFileSync(layoutPath, "utf-8");
    layout = layout.replace(
      />Contact Collector</,
      `>${escapeXml(appName.trim())}<`
    );
    fs.writeFileSync(layoutPath, layout);

    // Step 5: Handle logo if provided - copy as mipmap icon
    if (logoFile) {
      try {
        const logoBuffer = Buffer.from(await logoFile.arrayBuffer());

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
      } catch (logoErr: any) {
        console.error("Logo processing error:", logoErr.message);
        // Continue without logo if it fails
      }
    }

    // Step 6: Compile resources
    execSync(
      `${BUILD_TOOLS}/aapt2 compile --dir ${buildDir}/src/main/res -o ${buildDir}/build/compiled_resources.zip`,
      { stdio: "pipe" }
    );

    // Step 7: Link resources
    execSync(
      `${BUILD_TOOLS}/aapt2 link --java ${buildDir}/build/gen --manifest ${buildDir}/src/main/AndroidManifest.xml -I ${PLATFORM_JAR} --auto-add-overlay -o ${buildDir}/build/apk/base.apk ${buildDir}/build/compiled_resources.zip`,
      { stdio: "pipe" }
    );

    // Step 8: Compile Java
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
      `${JAVAC} -source 11 -target 11 -classpath ${PLATFORM_JAR} -sourcepath ${genDir}:${javaDir} -d ${buildDir}/build/obj @${sourcesFile}`,
      { stdio: "pipe" }
    );

    // Step 9: Convert to DEX (only MainActivity, not R.class which is already in resources)
    const mainClassFile = join(buildDir, "build/obj/com/contactcollector/app/MainActivity.class");

    execSync(
      `${BUILD_TOOLS}/d8 --lib ${PLATFORM_JAR} --output ${buildDir}/build/dex/ ${mainClassFile}`,
      { stdio: "pipe" }
    );

    // Step 10: Add DEX to APK
    execSync(`cp ${buildDir}/build/apk/base.apk ${buildDir}/build/apk/app-unsigned.apk`, { stdio: "pipe" });
    execSync(`cd ${buildDir}/build/apk && zip -j app-unsigned.apk ${buildDir}/build/dex/classes.dex`, { stdio: "pipe" });

    // Step 11: Align
    execSync(
      `${BUILD_TOOLS}/zipalign -f 4 ${buildDir}/build/apk/app-unsigned.apk ${buildDir}/build/apk/app-aligned.apk`,
      { stdio: "pipe" }
    );

    // Step 12: Sign with debug key
    const keystorePath = join(APP_TEMPLATE, "build/keystore/debug.keystore");
    execSync(
      `${BUILD_TOOLS}/apksigner sign --ks ${keystorePath} --ks-key-alias debugkey --ks-pass pass:android --key-pass pass:android --out ${buildDir}/build/apk/app-signed.apk ${buildDir}/build/apk/app-aligned.apk`,
      { stdio: "pipe" }
    );

    // Step 13: Read the final APK
    const apkPath = join(buildDir, "build/apk/app-signed.apk");
    const apkBuffer = fs.readFileSync(apkPath);

    // Step 14: Cleanup build directory
    try {
      execSync(`rm -rf ${buildDir}`, { stdio: "pipe" });
    } catch {}

    // Return APK file
    const safeName = appName.trim().replace(/\s+/g, "-").toLowerCase();
    return new NextResponse(apkBuffer, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${safeName}.apk"`,
        "Content-Length": apkBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Build error:", error.message);
    return NextResponse.json(
      { error: "Failed to build APK", details: error.message },
      { status: 500 }
    );
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
