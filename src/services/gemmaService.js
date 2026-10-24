import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

/**
 * Gemma 4 Multimodal Inference Service
 * Connects to Hugging Face Router API using OpenAI-compatible client
 */
export class GemmaService {
  constructor() {
    this.apiKey = process.env.HF_TOKEN;
    this.baseURL = process.env.HF_BASE_URL || "https://router.huggingface.co/v1";
    this.model = process.env.VISION_MODEL || "google/gemma-4-31B-it:novita";
    
    this.client = new OpenAI({
      baseURL: this.baseURL,
      apiKey: this.apiKey,
      timeout: 30000, // 30s timeout
    });
  }

  /**
   * Reads and structures pesticide label information using Gemma 4
   * @param {string} imageInput - Base64 Data URI or Image URL
   * @returns {Promise<{raw: any, parsed: any}>}
   */
  async extractLabelInfo(imageInput) {
    if (!this.apiKey) {
      throw new Error("MISSING_HF_TOKEN: HF_TOKEN environment variable is not configured.");
    }

    const systemPrompt = `You are KrishiLens AI, an expert computer vision and agricultural safety assistant specialized in reading and understanding pesticide labels in India (CIB&RC approved labels).

Analyze the visible pesticide packaging/label in the provided image.
Return ONLY a valid JSON object strictly matching this schema. Do NOT invent missing data or dosages. Use null for unreadable or absent fields:

{
  "label_detected": true,
  "product_name": null,
  "manufacturer": null,
  "active_ingredient": null,
  "concentration": null,
  "registration_number": null,
  "directions_text": null,
  "safety_warnings": [],
  "first_aid_text": null,
  "storage_instructions": null,
  "language_detected": null,
  "unreadable_fields": [],
  "confidence_or_uncertainty": {
    "overall": "HIGH" | "MEDIUM" | "LOW",
    "notes": "explanation of any blurry, cropped, or ambiguous text"
  }
}

CRITICAL SAFETY RULES:
1. Preserve verbatim wording for safety warnings, first aid, and directions whenever legible.
2. If text is blurry, occluded, or unreadable, append the field name to "unreadable_fields" and set the field value to null.
3. If the image is NOT a pesticide container, packet, or chemical label, set "label_detected": false and keep other fields null.
4. Output raw JSON only with NO markdown fences, no conversational preamble.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: systemPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageInput,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error("EMPTY_RESPONSE: Model returned an empty response.");
      }

      // Clean markdown code blocks if present
      const cleaned = rawContent
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      return {
        success: true,
        provider: "huggingface_router",
        model: this.model,
        data: parsed,
        raw: rawContent
      };
    } catch (err) {
      // Analyze error types
      const errMsg = err.message || "";
      let errorType = "API_ERROR";

      if (errMsg.includes("no remaining credits") || errMsg.includes("402")) {
        errorType = "CREDIT_LIMIT_REACHED";
      } else if (errMsg.includes("not supported by any provider") || errMsg.includes("model_not_supported")) {
        errorType = "MODEL_UNAVAILABLE";
      } else if (errMsg.includes("timeout") || errMsg.includes("ECONNABORTED")) {
        errorType = "TIMEOUT";
      } else if (err instanceof SyntaxError) {
        errorType = "MALFORMED_JSON_OUTPUT";
      }

      return {
        success: false,
        errorType,
        message: errMsg,
        originalError: err
      };
    }
  }
}
