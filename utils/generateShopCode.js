const { prisma } = require('../config/db.js');
const { RTO_MAP } = require('./rtoCodes.js');

const generateSequentialShopCode = async (districtName) => {
  const normalizedDistrict = districtName?.trim().toLowerCase();
  
  // 1. District se RTO Code mapped karo
  const districtInfo = RTO_MAP[normalizedDistrict] || { rto: "IN01", state: "India" };
  const rtoPrefix = districtInfo.rto; // e.g., "UP50" ya "PB10"

  // 2. Count check karo ki is RTO Code ki kitni dukane pehle se DB mein hain
  const count = await prisma.shop.count({
    where: {
      rtoCode: rtoPrefix,
    },
  });

  // 3. Increment sequence number (+1)
  const nextSequence = count + 1;

  // 4. Sequence number ko 4-digit formatted string mein convert karo (e.g., 1 -> "0001", 12 -> "0012")
  const formattedSequence = String(nextSequence).padStart(4, '0');

  // Final code: "UP50-0001"
  const finalShopCode = `${rtoPrefix}-${formattedSequence}`;

  return {
    shopCode: finalShopCode,
    rtoCode: rtoPrefix,
    state: districtInfo.state,
    district: districtName,
  };
};


module.exports = { generateSequentialShopCode };