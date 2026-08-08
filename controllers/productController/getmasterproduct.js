const {prisma} = require("../../config/db");

const getMasterProduct = async (req, res) => {
  try {
    const { barcode } = req.params;

    // 1. Master Product Table mein check karein
    const existingProduct = await prisma.masterProduct.findUnique({
      where: { barcode },
      select: {
        id: true,
        productName: true,
        barcode: true,
        mrp: true,
        netWeight: true,
        imageUrl: true,
      }
    });

    // Case A: Product mil gaya!
    if (existingProduct) {
      return res.status(200).json({
        success: true,
        existsInMaster: true,
        message: "Product found in Master Catalog!",
        data: existingProduct
      });
    }

    // Case B: Product nahi mila (New Product Flow needed)
    return res.status(200).json({
      success: false,
      existsInMaster: false,
      message: "Product not found. Please register this product in Master Catalog.",
      barcode: barcode // Barcode frontend ko wapas bhejein taaki form autofill ho sake
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getMasterProduct };