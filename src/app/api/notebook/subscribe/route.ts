import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const emailRe = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export async function POST(req: NextRequest) {
  let body: { email?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body.source === "string" ? body.source.slice(0, 60) : "landing";

  if (!email || email.length > 255 || !emailRe.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server not configured." }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("newsletter_subscribers").insert({ email, source });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true, alreadySubscribed: true });
    console.error("subscribe error", error);
    return NextResponse.json({ error: "Could not subscribe. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
