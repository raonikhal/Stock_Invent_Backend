const Razorpay = require('razorpay');
const crypto = require('crypto');
const { prisma } = require("../../config/db");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Step A: Payment Order Create Karna
const createOrder = async (req, res) => {
  try {
    const { amount } = req.body; // Rupee payload passing

    const options = {
      amount: 1 * 100, // Amount in paise (Default ₹100 = 10000 paise)
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return res.json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Step B: Payment Verification & User DB Upgrade
const verifyPayment = async (req, res) => {
  try {
    console.log("Received verify payment request");
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, phone } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !phone) {
      return res.status(400).json({ success: false, message: "Missing payment fields" });
    }

    // HMAC-SHA256 Signature Verification
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Expiry Date (1 Month duration)
      // const expiryDate = new Date();
      // expiryDate.setMonth(expiryDate.getMonth() + 1);

      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      // User table query (phone key validation)
      const updatedUser = await prisma.user.update({
        where: { phone: String(phone) },
        data: {
          isSubscriptionActive: true,
          subscriptionEndAt: expiryDate,
          razorpayPaymentId: razorpay_payment_id,
        },
      });

      return res.json({
        success: true,
        message: 'Payment verified & subscription extended',
        user: updatedUser,
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'User not found with provided phone number' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createOrder, verifyPayment };
