import { VertexAI } from "@google-cloud/aiplatform";
import fs from "fs";

// Đảm bảo export hàm handler đúng chuẩn Vercel
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }

  // Lấy dữ liệu từ body
  const { image_base64, prompt, model, analysis_resolution, aspect_ratio } = req.body;

  // Lấy keyfile JSON từ biến môi trường (đã lưu ở Vercel Dashboard)
  const keyfileJSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const keyFilePath = "/tmp/service-account.json";

  // Tạo file key tạm nếu chưa có
  if (!fs.existsSync(keyFilePath)) {
    fs.writeFileSync(keyFilePath, keyfileJSON);
  }

  // Lấy thông tin project từ biến môi trường
  const project = process.env.GOOGLE_PROJECT_ID;
  const location = "us-central1";
  const publisherModel = model === "imagen-4-ultra"
    ? "publishers/google/models/imagen-4-ultra"
    : "publishers/google/models/imagen-4";

  // Khởi tạo VertexAI client
  const vertex_ai = new VertexAI({ project, location, keyFile: keyFilePath });
  const client = vertex_ai.getGenerativeModelServiceClient();

  const instance = {
    prompt,
    image: { bytesBase64Encoded: image_base64 },
    aspectRatio: aspect_ratio || "1:1"
  };

  try {
    const [response] = await client.generateContent({
      model: publisherModel,
      instances: [instance],
      parameters: {
        sampleCount: 1,
        resolution: analysis_resolution === "high" ? "HIGH" : "LOW"
      }
    });

    const outImageBase64 = response?.candidates?.[0]?.content?.parts?.[0]?.bytesBase64Encoded;
    if (!outImageBase64) {
      res.status(200).json({ status: "fail", message: "No image generated" });
      return;
    }
    res.status(200).json({
      status: "success",
      image_base64: outImageBase64
    });
  } catch (e) {
    res.status(500).json({ status: "fail", message: e.message });
  }
}
