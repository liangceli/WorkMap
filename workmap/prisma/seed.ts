import {
  AvatarDirection,
  BrowserName,
  DeviceOS,
  IntegrationProvider,
  OfficeRoomType,
  PrismaClient,
  ProductivityLabel,
  UserRole,
  UserStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const demoDate = new Date("2026-05-17T00:00:00.000Z");

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "workmap-demo-company" },
    update: { name: "WorkMap Demo Company" },
    create: {
      name: "WorkMap Demo Company",
      slug: "workmap-demo-company",
    },
  });

  const engineering = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Engineering",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: "Engineering",
    },
  });

  const sales = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Sales",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: "Sales",
    },
  });

  const owner = await upsertUser(company.id, engineering.id, {
    email: "owner@workmap.demo",
    displayName: "Olivia Owner",
    role: UserRole.OWNER,
    status: UserStatus.AVAILABLE,
    avatarId: "avatar-owner-01",
    jobTitle: "Founder",
  });

  const manager = await upsertUser(company.id, sales.id, {
    email: "manager@workmap.demo",
    displayName: "Mia Manager",
    role: UserRole.MANAGER,
    status: UserStatus.BUSY,
    avatarId: "avatar-manager-01",
    jobTitle: "Sales Manager",
  });

  const employeeOne = await upsertUser(company.id, engineering.id, {
    email: "engineer@workmap.demo",
    displayName: "Ethan Engineer",
    role: UserRole.EMPLOYEE,
    status: UserStatus.FOCUS,
    avatarId: "avatar-engineer-01",
    jobTitle: "Software Engineer",
  });

  const employeeTwo = await upsertUser(company.id, sales.id, {
    email: "sales@workmap.demo",
    displayName: "Sofia Sales",
    role: UserRole.EMPLOYEE,
    status: UserStatus.AVAILABLE,
    avatarId: "avatar-sales-01",
    jobTitle: "Account Executive",
  });

  const itAdmin = await upsertUser(company.id, engineering.id, {
    email: "it.admin@workmap.demo",
    displayName: "Isaac IT Admin",
    role: UserRole.IT_ADMIN,
    status: UserStatus.AVAILABLE,
    avatarId: "avatar-it-01",
    jobTitle: "IT Administrator",
  });

  const officeMap = await prisma.officeMap.upsert({
    where: {
      companyId_slug: {
        companyId: company.id,
        slug: "default-office",
      },
    },
    update: {
      name: "Default Office Map",
      isDefault: true,
      width: 1280,
      height: 720,
      tileSize: 32,
    },
    create: {
      companyId: company.id,
      name: "Default Office Map",
      slug: "default-office",
      width: 1280,
      height: 720,
      tileSize: 32,
      isDefault: true,
      mapData: {
        version: 1,
        layers: ["floor", "wall", "furniture", "collision", "interaction"],
      },
    },
  });

  const openOffice = await upsertRoom(company.id, officeMap.id, {
    name: "Open Office",
    type: OfficeRoomType.OPEN_OFFICE,
    autoStatus: UserStatus.AVAILABLE,
    zoneData: rectangleZone(0, 0, 640, 360),
  });

  await upsertRoom(company.id, officeMap.id, {
    name: "Focus Room",
    type: OfficeRoomType.FOCUS,
    autoStatus: UserStatus.FOCUS,
    zoneData: rectangleZone(640, 0, 320, 220),
  });

  await upsertRoom(company.id, officeMap.id, {
    name: "Break Room",
    type: OfficeRoomType.BREAK,
    autoStatus: UserStatus.BREAK,
    zoneData: rectangleZone(960, 0, 320, 220),
  });

  await upsertRoom(company.id, officeMap.id, {
    name: "Meeting Room",
    type: OfficeRoomType.MEETING,
    autoStatus: UserStatus.BUSY,
    zoneData: rectangleZone(640, 220, 320, 250),
  });

  await upsertRoom(company.id, officeMap.id, {
    name: "Sales Zone",
    type: OfficeRoomType.DEPARTMENT_ZONE,
    autoStatus: UserStatus.AVAILABLE,
    zoneData: rectangleZone(0, 360, 420, 360),
  });

  await upsertRoom(company.id, officeMap.id, {
    name: "Engineering Zone",
    type: OfficeRoomType.DEPARTMENT_ZONE,
    autoStatus: UserStatus.AVAILABLE,
    zoneData: rectangleZone(420, 360, 540, 360),
  });

  const policy = await prisma.monitoringPolicy.upsert({
    where: {
      companyId_policyVersion: {
        companyId: company.id,
        policyVersion: "v1",
      },
    },
    update: {
      name: "Default Monitoring Policy",
      collectAppUsage: true,
      collectWebsiteDomain: true,
      collectFullUrl: false,
      collectScreenshots: false,
      collectKeystrokes: false,
      workHoursOnly: true,
      workdayStart: "09:00",
      workdayEnd: "23:00",
      retentionDays: 90,
      employeeCanViewOwnData: true,
    },
    create: {
      companyId: company.id,
      name: "Default Monitoring Policy",
      collectAppUsage: true,
      collectWebsiteDomain: true,
      collectFullUrl: false,
      collectScreenshots: false,
      collectKeystrokes: false,
      workHoursOnly: true,
      workdayStart: "09:00",
      workdayEnd: "23:00",
      retentionDays: 90,
      employeeCanViewOwnData: true,
      policyVersion: "v1",
      activeFrom: new Date("2026-05-17T09:00:00.000Z"),
    },
  });

  await Promise.all(
    [owner, manager, employeeOne, employeeTwo, itAdmin].map((user) =>
      prisma.policyAcknowledgement.upsert({
        where: {
          userId_monitoringPolicyId: {
            userId: user.id,
            monitoringPolicyId: policy.id,
          },
        },
        update: { acknowledgedAt: new Date("2026-05-17T09:15:00.000Z") },
        create: {
          companyId: company.id,
          userId: user.id,
          monitoringPolicyId: policy.id,
          acknowledgedAt: new Date("2026-05-17T09:15:00.000Z"),
        },
      }),
    ),
  );

  await Promise.all([
    upsertDevice(company.id, owner.id, {
      hostname: "WM-OWNER-LAPTOP",
      os: DeviceOS.MACOS,
      agentVersion: "0.1.0",
    }),
    upsertDevice(company.id, manager.id, {
      hostname: "WM-MANAGER-LAPTOP",
      os: DeviceOS.WINDOWS,
      agentVersion: "0.1.0",
    }),
    upsertDevice(company.id, employeeOne.id, {
      hostname: "WM-ENG-WORKSTATION",
      os: DeviceOS.LINUX,
      agentVersion: "0.1.0",
    }),
    upsertDevice(company.id, employeeTwo.id, {
      hostname: "WM-SALES-LAPTOP",
      os: DeviceOS.WINDOWS,
      agentVersion: "0.1.0",
    }),
    upsertDevice(company.id, itAdmin.id, {
      hostname: "WM-IT-LAPTOP",
      os: DeviceOS.MACOS,
      agentVersion: "0.1.0",
    }),
  ]);

  await Promise.all([
    upsertPosition(company.id, officeMap.id, openOffice.id, owner.id, 160, 160, UserStatus.AVAILABLE),
    upsertPosition(company.id, officeMap.id, openOffice.id, manager.id, 220, 180, UserStatus.BUSY),
    upsertPosition(company.id, officeMap.id, openOffice.id, employeeOne.id, 300, 180, UserStatus.FOCUS),
    upsertPosition(company.id, officeMap.id, openOffice.id, employeeTwo.id, 180, 260, UserStatus.AVAILABLE),
    upsertPosition(company.id, officeMap.id, openOffice.id, itAdmin.id, 340, 260, UserStatus.AVAILABLE),
  ]);

  await prisma.appUsageSummary.createMany({
    data: [
      appUsage(company.id, employeeOne.id, "Visual Studio Code", "Development", ProductivityLabel.PRODUCTIVE, 14400, 900),
      appUsage(company.id, employeeOne.id, "Slack", "Communication", ProductivityLabel.NEUTRAL, 2400, 300),
      appUsage(company.id, employeeTwo.id, "HubSpot", "CRM", ProductivityLabel.PRODUCTIVE, 12600, 600),
      appUsage(company.id, employeeTwo.id, "Microsoft Teams", "Communication", ProductivityLabel.PRODUCTIVE, 3600, 240),
      appUsage(company.id, manager.id, "Microsoft Excel", "Productivity", ProductivityLabel.PRODUCTIVE, 5400, 300),
    ],
    skipDuplicates: true,
  });

  await prisma.websiteUsageSummary.createMany({
    data: [
      websiteUsage(company.id, employeeOne.id, "github.com", BrowserName.CHROME, "Development", ProductivityLabel.PRODUCTIVE, 7200, 300),
      websiteUsage(company.id, employeeOne.id, "developer.mozilla.org", BrowserName.CHROME, "Reference", ProductivityLabel.PRODUCTIVE, 1800, 120),
      websiteUsage(company.id, employeeTwo.id, "salesforce.com", BrowserName.EDGE, "CRM", ProductivityLabel.PRODUCTIVE, 6400, 240),
      websiteUsage(company.id, employeeTwo.id, "linkedin.com", BrowserName.EDGE, "Sales Research", ProductivityLabel.NEUTRAL, 2100, 180),
      websiteUsage(company.id, manager.id, "app.powerbi.com", BrowserName.EDGE, "Reporting", ProductivityLabel.PRODUCTIVE, 3200, 120),
    ],
    skipDuplicates: true,
  });

  await Promise.all([
    upsertIntegration(company.id, IntegrationProvider.MICROSOFT, "WorkMap Demo Microsoft Tenant"),
    upsertIntegration(company.id, IntegrationProvider.THREE_CX, "WorkMap Demo 3CX"),
  ]);

  const existingAuditLog = await prisma.auditLog.findFirst({
    where: {
      companyId: company.id,
      actorUserId: manager.id,
      targetUserId: employeeOne.id,
      action: "EMPLOYEE_DETAIL_VIEWED",
      resourceType: "User",
      resourceId: employeeOne.id,
    },
  });

  if (!existingAuditLog) {
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        actorUserId: manager.id,
        targetUserId: employeeOne.id,
        action: "EMPLOYEE_DETAIL_VIEWED",
        resourceType: "User",
        resourceId: employeeOne.id,
        metadata: {
          reason: "Demo manager dashboard audit event",
        },
      },
    });
  }
}

