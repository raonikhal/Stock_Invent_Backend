require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = 3000;
const { connectDB } = require("./config/db");
const authRouter = require("./routes/authRoute");
const productRouter = require("./routes/productRoute");
const shopRouter = require("./routes/shopRoute");
const analyticsRouter = require("./routes/analyticsRoute");
const customerCreditRouter = require("./routes/customerCreditRoute");
const godownRouter = require("./routes/godownRoute");
const dashboardRouter = require("./routes/dashboardRoute"); 

app.use(express.json());
app.use(cors());



<<<<<<< Updated upstream
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/shop", shopRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/customerCredit", customerCreditRouter);
app.use("/api/v1/godown", godownRouter); // Added Godown routes
=======
app.use("api/auth", authRouter);
app.use("api/product", productRouter);
app.use("api/shop", shopRouter);
app.use("api/analytics", analyticsRouter);
app.use("api/customerCredit", customerCreditRouter);
app.use("api/godown", godownRouter); // Added Godown routes
app.use("/api/dashboard", dashboardRouter);
>>>>>>> Stashed changes


app.get("/", (req, res) => {
  res.send("Hello, World!");
});

async function startServer() {
  await connectDB();

  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

startServer();
