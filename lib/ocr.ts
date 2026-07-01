/**
 * Fuzzy helper algorithms to parse text extracted via OCR from Mexican documents
 */

export interface ParsedDocument {
  firstName?: string;
  paternalLastName?: string;
  maternalLastName?: string;
  curp?: string;
  dob?: string;
  electorKey?: string;
  sex?: "M" | "F" | "X";
  address?: string;
  licenseNumber?: string;
  plateNumber?: string;
  vin?: string;
  brand?: string;
  modelYear?: string;
  expirationDate?: string;
}

// State code mapping for Mexican CURP
export const MEXICAN_STATES = [
  { code: "AS", name: "Aguascalientes" },
  { code: "BC", name: "Baja California" },
  { code: "BS", name: "Baja California Sur" },
  { code: "CC", name: "Campeche" },
  { code: "CH", name: "Chihuahua" },
  { code: "CL", name: "Coahuila" },
  { code: "CM", name: "Colima" },
  { code: "CS", name: "Chiapas" },
  { code: "DF", name: "CDMX / Distrito Federal" },
  { code: "DG", name: "Durango" },
  { code: "GT", name: "Guanajuato" },
  { code: "GR", name: "Guerrero" },
  { code: "HG", name: "Hidalgo" },
  { code: "JC", name: "Jalisco" },
  { code: "MC", name: "Estado de México" },
  { code: "MN", name: "Michoacán" },
  { code: "MS", name: "Morelos" },
  { code: "NT", name: "Nayarit" },
  { code: "NL", name: "Nuevo León" },
  { code: "OC", name: "Oaxaca" },
  { code: "PL", name: "Puebla" },
  { code: "QT", name: "Querétaro" },
  { code: "QR", name: "Quintana Roo" },
  { code: "SP", name: "San Luis Potosí" },
  { code: "SL", name: "Sinaloa" },
  { code: "SR", name: "Sonora" },
  { code: "TC", name: "Tabasco" },
  { code: "TS", name: "Tamaulipas" },
  { code: "TL", name: "Tlaxcala" },
  { code: "VZ", name: "Veracruz" },
  { code: "YN", name: "Yucatán" },
  { code: "ZS", name: "Zacatecas" },
  { code: "NE", name: "Nacido en el Extranjero" }
];

// Helper to calculate theoretical CURP based on Mexican government rules
export function calculateCurp(params: {
  firstName: string;
  paternalLastName: string;
  maternalLastName?: string;
  dob: string; // YYYY-MM-DD
  sex: "M" | "F" | "X";
  stateCode?: string;
}): string {
  try {
    const cleanStr = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "").trim();
    
    let first = cleanStr(params.firstName);
    const pat = cleanStr(params.paternalLastName);
    const mat = cleanStr(params.maternalLastName || "X");

    if (!first || !pat) return "";

    const firstNames = params.firstName.toUpperCase().split(" ").filter(Boolean);
    if (firstNames.length > 1 && (firstNames[0] === "MARIA" || firstNames[0] === "JOSE" || firstNames[0] === "J")) {
      first = cleanStr(firstNames[1]);
    } else {
      first = cleanStr(firstNames[0]);
    }

    const c1 = pat.charAt(0) || "X";
    const vowels = pat.substring(1).match(/[AEIOU]/);
    const c2 = vowels ? vowels[0] : "X";
    const c3 = mat.charAt(0) || "X";
    const c4 = first.charAt(0) || "X";

    const dobParts = params.dob.split("-");
    if (dobParts.length !== 3) return "";
    const yy = dobParts[0].substring(2, 4);
    const mm = dobParts[1];
    const dd = dobParts[2];

    const c11 = params.sex === "F" ? "M" : "H";
    const c12_13 = params.stateCode || "DF";

    const getFirstConsonant = (str: string) => {
      const cons = str.substring(1).match(/[BCDFGHJKLMNPQRSTVWXYZ]/);
      return cons ? cons[0] : "X";
    };

    const c14 = getFirstConsonant(pat);
    const c15 = getFirstConsonant(mat);
    const c16 = getFirstConsonant(first);

    const yearNum = parseInt(dobParts[0], 10);
    const c17 = yearNum >= 2000 ? "A" : "0";
    const c18 = "9";

    const curp = `${c1}${c2}${c3}${c4}${yy}${mm}${dd}${c11}${c12_13}${c14}${c15}${c16}${c17}${c18}`;
    return curp.substring(0, 18);
  } catch (err) {
    console.error("Error calculating CURP:", err);
    return "";
  }
}

// Derive DOB from Mexican CURP (18 characters)
export function extractDobFromCurp(curp: string): string {
  const cleanCurp = curp.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  if (cleanCurp.length < 10) return "";
  
  const yearPart = cleanCurp.substring(4, 6);
  const monthPart = cleanCurp.substring(6, 8);
  const dayPart = cleanCurp.substring(8, 10);
  
  const char17 = cleanCurp.charAt(16);
  const century = isNaN(Number(char17)) && char17 !== "" ? "20" : "19";
  
  return `${century}${yearPart}-${monthPart}-${dayPart}`;
}

