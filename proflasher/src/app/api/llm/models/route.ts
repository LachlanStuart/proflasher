import { NextResponse } from "next/server";

// LLM model names directly defined here
const LLM_MODEL_NAME = [
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.5-pro-exp-03-25",
];

export async function GET() {
    return NextResponse.json(LLM_MODEL_NAME);
}
