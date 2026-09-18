const { prisma } = require("../../config/db");

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
      let formattedImageUrl = existingProduct.imageUrl;

      if (formattedImageUrl) {
        // 🔹 1. Windows backslash '\' ko '/' mein convert karein
        formattedImageUrl = formattedImageUrl.replace(/\\/g, '/');

        // 🔹 2. Clean 'backend_SI' ya koi bhi unwanted root directory prefix
        if (formattedImageUrl.includes('uploads/')) {
          formattedImageUrl = '/uploads/' + formattedImageUrl.split('uploads/')[1];
        }
      }

      return res.status(200).json({
        success: true,
        existsInMaster: true,
        message: "Product found in Master Catalog!",
        data: {
          ...existingProduct,
          imageUrl: formattedImageUrl // Cleaned relative URL: '/uploads/products/product-...'
        }
      });
    }

    // Case B: Product nahi mila
    return res.status(200).json({
      success: false,
      existsInMaster: false,
      message: "Product not found. Please register this product in Master Catalog.",
      barcode: barcode
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getMasterProduct };