// const { S3Client } = require("@aws-sdk/client-s3");
// const { fromEnv } = require("@aws-sdk/credential-provider-env");
// const multer = require("multer");
// const multerS3 = require("multer-s3");
// require("dotenv").config();

// // Cấu hình AWS S3
// const s3 = new S3Client({
//     region: process.env.S3_REGION,
//     credentials: {
//         accessKeyId: process.env.S3_ACCESS_KEY,
//         secretAccessKey: process.env.S3_SECRET_KEY
//     }
// });


// // Cấu hình Multer để upload file lên S3
// const upload = multer({
//     storage: multerS3({
//         s3,
//         bucket: process.env.S3_BUCKET_NAME,
//         metadata: function (req, file, cb) {
//             cb(null, { fieldName: file.fieldname });
//         },
//         key: function (req, file, cb) {
//             const filePath = `lessons/${Date.now()}-${file.originalname}`;
//             console.log("🟢 File Path:", filePath);
//             cb(null, `lessons/${Date.now()}-${file.originalname}`);
//         }
//     })
// }).single("mp3");

// export default upload;