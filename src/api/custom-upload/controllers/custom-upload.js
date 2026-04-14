'use strict';
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");


module.exports = {

  async upload(ctx) {
    console.log("\n================= 🚀 UPLOAD START =================");
    const file = ctx.request?.files?.files;
    const mime = file?.type || file?.mimetype;

    console.log("📁 Original File Name:", file?.name);
    console.log("📦 MIME Type:", mime);
    console.log("📏 Original Size (bytes):", file?.size);

    const isImage = mime && mime.startsWith("image/");
    const isAudio = mime && mime.startsWith("audio/");
    const isPng = mime === "image/png";

    console.log("🔍 Detected Type:",
      isImage ? "🖼️ Image" : isAudio ? "🎵 Audio" : "❓ Other"
    );

    let finalPath = file?.path;
    let isTemp = false;

    try {
      // ================= IMAGE HANDLING =================
      if (isImage && !isPng) {
        console.log("🖼️ Processing image...");
        console.log("⚠️ Not PNG → Converting to PNG...");

        const buffer = await sharp(file?.path)
          .png({ compressionLevel: 9 })
          .toBuffer();

        const tempPath = path.join(os.tmpdir(), `${Date.now()}.png`);
        fs.writeFileSync(tempPath, buffer);

        finalPath = tempPath;
        isTemp = true;

        console.log("🔥 Conversion successful");
        console.log("📍 Temp file path:", tempPath);

      } else if (isImage && isPng) {
        console.log("🖼️ Processing image...");
        console.log("✅ Already PNG → No conversion needed");
      }

      // ================= AUDIO HANDLING =================
      else if (isAudio) {
        console.log("🎵 Audio detected → Skipping conversion");
      }

      // ================= OTHER FILE =================
      else {
        console.log("⚠️ Unknown file type → Skipping processing");
      }

      const finalSize = fs.statSync(finalPath).size;

      console.log("📏 Final File Size (bytes):", finalSize);

      // ================= UPLOAD =================
      console.log("📤 Uploading to Strapi/S3...");

      const uploadedFiles = await strapi
        .plugin("upload")
        .service("upload")
        .upload({
          data: {},
          files: {
            path: finalPath,
            name: (isImage && !isPng)
              ? file.name.split(".")[0] + ".png"
              : file.name,
            type: (isImage && !isPng)
              ? "image/png"
              : mime,
            size: finalSize,
          },
        });

      console.log("✅ Upload successful");
      console.log("🆔 File ID:", uploadedFiles[0].id);
      console.log("🌍 URL:", uploadedFiles[0].url);

      console.log("================= ✅ UPLOAD END =================\n");

      return (ctx.body = uploadedFiles[0]);

    } finally {
      // ================= CLEANUP =================
      if (isTemp && fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
        console.log("🧹 Temp file deleted");
      }
    }
  }

};
