const multer = require("multer");
const multerS3 = require("multer-s3");
const AWS = require("aws-sdk");

require("dotenv").config();

// Cấu hình AWS S3
const s3 = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname}`);
    },
  }),
});

const uploadFields = upload.fields([
  { name: "mp3", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);
