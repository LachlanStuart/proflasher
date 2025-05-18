import { type NextRequest, NextResponse } from "next/server";
import { updateCardModels } from "~/lib/ankiCardModels";

export async function POST(request: NextRequest) {
    try {
        const { language } = await request.json();
        const logs = await updateCardModels(language);
        return NextResponse.json({ success: true, logs });
    } catch (error) {
        console.error("Error updating card models:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