function rectangleZone(x: number, y: number, width: number, height: number) {
  return { shape: "rectangle", x, y, width, height };
}

function appUsage(
  companyId: string,
  userId: string,
  appName: string,
  category: string,
  productivityLabel: ProductivityLabel,
  activeSeconds: number,
  idleSeconds: number,
) {
  return {
    companyId,
    userId,
    date: demoDate,
    appName,
    category,
    productivityLabel,
    activeSeconds,
    idleSeconds,
  };
}

function websiteUsage(
  companyId: string,
  userId: string,
  domain: string,
  browserName: BrowserName,
  category: string,
  productivityLabel: ProductivityLabel,
  activeSeconds: number,
  idleSeconds: number,
) {
  return {
    companyId,
    userId,
    date: demoDate,
    domain,
    browserName,
    category,
    productivityLabel,
    activeSeconds,
    idleSeconds,
  };
}

async function upsertUser(
  companyId: string,
  departmentId: string,
  data: {
    email: string;
    displayName: string;
    role: UserRole;
    status: UserStatus;
    avatarId: string;
    jobTitle: string;
  },
) {
  return prisma.user.upsert({
    where: {
      companyId_email: {
        companyId,
        email: data.email,
      },
    },
    update: {
      departmentId,
      displayName: data.displayName,
      role: data.role,
      status: data.status,
      avatarId: data.avatarId,
      jobTitle: data.jobTitle,
    },
    create: {
      companyId,
      departmentId,
      ...data,
    },
  });
}

