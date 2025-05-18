import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";


interface Params {
    lang: string;
    configFile: string;
}

// GET handler to read a config file
export async function GET(
    request: NextRequest,
    { params }: { params: Params },
) {
    // Use await here to ensure params are fully resolved
    const { lang, configFile } = await Promise.resolve(params);

    // Basic validation for allowed config file names to prevent arbitrary file access
    const allowedConfigFiles = [
        "prompt.md",
        "related_words.txt",
    ];
    if (!allowedConfigFiles.includes(configFile)) {
        return NextResponse.json(
            { error: "Invalid config file requested" },
            { status: 400 },
        );
    }

    const filePath = path.join(env.DATA_REPO_PATH, lang, configFile);

    try {
        const content = await fs.readFile(filePath, "utf-8");
        return NextResponse.json({ content });
    } catch (error) {
        return NextResponse.json({ content: "" });
    }
}

// POST handler to write to a config file
export async function POST(
    request: NextRequest,
    { params }: { params: Params },
) {
    // Use await here to ensure params are fully resolved
    const { lang, configFile } = await Promise.resolve(params);

    const allowedConfigFiles = [
        "prompt.md",
        "related_words.txt",
    ];
    if (!allowedConfigFiles.includes(configFile)) {
        return NextResponse.json(
            { error: "Invalid config file requested" },
            { status: 400 },
        );
    }

    const body = await request.json();
    const content = body.content;

    if (typeof content !== "string") {
        return NextResponse.json(
            { error: "Invalid content in request body" },
            { status: 400 },
        );
    }

    const langDir = path.join(env.DATA_REPO_PATH, lang);
    const filePath = path.join(langDir, configFile);

    await fs.mkdir(langDir, { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({ message: "File saved successfully" });
}
