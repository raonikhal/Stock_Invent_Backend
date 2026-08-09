const { PrismaMariaDb } = require("@prisma/adapter-mariadb");
const { PrismaClient } = require("@prisma/client"); 

// Database URL parsing
const url = new URL(process.env.DATABASE_URL);

// MariaDB adapter configuration with Explicit SSL
const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: parseInt(url.port || "3306"),
  user: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  ssl: {
    rejectUnauthorized: true
  }
});

const prisma = new PrismaClient({ adapter });

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
