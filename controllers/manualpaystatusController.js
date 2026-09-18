const { prisma } = require("../config/db");

// Manual Confirmation Endpoint (Shopkeeper forcefully marks as SUCCESS)
const manualConfirmPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: "Transaction ID required" });
    }

    // 1. Transaction ko fetch aur update karein
    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "SUCCESS",
        invoiceId: `MANUAL_INV_${Date.now()}`,
      },
    });

    // 2. Active Bills memory map se remove karein agar present ho
    const formattedAmount = Number(transaction.amount).toFixed(2);
    if (activeBills.has(formattedAmount)) {
      activeBills.delete(formattedAmount);
    }

    return res.status(200).json({
      success: true,
      message: "Payment marked as SUCCESS manually",
      invoiceId: transaction.invoiceId,
    });
  } catch (error) {
    console.error("Manual Confirm Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  manualConfirmPayment,
};