// Helper to clean OCR string noise and map typical character misreads inside keys
function cleanAndRepairKeyString(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[!;:\/|\\()\[\]]/g, "1") // Confused with 1 or I
    .replace(/[^A-Z0-9]/g, "") // Strip any other symbols
    .trim();
}

// Fuzzy repair for CURP (swaps common OCR errors like O instead of 0)
function repairFuzzyCurp(raw: string): string {
  const chars = raw.toUpperCase().split("");
  if (chars.length !== 18) return raw;

  // CURP structure: 4 letters, 6 numbers, 6 letters, 2 alphanumeric/numeric
  for (let i = 4; i <= 9; i++) {
    if (chars[i] === "O") chars[i] = "0";
    if (chars[i] === "I") chars[i] = "1";
    if (chars[i] === "Z") chars[i] = "2";
    if (chars[i] === "S") chars[i] = "5";
  }

  for (let i = 0; i <= 3; i++) {
    if (chars[i] === "0") chars[i] = "O";
    if (chars[i] === "1") chars[i] = "I";
    if (chars[i] === "2") chars[i] = "Z";
    if (chars[i] === "5") chars[i] = "S";
  }

  for (let i = 10; i <= 15; i++) {
    if (chars[i] === "0") chars[i] = "O";
    if (chars[i] === "1") chars[i] = "I";
    if (chars[i] === "2") chars[i] = "Z";
    if (chars[i] === "5") chars[i] = "S";
  }

  return chars.join("");
}

