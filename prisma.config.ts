import { defineConfig } from "@prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma", // Direct string pass karein, object nahi
  datasources: {
    db: {
      provider: "mysql",
      url: process.env.DATABASE_URL || "",
    },
  },
});
