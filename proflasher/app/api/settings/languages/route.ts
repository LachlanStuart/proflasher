import { NextResponse } from "next/server";
import { loadTemplates } from "~/lib/cardModel/noteTemplates";

export async function GET() {
	const templates = await loadTemplates();
	const languages = Object.keys(templates);

	return NextResponse.json({
		languages,
		templates,
	});
}
