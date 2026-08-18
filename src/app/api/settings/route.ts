import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = ["center_name", "center_phone", "center_address", "center_logo_path"] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

export async function GET() {
  await requireAuth();
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: [...ALLOWED_KEYS] } },
    select: { key: true, value: true },
  });
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body: Record<string, string> = await req.json();

  await Promise.all(
    ALLOWED_KEYS.map((key) => {
      const value = body[key as AllowedKey];
      if (value === undefined) return null;
      return prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedBy: auth.id },
        update: { value, updatedBy: auth.id },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
