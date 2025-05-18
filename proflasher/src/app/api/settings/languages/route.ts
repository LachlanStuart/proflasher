import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { env } from "~/env";


export async function GET() {
    const entries = await fs.readdir(env.DATA_REPO_PATH, { withFileTypes: true });
    const languages = entries
        .filter((dirent) => dirent.isDirectory() && dirent.name !== ".git")
        .map((dirent) => dirent.name);
    return NextResponse.json(languages);
}
