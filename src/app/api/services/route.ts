import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, requireAuth } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  deliveryType: z.enum(["SINGLE_SESSION", "PROGRAM"]),
  defaultSessionsPerWeek: z.number().int().positive().optional().nullable(),
  defaultTotalSessions: z.number().int().positive().optional().nullable(),
  defaultDurationMin: z.number().int().positive().default(60),
  defaultBillingCycleType: z.enum(["MONTHLY", "PER_N_SESSIONS"]).optional().nullable(),
  defaultBillingCycleValue: z.number().int().positive().optional().nullable(),
  defaultPrice: z.number().positive().optional().nullable(),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const active = url.searchParams.get("active");
  const type = url.searchParams.get("type");

  const services = await prisma.service.findMany({
    where: {
      ...(active !== null ? { isActive: active === "true" } : {}),
      ...(type ? { deliveryType: type as "SINGLE_SESSION" | "PROGRAM" } : {}),
    },
    orderBy: { name: "asc" },
  });
  return ok(services);
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);
  const service = await prisma.service.create({ data: parsed.data });
  return ok(service, 201);
}