async function upsertRoom(
  companyId: string,
  officeMapId: string,
  data: {
    name: string;
    type: OfficeRoomType;
    autoStatus: UserStatus;
    zoneData: Record<string, unknown>;
  },
) {
  return prisma.officeRoom.upsert({
    where: {
      officeMapId_name: {
        officeMapId,
        name: data.name,
      },
    },
    update: data,
    create: {
      companyId,
      officeMapId,
      ...data,
    },
  });
}

async function upsertDevice(
  companyId: string,
  userId: string,
  data: {
    hostname: string;
    os: DeviceOS;
    agentVersion: string;
  },
) {
  const existing = await prisma.device.findFirst({
    where: {
      companyId,
      userId,
      hostname: data.hostname,
    },
  });

  if (existing) {
    return prisma.device.update({
      where: { id: existing.id },
      data: {
        ...data,
        lastSeenAt: new Date("2026-05-17T10:30:00.000Z"),
      },
    });
  }

  return prisma.device.create({
    data: {
      companyId,
      userId,
      ...data,
      lastSeenAt: new Date("2026-05-17T10:30:00.000Z"),
    },
  });
}

async function upsertPosition(
  companyId: string,
  officeMapId: string,
  officeRoomId: string,
  userId: string,
  x: number,
  y: number,
  status: UserStatus,
) {
  return prisma.virtualOfficePosition.upsert({
    where: { userId },
    update: {
      companyId,
      officeMapId,
      officeRoomId,
      x,
      y,
      direction: AvatarDirection.DOWN,
      isMoving: false,
      status,
    },
    create: {
      companyId,
      userId,
      officeMapId,
      officeRoomId,
      x,
      y,
      direction: AvatarDirection.DOWN,
      isMoving: false,
      status,
    },
  });
}

async function upsertIntegration(companyId: string, provider: IntegrationProvider, displayName: string) {
  const existing = await prisma.integrationAccount.findFirst({
    where: {
      companyId,
      provider,
      userId: null,
    },
  });

  const data = {
    displayName,
    enabled: true,
    connectedAt: new Date("2026-05-17T08:30:00.000Z"),
  };

  if (existing) {
    return prisma.integrationAccount.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.integrationAccount.create({
    data: {
      companyId,
      provider,
      ...data,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
