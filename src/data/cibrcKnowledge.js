/**
 * CIB&RC (Central Insecticides Board & Registration Committee, India)
 * Reference knowledge base for statutory pesticide label requirements,
 * toxicity classifications (Insecticides Rules 1971), and standard formulations.
 */

export const TOXICITY_CATEGORIES = {
  EXTREMELY_TOXIC: {
    code: "CATEGORY_I",
    color: "Red",
    colorHex: "#dc2626",
    signalWord: "POISON",
    hindiSignal: "विष / ज़हर",
    marathiSignal: "विष",
    symbol: "☠️",
    oralLD50: "1 - 50 mg/kg",
    riskLevel: "Extremely Dangerous - Keep away from children and animals"
  },
  HIGHLY_TOXIC: {
    code: "CATEGORY_II",
    color: "Yellow",
    colorHex: "#eab308",
    signalWord: "POISON",
    hindiSignal: "ज़हर",
    marathiSignal: "विष",
    symbol: "⚠️",
    oralLD50: "51 - 500 mg/kg",
    riskLevel: "Highly Dangerous - Strictly use PPE (Gloves, Mask, Goggles)"
  },
  MODERATELY_TOXIC: {
    code: "CATEGORY_III",
    color: "Blue",
    colorHex: "#2563eb",
    signalWord: "DANGER",
    hindiSignal: "खतरा",
    marathiSignal: "धोका",
    symbol: "⚠️",
    oralLD50: "501 - 5000 mg/kg",
    riskLevel: "Moderate Risk - Harmful if swallowed or inhaled"
  },
  SLIGHTLY_TOXIC: {
    code: "CATEGORY_IV",
    color: "Green",
    colorHex: "#16a34a",
    signalWord: "CAUTION",
    hindiSignal: "सावधानी",
    marathiSignal: "काळजी घ्या",
    symbol: "🟢",
    oralLD50: "> 5000 mg/kg",
    riskLevel: "Slight Risk - Follow standard safety precautions"
  }
};

export const COMMON_PESTICIDES = {
  "acetamiprid": {
    name: "Acetamiprid",
    chemicalClass: "Neonicotinoid",
    commonFormulations: ["99% w/w Minimum Technical", "20% SP"],
    targetPests: ["Aphids", "Jassids", "Whiteflies", "Thrips"],
    toxicity: TOXICITY_CATEGORIES.MODERATELY_TOXIC,
    defaultWaitingPeriod: "15 days",
    firstAid: "Induce vomiting if conscious. Keep airway clear. Seek medical attention immediately. No specific antidote; treat symptomatically.",
    ppe: ["Chemical resistant gloves", "Face mask / respirator", "Eye goggles", "Protective apron"]
  },
  "imidacloprid": {
    name: "Imidacloprid",
    popularBrand: "Confidor",
    chemicalClass: "Neonicotinoid",
    commonFormulations: ["17.8% SL", "70% WG", "30.5% SC"],
    targetPests: ["Brown plant hopper", "Aphids", "Whiteflies", "Termites"],
    toxicity: TOXICITY_CATEGORIES.HIGHLY_TOXIC,
    defaultWaitingPeriod: "21 days",
    firstAid: "Remove contaminated clothing. Wash skin with soap and plenty of water. If swallowed, gastric lavage. Administer activated charcoal.",
    ppe: ["Nitrile gloves", "Dust/Mist mask", "Eye protection", "Rubber boots"]
  },
  "carbofuran": {
    name: "Carbofuran",
    popularBrand: "Furadon",
    chemicalClass: "Carbamate",
    commonFormulations: ["3% CG", "3% G"],
    targetPests: ["Stem borer", "Gall midge", "Root grub", "Nematodes"],
    toxicity: TOXICITY_CATEGORIES.EXTREMELY_TOXIC,
    defaultWaitingPeriod: "30-60 days (restricted/banned in several crops)",
    firstAid: "Atropine is specific antidote. Administer 2-4 mg intravenously repeated every 10-15 minutes until atropinization. NEVER give morphine or tranquilizers.",
    ppe: ["Full chemical suit", "Respirator with organic vapor cartridge", "Heavy rubber boots", "Chemical gloves"]
  },
  "monocrotophos": {
    name: "Monocrotophos",
    popularBrand: "Monocil",
    chemicalClass: "Organophosphate",
    commonFormulations: ["36% SL"],
    targetPests: ["Bollworms", "Sucking pests", "Leaf roller"],
    toxicity: TOXICITY_CATEGORIES.EXTREMELY_TOXIC,
    defaultWaitingPeriod: "15 - 30 days",
    firstAid: "Atropine and 2-PAM (Pralidoxime) are specific antidotes. Seek immediate emergency hospitalization.",
    ppe: ["Full coverall", "Face shield", "Chemical gloves", "Full boots"]
  },
  "chlorpyrifos": {
    name: "Chlorpyrifos",
    chemicalClass: "Organophosphate",
    commonFormulations: ["20% EC", "50% EC"],
    targetPests: ["Termites", "Aphids", "Root borer"],
    toxicity: TOXICITY_CATEGORIES.HIGHLY_TOXIC,
    defaultWaitingPeriod: "15 - 20 days",
    firstAid: "Atropine is antidote. Do not induce vomiting if petroleum solvents are present. Seek immediate medical assistance.",
    ppe: ["Chemical resistant gloves", "Safety goggles", "Respirator", "Protective footwear"]
  }
};
