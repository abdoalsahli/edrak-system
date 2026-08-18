import { PrismaClient, UserRole, ServiceDeliveryType, BillingCycleType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminPass = await bcrypt.hash("admin123", 10);

  const manager = await prisma.user.upsert({
    where: { email: "manager@edrak.com" },
    update: {},
    create: {
      name: "مدير النظام",
      email: "manager@edrak.com",
      password: adminPass,
      role: UserRole.MANAGER,
    },
  });

  await prisma.user.upsert({
    where: { email: "reception@edrak.com" },
    update: {},
    create: {
      name: "موظف الاستقبال",
      email: "reception@edrak.com",
      password: await bcrypt.hash("reception123", 10),
      role: UserRole.RECEPTIONIST,
    },
  });

  await prisma.user.upsert({
    where: { email: "accounts@edrak.com" },
    update: {},
    create: {
      name: "المحاسب",
      email: "accounts@edrak.com",
      password: await bcrypt.hash("accounts123", 10),
      role: UserRole.ACCOUNTANT,
    },
  });

  // ── Center Hours (Sun–Thu open, Fri–Sat closed) ───────────────────────────
  const hours = [
    { dayOfWeek: 0, isOpen: true,  openTime: "08:00", closeTime: "17:00" }, // Sunday
    { dayOfWeek: 1, isOpen: true,  openTime: "08:00", closeTime: "17:00" }, // Monday
    { dayOfWeek: 2, isOpen: true,  openTime: "08:00", closeTime: "17:00" }, // Tuesday
    { dayOfWeek: 3, isOpen: true,  openTime: "08:00", closeTime: "17:00" }, // Wednesday
    { dayOfWeek: 4, isOpen: true,  openTime: "08:00", closeTime: "17:00" }, // Thursday
    { dayOfWeek: 5, isOpen: false, openTime: "00:00", closeTime: "00:00" }, // Friday
    { dayOfWeek: 6, isOpen: false, openTime: "00:00", closeTime: "00:00" }, // Saturday
  ];

  for (const h of hours) {
    await prisma.centerHours.upsert({
      where: { dayOfWeek: h.dayOfWeek },
      update: h,
      create: h,
    });
  }

  // ── Services ───────────────────────────────────────────────────────────────
  const services = [
    {
      name: "تقييم أولي",
      description: "جلسة تقييم أولية لتحديد احتياجات المريض",
      deliveryType: ServiceDeliveryType.SINGLE_SESSION,
      defaultDurationMin: 60,
    },
    {
      name: "استشارة",
      description: "جلسة استشارة مع أخصائي",
      deliveryType: ServiceDeliveryType.SINGLE_SESSION,
      defaultDurationMin: 45,
    },
    {
      name: "علاج النطق",
      description: "برنامج علاج النطق واللغة",
      deliveryType: ServiceDeliveryType.PROGRAM,
      defaultSessionsPerWeek: 3,
      defaultTotalSessions: 36,
      defaultDurationMin: 60,
      defaultBillingCycleType: BillingCycleType.MONTHLY,
      defaultBillingCycleValue: 1,
    },
    {
      name: "العلاج الوظيفي",
      description: "برنامج العلاج الوظيفي",
      deliveryType: ServiceDeliveryType.PROGRAM,
      defaultSessionsPerWeek: 3,
      defaultTotalSessions: 36,
      defaultDurationMin: 60,
      defaultBillingCycleType: BillingCycleType.MONTHLY,
      defaultBillingCycleValue: 1,
    },
    {
      name: "تحليل السلوك التطبيقي (ABA)",
      description: "برنامج تحليل وتعديل السلوك",
      deliveryType: ServiceDeliveryType.PROGRAM,
      defaultSessionsPerWeek: 5,
      defaultTotalSessions: 60,
      defaultDurationMin: 60,
      defaultBillingCycleType: BillingCycleType.MONTHLY,
      defaultBillingCycleValue: 1,
    },
    {
      name: "الإرشاد النفسي",
      description: "جلسات الإرشاد والدعم النفسي",
      deliveryType: ServiceDeliveryType.PROGRAM,
      defaultSessionsPerWeek: 2,
      defaultTotalSessions: 24,
      defaultDurationMin: 50,
      defaultBillingCycleType: BillingCycleType.MONTHLY,
      defaultBillingCycleValue: 1,
    },
    {
      name: "تأهيل الإدمان",
      description: "برنامج تأهيل الإدمان",
      deliveryType: ServiceDeliveryType.PROGRAM,
      defaultSessionsPerWeek: 3,
      defaultTotalSessions: 48,
      defaultDurationMin: 60,
      defaultBillingCycleType: BillingCycleType.MONTHLY,
      defaultBillingCycleValue: 1,
    },
  ];

  for (const s of services) {
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.service.create({ data: s });
    }
  }

  // ── System Settings ────────────────────────────────────────────────────────
  const settings = [
    { key: "center_name", value: "مركز إدراك للتأهيل والاستشارات" },
    { key: "center_phone", value: "" },
    { key: "center_address", value: "" },
    { key: "center_logo_path", value: "" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { ...s, updatedBy: manager.id },
    });
  }

  console.log("✓ Seed complete");
  console.log("  manager@edrak.com  / admin123");
  console.log("  reception@edrak.com / reception123");
  console.log("  accounts@edrak.com  / accounts123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
