const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/b2Config");

const uploadToB2 = async (fileBuffer, originalName, folderName = "products") => {
  const fileName = `${folderName}/${Date.now()}_${originalName.replace(/\s+/g, "_")}`;

  const uploadParams = {
    Bucket: process.env.B2_BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  // Construct Public Direct URL
  const endpointHost = process.env.B2_ENDPOINT.replace("https://", "");
  return `https://${process.env.B2_BUCKET_NAME}.${endpointHost}/${fileName}`;
};

module.exports = uploadToB2;