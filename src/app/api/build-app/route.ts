import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import fs from "fs";
import { createSession, updateSessionStatus, updateSession } from "@/lib/db";

const ANDROID_HOME = "/home/fahad/android-sdk";
const BUILD_TOOLS = join(ANDROID_HOME, "build-tools/35.0.1");
const PLATFORM_JAR = join(ANDROID_HOME, "platforms/android-35/android.jar");
const JAVAC = "/home/fahad/jdk-21.0.2/bin/javac";
const APP_TEMPLATE = "/home/fahad/android-app";

const buildEnv = {
  ...process.env,
  JAVA_HOME: "/home/fahad/jdk-21.0.2",
  PATH: "/home/fahad/jdk-21.0.2/bin:" + (process.env.PATH || ""),
  HOME: process.env.HOME || "/home/fahad",
};

export async function POST(req: NextRequest) {
  let buildDir = "";

  try {
    const formData = await req.formData();
    const appName = formData.get("appName") as string;
    const logoFile = formData.get("logo") as File | null;

    if (!appName || !appName.trim()) {
      return NextResponse.json({ error: "App name is required" }, { status: 400 });
    }

    if (appName.trim().length > 30) {
      return NextResponse.json({ error: "App name must be 30 characters or less" }, { status: 400 });
    }

    const sanitizedAppName = appName.trim().replace(/[^a-zA-Z0-9\s\-_.]/g, "");
    if (sanitizedAppName !== appName.trim()) {
      return NextResponse.json(
        { error: "App name contains invalid characters." },
        { status: 400 }
      );
    }

    const buildId = randomUUID();
    buildDir = join(tmpdir(), "apk-build-" + buildId);

    // Step 1: Copy template
    execSync("cp -r " + JSON.stringify(APP_TEMPLATE + "/app") + " " + JSON.stringify(buildDir), { env: buildEnv });

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

    // Step 2: Get the website base URL
    let websiteBaseUrl = req.headers.get("origin") || "";
    if (!websiteBaseUrl) {
      const host = req.headers.get("host");
      if (host) {
        const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
        websiteBaseUrl = protocol + "://" + host;
      }
    }
    if (!websiteBaseUrl) {
      websiteBaseUrl = "http://52.201.210.162";
    }

    // Step 3: Update app name in strings.xml
    const stringsXml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<resources>\n    <string name=\"app_name\">" + escapeXml(sanitizedAppName) + "</string>\n</resources>";
    fs.writeFileSync(join(buildDir, "src/main/res/values/strings.xml"), stringsXml);

    // Step 4: Update AndroidManifest label
    const manifestPath = join(buildDir, "src/main/AndroidManifest.xml");
    let manifest = fs.readFileSync(manifestPath, "utf-8");
    manifest = manifest.replace(
      /android:label="[^"]*"/,
      "android:label=\"@string/app_name\""
    );
    fs.writeFileSync(manifestPath, manifest);

    // Step 5: Update layout with app name
    const layoutPath = join(buildDir, "src/main/res/layout/activity_main.xml");
    if (fs.existsSync(layoutPath)) {
      let layout = fs.readFileSync(layoutPath, "utf-8");
      layout = layout.replace(/>Contact Collector</g, ">" + escapeXml(sanitizedAppName) + "<");
      layout = layout.replace(/>Collector</g, ">" + escapeXml(sanitizedAppName) + "<");
      fs.writeFileSync(layoutPath, layout);
    }

    // Step 6: Replace WEBSITE_BASE_URL in all Java files
    const javaDir = join(buildDir, "src/main/java/com/contactcollector/app");
    const javaFiles = fs.existsSync(javaDir) ? fs.readdirSync(javaDir).filter(f => f.endsWith(".java")) : [];
    for (const jf of javaFiles) {
      const filePath = join(javaDir, jf);
      let src = fs.readFileSync(filePath, "utf-8");
      src = src.replace(
        /private static final String WEBSITE_BASE_URL = "[^"]*";/,
        "private static final String WEBSITE_BASE_URL = \"" + websiteBaseUrl + "\";"
      );
      src = src.replace(
        /private static final String BUILD_ID = "[^"]*";/,
        "private static final String BUILD_ID = \"" + buildId + "\";"
      );
      fs.writeFileSync(filePath, src);
    }

    // Step 7: Handle logo
    if (logoFile) {
      try {
        const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
        if (logoBuffer.length > 2 * 1024 * 1024) {
          cleanupBuildDir(buildDir);
          return NextResponse.json({ error: "Logo file is too large. Maximum size is 2MB." }, { status: 400 });
        }

        const tempLogoPath = join(buildDir, "build", "uploaded_logo");
        fs.writeFileSync(tempLogoPath, logoBuffer);

        const mipmapConfigs = [
          { dir: "mipmap-mdpi", size: 48 },
          { dir: "mipmap-hdpi", size: 72 },
          { dir: "mipmap-xhdpi", size: 96 },
          { dir: "mipmap-xxhdpi", size: 144 },
          { dir: "mipmap-xxxhdpi", size: 192 },
        ];

        for (const config of mipmapConfigs) {
          const mipmapDir = join(buildDir, "src/main/res", config.dir);
          if (!fs.existsSync(mipmapDir)) {
            fs.mkdirSync(mipmapDir, { recursive: true });
          }
          const outPath = join(mipmapDir, "ic_launcher.png");
          const pyCmd = "python3 -c \"from PIL import Image; img=Image.open('" + tempLogoPath + "'); img=img.convert('RGBA'); img=img.resize((" + config.size + "," + config.size + "),Image.LANCZOS); img.save('" + outPath + "','PNG')\"";
          execSync(pyCmd, { stdio: "pipe", env: buildEnv });
        }

        // Remove adaptive icon XML
        const anydpiDir = join(buildDir, "src/main/res/mipmap-anydpi-v26");
        if (fs.existsSync(anydpiDir)) {
          fs.rmSync(anydpiDir, { recursive: true, force: true });
        }
        const fgPath = join(buildDir, "src/main/res/drawable/ic_launcher_foreground.xml");
        const bgPath = join(buildDir, "src/main/res/drawable/ic_launcher_background.xml");
        if (fs.existsSync(fgPath)) fs.unlinkSync(fgPath);
        if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);

        manifest = fs.readFileSync(manifestPath, "utf-8");
        manifest = manifest.replace(
          /android:roundIcon="[^"]*"/,
          "android:roundIcon=\"@mipmap/ic_launcher\""
        );
        fs.writeFileSync(manifestPath, manifest);
      } catch (logoErr: unknown) {
        const msg = logoErr instanceof Error ? logoErr.message : "Unknown logo error";
        console.error("Logo processing error:", msg);
      }
    }

    // Step 8: Compile resources
    execSync(
      JSON.stringify(BUILD_TOOLS + "/aapt2") + " compile --dir " + JSON.stringify(buildDir + "/src/main/res") + " -o " + JSON.stringify(buildDir + "/build/compiled_resources.zip"),
      { stdio: "pipe", env: buildEnv }
    );

    // Step 9: Link resources
    execSync(
      JSON.stringify(BUILD_TOOLS + "/aapt2") + " link --java " + JSON.stringify(buildDir + "/build/gen") + " --manifest " + JSON.stringify(buildDir + "/src/main/AndroidManifest.xml") + " -I " + JSON.stringify(PLATFORM_JAR) + " --auto-add-overlay -o " + JSON.stringify(buildDir + "/build/apk/base.apk") + " " + JSON.stringify(buildDir + "/build/compiled_resources.zip"),
      { stdio: "pipe", env: buildEnv }
    );

    // Step 10: Collect all Java source files with ABSOLUTE paths
    const sourcesFile = join(buildDir, "build/sources.txt");
    let sourcePaths = "";
    const genDir = join(buildDir, "build/gen");
    const srcJavaDir = join(buildDir, "src/main/java");

    function findJavaFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) findJavaFiles(fullPath);
        else if (entry.name.endsWith(".java")) sourcePaths += fullPath + "\n";
      }
    }
    findJavaFiles(genDir);
    findJavaFiles(srcJavaDir);
    fs.writeFileSync(sourcesFile, sourcePaths.trim());

    // Step 11: Compile Java
    execSync(
      JSON.stringify(JAVAC) + " -source 1.8 -target 1.8 -classpath " + JSON.stringify(PLATFORM_JAR) + " -sourcepath " + JSON.stringify(genDir) + ":" + JSON.stringify(srcJavaDir) + " -d " + JSON.stringify(buildDir + "/build/obj") + " @" + JSON.stringify(sourcesFile),
      { stdio: "pipe", env: buildEnv }
    );

    // Step 12: Create classes.jar from ALL .class files (including R.class)
    const classesJar = join(buildDir, "build/classes.jar");
    execSync("cd " + JSON.stringify(buildDir + "/build/obj") + " && zip -r -D " + JSON.stringify(classesJar) + " .", { stdio: "pipe", env: buildEnv });

    // Step 13: Convert to DEX
    execSync(
      JSON.stringify(BUILD_TOOLS + "/d8") + " --min-api 21 --lib " + JSON.stringify(PLATFORM_JAR) + " --output " + JSON.stringify(buildDir + "/build/dex/") + " " + JSON.stringify(classesJar),
      { stdio: "pipe", env: buildEnv }
    );

    // Step 14: Add DEX to APK
    execSync("cp " + JSON.stringify(buildDir + "/build/apk/base.apk") + " " + JSON.stringify(buildDir + "/build/apk/app-unsigned.apk"), { stdio: "pipe", env: buildEnv });
    execSync("cd " + JSON.stringify(buildDir + "/build/apk") + " && zip -j app-unsigned.apk " + JSON.stringify(buildDir + "/build/dex/classes.dex"), { stdio: "pipe", env: buildEnv });

    // Step 15: Zipalign
    execSync(
      JSON.stringify(BUILD_TOOLS + "/zipalign") + " -f 4 " + JSON.stringify(buildDir + "/build/apk/app-unsigned.apk") + " " + JSON.stringify(buildDir + "/build/apk/app-aligned.apk"),
      { stdio: "pipe", env: buildEnv }
    );

    // Step 16: Sign APK
    const keystorePath = join(APP_TEMPLATE, "build/keystore/debug.keystore");
    execSync(
      JSON.stringify(BUILD_TOOLS + "/apksigner") + " sign --ks " + JSON.stringify(keystorePath) + " --ks-key-alias debugkey --ks-pass pass:android --key-pass pass:android --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out " + JSON.stringify(buildDir + "/build/apk/app-signed.apk") + " " + JSON.stringify(buildDir + "/build/apk/app-aligned.apk"),
      { stdio: "pipe", env: buildEnv }
    );

    // Step 17: Verify APK
    try {
      const verifyOutput = execSync(
        JSON.stringify(BUILD_TOOLS + "/apksigner") + " verify --verbose " + JSON.stringify(buildDir + "/build/apk/app-signed.apk"),
        { stdio: "pipe", env: buildEnv, encoding: "utf-8" }
      );
      console.log("APK verification:", verifyOutput);
    } catch (verifyErr) {
      console.error("APK verification failed:", verifyErr);
    }

    // Step 18: Read the APK
    const apkPath = join(buildDir, "build/apk/app-signed.apk");
    const apkBuffer = fs.readFileSync(apkPath);

    // Step 19: Cleanup
    cleanupBuildDir(buildDir);

    // Step 20: Create session
    try {
      const stubSession = await createSession({
        contacts: JSON.stringify([]),
        files: JSON.stringify([]),
        appName: sanitizedAppName,
        count: 0,
        fileCount: 0,
      });
      await updateSession(stubSession.id, { buildId });
      await updateSessionStatus(stubSession.id, "apk_built", "APK built: " + sanitizedAppName);
    } catch (e) {
      console.error("Stub session creation error:", e);
    }

    // Return APK
    const safeName = sanitizedAppName.replace(/\s+/g, "-").toLowerCase();
    return new NextResponse(apkBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": "attachment; filename=\"" + safeName + ".apk\"",
        "Content-Length": apkBuffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
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
    execSync("rm -rf " + JSON.stringify(buildDir), { stdio: "pipe", env: buildEnv });
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
