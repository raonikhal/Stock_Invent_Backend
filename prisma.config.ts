import { defineConfig } from "@prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: {
    kind: "single",
    filePath: "prisma/schema.prisma",
  },
  migrations: {
    initShadowDatabase: false,
  },
  datasources: [
    {
      provider: "mysql",
      url: process.env.DATABASE_URL!,
    },
  ],
});
