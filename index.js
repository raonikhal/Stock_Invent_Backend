require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const port = 3000;
const { connectDB } = require("./config/db");
const authRouter = require("./routes/authRoute");
const productRouter = require("./routes/productRoute");
const shopRouter = require("./routes/shopRoute");
const analyticsRouter = require("./routes/analyticsRoute");
const customerCreditRouter = require("./routes/customerCreditRoute");
const dashboardRouter = require("./routes/dashboardRoute");
const updateUPIRouter = require("./routes/upiUpdateRoute");
const getReorderRouter = require("./routes/getReorderRoute");
const subscriptionRouter = require("./routes/subscriptionRoute");
const securityRouter = require("./routes/securitypinRoute");
const notificationRouter = require("./routes/notificationRoute");
const userRouter = require("./routes/userRoute");
const supportRouter = require("./routes/supportRoute");
const profileRouter = require("./routes/profileupdateRoute");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// 🟢 2. Uploads folder ko static serve karein (Fixes Image Serving)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/shop", shopRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/customerCredit", customerCreditRouter);
app.use("/api/v1/payment", subscriptionRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/upi", updateUPIRouter);
app.use("/api/v1/reorder", getReorderRouter);
app.use("/api/v1/security", securityRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/support", supportRouter);
app.use("/api/v1/profile", profileRouter);



app.get("/", (req, res) => {
  res.send("Hello, World!");
});

async function startServer() {
  await connectDB();

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

startServer();
