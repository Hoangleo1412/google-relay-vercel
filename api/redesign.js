import * as aiplatform from "@google-cloud/aiplatform";
import fs from "fs";

export default async function handler(req, res) {
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Only POST allowed' });
    return;
  }

  // Lấy dữ liệu body
  const { prompt, key, model, aspect_ratio, analysis_resolution, image_base64 } = req.body || {};

  // Kiểm tra dữ liệu đầu vào
  if (!prompt || !key) {
    res.status(400).json({ error: "Missing prompt or key" });
    return;
  }

  // Ghi key ra file tạm
  const keyFilePath = "/tmp/service-account.json";
  try {
    fs.writeFileSync(keyFilePath, typeof key === "string" ? key : JSON.stringify(key));
  } catch (e) {
    res.status(500).json({ error: "Cannot write service account file", detail: e.message });
    return;
  }

  // Khởi tạo VertexAI
  let vertex_ai, client;
  try {
    const { VertexAI } = aiplatform;
    vertex_ai = new VertexAI({
      project: JSON.parse(key).project_id,
      location: "us-central1",
      keyFile: keyFilePath,
    });
    client = vertex_ai.getGenerativeModelServiceClient();
  } catch (e) {
    res.status(500).json({ error: "Cannot init VertexAI", detail: e.message });
    return;
  }

  // Tạo instance input
  let instance = { prompt, aspectRatio: aspect_ratio || "1:1" };
  if (image_base64 && typeof image_base64 === "string" && image_base64.length > 100) {
    instance.image = { bytesBase64Encoded: image_base64 };
  }
  const publisherModel =
    model === "imagen-4-ultra"
      ? "publishers/google/models/imagen-4-ultra"
      : "publishers/google/models/imagen-4";

  try {
    const [response] = await client.generateContent({
      model: publisherModel,
      instances: [instance],
      parameters: {
        sampleCount: 1,
        resolution: analysis_resolution === "high" ? "HIGH" : "LOW",
      }
    });

    const outImageBase64 = response?.candidates?.[0]?.content?.parts?.[0]?.bytesBase64Encoded;
    if (!outImageBase64)
      return res.status(200).json({ status: "fail", message: "No image generated" });

    res.status(200).json({ status: "success", image_base64: outImageBase64 });
  } catch (e) {
    res.status(500).json({ error: "Google API Error", detail: e.message });
  }
}