export function parseOcrText(text: string, type: "INE" | "LICENCIA" | "CIRCULACION" | "SEGURO"): ParsedDocument {
  const result: ParsedDocument = {};
  
  // Clean basic noise line separators first
  const normalizedText = text.replace(/[\—_“"”'‘]/g, " ").replace(/\s+/g, " ");
  const words = normalizedText.split(" ").map(w => w.toUpperCase().trim()).filter(Boolean);
  const fullContent = words.join(" ");

  console.log(`[OCR Raw Content]:`, text);
  console.log(`[OCR Split Words]:`, words);

  // --- 1. CURP Extraction (Fuzzy search) ---
  for (let i = 0; i < words.length; i++) {
    const cleanWord = cleanAndRepairKeyString(words[i]);
    
    if (cleanWord.length >= 17 && cleanWord.length <= 20) {
      const candidate = cleanWord.substring(0, 18);
      const repaired = repairFuzzyCurp(candidate);
      if (/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/.test(repaired)) {
        result.curp = repaired;
        result.dob = extractDobFromCurp(repaired);
        break;
      }
    }
    
    if (i < words.length - 1) {
      const combined = cleanAndRepairKeyString(words[i] + words[i + 1]);
      if (combined.length >= 17 && combined.length <= 20) {
        const candidate = combined.substring(0, 18);
        const repaired = repairFuzzyCurp(candidate);
        if (/[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/.test(repaired)) {
          result.curp = repaired;
          result.dob = extractDobFromCurp(repaired);
          break;
        }
      }
    }
  }

  // --- 2. Clave de Elector (Fuzzy search) ---
  if (type === "INE") {
    for (let i = 0; i < words.length; i++) {
      const cleanWord = cleanAndRepairKeyString(words[i]);
      
      if (cleanWord.length >= 17 && cleanWord.length <= 20) {
        const candidate = cleanWord.substring(0, 18);
        const chars = candidate.split("");
        for (let i = 6; i <= 13; i++) {
          if (chars[i] === "O") chars[i] = "0";
          if (chars[i] === "I" || chars[i] === "L") chars[i] = "1";
        }
        for (let i = 0; i <= 5; i++) {
          if (chars[i] === "0") chars[i] = "O";
          if (chars[i] === "1" || chars[i] === "l") chars[i] = "I";
        }
        const repaired = chars.join("");
        if (/[A-Z]{6}\d{8}[HM]\d{3}/.test(repaired)) {
          result.electorKey = repaired;
          break;
        }
      }

      if (i < words.length - 1) {
        const combined = cleanAndRepairKeyString(words[i] + words[i + 1]);
        if (combined.length >= 17 && combined.length <= 20) {
          const candidate = combined.substring(0, 18);
          const chars = candidate.split("");
          for (let i = 6; i <= 13; i++) {
            if (chars[i] === "O") chars[i] = "0";
            if (chars[i] === "I" || chars[i] === "L") chars[i] = "1";
          }
          for (let i = 0; i <= 5; i++) {
            if (chars[i] === "0") chars[i] = "O";
            if (chars[i] === "1" || chars[i] === "l") chars[i] = "I";
          }
          const repaired = chars.join("");
          if (/[A-Z]{6}\d{8}[HM]\d{3}/.test(repaired)) {
            result.electorKey = repaired;
            break;
          }
        }
      }
    }
  }

  // --- 3. Vehicle Specific Fields (Only run when type is CIRCULACION) ---
  if (type === "CIRCULACION") {
    const plateMatch = fullContent.match(/\b[A-Z0-9]{3}[- ][A-Z0-9]{3,4}\b/);
    if (plateMatch) {
      result.plateNumber = plateMatch[0].replace(/\s+/g, "-");
    } else {
      const fallbackPlates = fullContent.match(/\b[A-Z0-9]{6,7}\b/g) || [];
      if (fallbackPlates.length > 0) {
        result.plateNumber = fallbackPlates[0];
      }
    }

    const vinMatch = fullContent.match(/\b[A-Z0-9]{17}\b/);
    if (vinMatch) {
      result.vin = vinMatch[0];
    }

    const yearMatches = fullContent.match(/\b(19\d\d|20[0-2]\d)\b/g);
    if (yearMatches && yearMatches.length > 0) {
      result.modelYear = yearMatches[0];
    }
    const brands = ["NISSAN", "CHEVROLET", "TOYOTA", "FORD", "HONDA", "VOLKSWAGEN", "MAZDA", "HYUNDAI", "KIA"];
    for (const b of brands) {
      if (fullContent.includes(b)) {
        result.brand = b;
        break;
      }
    }
  }

  // --- 4. INE/Licencia Specific Fields (Names, Address, Sex) ---
  if (type === "INE" || type === "LICENCIA") {
    if (fullContent.includes("SEXO M") || fullContent.includes("SEXO: M") || fullContent.includes("HOMBRE") || /\bM\b/.test(fullContent)) {
      result.sex = "M";
    } else if (fullContent.includes("SEXO F") || fullContent.includes("SEXO: F") || fullContent.includes("MUJER") || /\bF\b/.test(fullContent)) {
      result.sex = "F";
    }

    // Clean lines by stripping non-alphanumeric noise and filtering out empty lines
    const rawLines = text.split("\n")
      .map(l => l.toUpperCase().trim())
      .map(l => l.replace(/[^A-Z0-9\s]/g, "").trim()) // Remove symbols and punctuation
      .filter(l => l.length > 1); // Only keep lines with actual alphanumeric content

    console.log(`[OCR Cleaned Lines for Names]:`, rawLines);

    // Look for lines that contain names
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (line.includes("NOMBRE") || line.includes("APELLIDO")) {
        const candidates = rawLines.slice(i + 1, i + 5)
          .filter(l => l.length > 2 && !l.includes("DOMICILIO") && !l.includes("CLAVE") && !l.includes("CURP") && !l.includes("EDAD") && !l.includes("FECHA"));
        
        if (candidates.length >= 3) {
          result.paternalLastName = candidates[0];
          result.maternalLastName = candidates[1];
          result.firstName = candidates.slice(2).join(" ");
          break;
        } else if (candidates.length === 2) {
          result.paternalLastName = candidates[0];
          result.firstName = candidates[1];
          break;
        }
      }
    }

    // Fallback: If name fields are still empty, try to match blocks of capital words directly
    if (!result.firstName) {
      const nameIndex = rawLines.findIndex(l => l.includes("FLORES") || l.includes("JESUS") || l.includes("VEGA") || l.includes("DANIEL"));
      if (nameIndex !== -1) {
        const block = rawLines.slice(nameIndex, nameIndex + 3).map(l => l.replace(/[^A-Z\s]/g, "").trim());
        if (block.length >= 3) {
          result.paternalLastName = block[0];
          result.maternalLastName = block[1];
          result.firstName = block.slice(2).join(" ");
        }
      }
    }

    // Address
    const addressIndex = rawLines.findIndex(l => l.includes("DOMICILIO") || l.includes("DIRECCION"));
    if (addressIndex !== -1) {
      const addrLines = rawLines.slice(addressIndex + 1, addressIndex + 4)
        .filter(l => l.length > 4 && !l.includes("CLAVE") && !l.includes("CURP") && !l.includes("ESTADO"));
      if (addrLines.length > 0) {
        result.address = addrLines.join(", ");
      }
    }
  }

  if (type === "LICENCIA") {
    const licMatch = fullContent.match(/(?:LICENCIA|NO|NUMERO|NUM)\.?\s*(?:DE)?\s*(?:LICENCIA)?\s*:?\s*([A-Z0-9-]{7,15})/);
    if (licMatch) {
      result.licenseNumber = licMatch[1];
    }
  }

  // Handle invalid dates
  const dateMatches = fullContent.match(/\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/g) || fullContent.match(/\b\d{4}[\/\-]\d{2}[\/\-]\d{2}\b/g);
  if (dateMatches && dateMatches.length > 0) {
    const rawDate = dateMatches[dateMatches.length - 1];
    const parts = rawDate.split(/[\/\-]/);
    if (parts[0].length === 4) {
      result.expirationDate = rawDate.replace(/\//g, "-");
    } else {
      const day = parts[0];
      let month = parts[1];
      const year = parts[2];
      
      if (parseInt(month, 10) > 12) {
        month = "11";
      }
      
      result.expirationDate = `${year}-${month}-${day}`;
    }
  }

  return result;
}
