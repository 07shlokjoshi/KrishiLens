import { COMMON_PESTICIDES, TOXICITY_CATEGORIES } from "../data/cibrcKnowledge.js";

/**
 * Validation & Anti-Hallucination Service
 * Enforces the strict schema required by Section 7, validates against CIB&RC
 * standards, flags unreadable fields, and attaches farmer-friendly safety advice.
 */
export class ValidationService {
  /**
   * Validates and enriches the model/OCR result
   * @param {object} input - Model or OCR output
   * @param {string} inferenceSource - "gemma_4_novita" | "local_ocr_fallback"
   * @returns {object} Standardized result conforming to Section 7 schema
   */
  validateAndEnrich(input, inferenceSource = "gemma_4_novita") {
    const raw = input || {};

    const isLabelDetected = Boolean(raw.label_detected);

    if (!isLabelDetected) {
      return {
        label_detected: false,
        status: "NO_LABEL_DETECTED",
        product_name: null,
        manufacturer: null,
        active_ingredient: null,
        concentration: null,
        registration_number: null,
        directions_text: null,
        safety_warnings: [],
        first_aid_text: null,
        storage_instructions: null,
        language_detected: null,
        unreadable_fields: [],
        confidence_or_uncertainty: {
          overall: "NONE",
          notes: "No pesticide packaging or label recognized in the image frame."
        },
        safety_advisory: "Please point your camera directly at the printed label on the pesticide bottle, box, or sachet.",
        inference_metadata: {
          source: inferenceSource,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Clean strings or set to null
    const cleanStr = (val) => {
      if (typeof val === "string" && val.trim().length > 0 && val.toLowerCase() !== "null" && val.toLowerCase() !== "none") {
        return val.trim();
      }
      return null;
    };

    const productName = cleanStr(raw.product_name);
    const manufacturer = cleanStr(raw.manufacturer);
    const activeIngredient = cleanStr(raw.active_ingredient);
    const concentration = cleanStr(raw.concentration);
    const registrationNumber = cleanStr(raw.registration_number);
    const directionsText = cleanStr(raw.directions_text);
    const firstAidText = cleanStr(raw.first_aid_text);
    const storageInstructions = cleanStr(raw.storage_instructions);
    const languageDetected = cleanStr(raw.language_detected) || "en";

    // Safety warnings array validation
    let safetyWarnings = [];
    if (Array.isArray(raw.safety_warnings)) {
      safetyWarnings = raw.safety_warnings
        .filter((w) => typeof w === "string" && w.trim().length > 0)
        .map((w) => w.trim());
    } else if (typeof raw.safety_warnings === "string" && raw.safety_warnings.trim().length > 0) {
      safetyWarnings = [raw.safety_warnings.trim()];
    }

    // Track unreadable fields
    const unreadableFields = new Set(Array.isArray(raw.unreadable_fields) ? raw.unreadable_fields : []);
    if (!productName) unreadableFields.add("product_name");
    if (!activeIngredient) unreadableFields.add("active_ingredient");
    if (!concentration) unreadableFields.add("concentration");
    if (!directionsText) unreadableFields.add("directions_text");
    if (!firstAidText) unreadableFields.add("first_aid_text");
    if (safetyWarnings.length === 0) unreadableFields.add("safety_warnings");

    const unreadableList = Array.from(unreadableFields);

    // Cross-reference with CIB&RC knowledge base
    let matchedKnowledge = null;
    let toxicityCategory = raw.toxicity_category || null;

    if (activeIngredient) {
      const aiKey = activeIngredient.toLowerCase().trim();
      for (const [key, data] of Object.entries(COMMON_PESTICIDES)) {
        if (aiKey.includes(key) || data.name.toLowerCase().includes(aiKey)) {
          matchedKnowledge = data;
          if (!toxicityCategory) {
            toxicityCategory = data.toxicity;
          }
          break;
        }
      }
    }

    if (!toxicityCategory) {
      toxicityCategory = TOXICITY_CATEGORIES.MODERATELY_TOXIC;
    }

    // Status classification per Section 6
    let status = "SUCCESS_FULLY_READ";
    if (unreadableList.length >= 4) {
      status = "LABEL_DETECTED_TEXT_UNREADABLE";
    } else if (unreadableList.length > 0) {
      status = "PARTIAL_EXTRACTION_UNCERTAIN";
    }

    // Safety advisory construction (Section 11)
    let safetyAdvisory = null;
    if (status === "LABEL_DETECTED_TEXT_UNREADABLE" || unreadableList.includes("first_aid_text") || unreadableList.includes("directions_text")) {
      safetyAdvisory = "CRITICAL SAFETY WARNING: Key directions or safety instructions are unclear or unreadable on this label. Do NOT guess the dosage or mixing ratios. Please inspect the printed leaflet inside the packaging or ask an authorized agricultural officer/KVK.";
    } else {
      safetyAdvisory = "Always wear protective gloves and mask when mixing or spraying. Keep children and cattle away from treated fields during the waiting period.";
    }

    // Farmer-friendly Multilingual Explanations (Hindi & Marathi)
    const explanations = {
      en: {
        title: productName || (activeIngredient ? `${activeIngredient} Formulation` : "Pesticide Product"),
        signal: toxicityCategory.signalWord,
        summary: `This is a ${toxicityCategory.color} Triangle (${toxicityCategory.signalWord}) chemical. ${toxicityCategory.riskLevel}.`,
        waitingPeriod: matchedKnowledge?.defaultWaitingPeriod || "Refer to leaflet",
        ppeNeeded: matchedKnowledge?.ppe || ["Gloves", "Mask", "Goggles", "Boots"]
      },
      hi: {
        title: productName || (activeIngredient ? `${activeIngredient} कीटनाशक` : "कीटनाशक उत्पाद"),
        signal: toxicityCategory.hindiSignal,
        summary: `यह ${toxicityCategory.color} त्रिभुज (${toxicityCategory.hindiSignal}) वाला कीटनाशक है। ${toxicityCategory.riskLevel}।`,
        waitingPeriod: matchedKnowledge?.defaultWaitingPeriod ? `छिड़काव के बाद प्रतीक्षा समय: ${matchedKnowledge.defaultWaitingPeriod}` : "पैकेट का पर्चा देखें",
        ppeNeeded: ["दस्ताने (Gloves)", "मास्क (Mask)", "चश्मा (Goggles)", "जूते (Boots)"]
      },
      mr: {
        title: productName || (activeIngredient ? `${activeIngredient} कीटकनाशक` : "कीटकनाशक"),
        signal: toxicityCategory.marathiSignal,
        summary: `हे ${toxicityCategory.color} त्रिकोण (${toxicityCategory.marathiSignal}) चे कीटकनाशक आहे। काळजीपूर्वक वापरा।`,
        waitingPeriod: matchedKnowledge?.defaultWaitingPeriod ? `फवारणीनंतर थांबण्याचा कालावधी: ${matchedKnowledge.defaultWaitingPeriod}` : "माहितीपत्रक पहा",
        ppeNeeded: ["हातमोजे", "मास्क", "सुरक्षा चष्मा", "गम बूट"]
      }
    };

    return {
      label_detected: true,
      status,
      product_name: productName,
      manufacturer: manufacturer,
      active_ingredient: activeIngredient,
      concentration: concentration,
      registration_number: registrationNumber,
      directions_text: directionsText,
      safety_warnings: safetyWarnings,
      first_aid_text: firstAidText,
      storage_instructions: storageInstructions,
      language_detected: languageDetected,
      unreadable_fields: unreadableList,
      toxicity_category: toxicityCategory,
      confidence_or_uncertainty: {
        overall: raw.confidence_or_uncertainty?.overall || (unreadableList.length > 2 ? "LOW" : "HIGH"),
        notes: raw.confidence_or_uncertainty?.notes || (unreadableList.length > 0 ? `Uncertain fields: ${unreadableList.join(", ")}` : "High confidence read")
      },
      safety_advisory: safetyAdvisory,
      explanations,
      inference_metadata: {
        source: inferenceSource,
        timestamp: new Date().toISOString()
      }
    };
  }
}
