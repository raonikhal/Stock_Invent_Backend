const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const { PrismaClient } = require("@prisma/client");

// Database URL parse kar rahe hain
const dbUrl = new URL(process.env.DATABASE_URL);

// MariaDB/MySQL Driver Adapter Setup (Explicit Connection details with NO SSL issue)
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "3306"),
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.replace("/", ""),
  connectionLimit: 10,
});

// Singleton Pattern for Nodemon Hot Reloads
const globalForPrisma = global;

globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully ✅");
  } catch (err) {
    console.error("Database connection failed ❌");
    console.error(err);
    process.exit(1);
  }
}

module.exports = { prisma, connectDB };













//this is code for using on Render 

// const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
// const { PrismaClient } = require("@prisma/client"); 

// // Database URL parsing
// const url = new URL(process.env.DATABASE_URL);

// // MariaDB adapter configuration with Explicit SSL
// const adapter = new PrismaMariaDb({
//   host: url.hostname,
//   port: parseInt(url.port || "3306"),
//   user: url.username,
//   password: url.password,
//   database: url.pathname.replace("/", ""),
//   ssl: {
//     rejectUnauthorized: true
//   }
// });

// const prisma = new PrismaClient({ adapter });

// async function connectDB() {
//   try {
//     await prisma.$connect();
//     console.log("Database connected successfully ✅");
//   } catch (err) {
//     console.error("Database connection failed ❌");
//     console.error(err);
//     process.exit(1);
//   }
// }

// module.exports = { prisma, connectDB };
