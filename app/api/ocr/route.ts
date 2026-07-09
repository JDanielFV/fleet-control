import { NextResponse } from "next/server";

const VALID_TARGETS = ["INE", "LICENCIA", "CIRCULACION", "SEGURO"] as const;
type OcrTarget = (typeof VALID_TARGETS)[number];

const MAX_BASE64_MB = 4;

export async function POST(request: Request) {
  try {
    const { image, target } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (typeof image !== "string") {
      return NextResponse.json({ error: "Image must be a base64 string" }, { status: 400 });
    }

    // Strip base64 metadata headers if present (e.g. data:image/jpeg;base64,)
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");

    // Rough size check: base64 is ~4/3 of binary size.
    const approximateMb = (base64Data.length * 3) / 4 / 1024 / 1024;
    if (approximateMb > MAX_BASE64_MB) {
      return NextResponse.json(
        { error: `Image too large. Maximum allowed is ${MAX_BASE64_MB} MB.` },
        { status: 413 }
      );
    }

    const normalizedTarget = typeof target === "string" ? target.toUpperCase() : "";
    if (!VALID_TARGETS.includes(normalizedTarget as OcrTarget)) {
      return NextResponse.json(
        { error: `Invalid target. Must be one of: ${VALID_TARGETS.join(", ")}` },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[OCR API] GEMINI_API_KEY is not defined in environment variables. Falling back to client-side OCR.");
      return NextResponse.json({ error: "Missing GEMINI_API_KEY in environment variables" }, { status: 412 });
    }

    // Structured prompt for Mexican documents
    const prompt = `Analiza la imagen adjunta de un documento de identidad o control vehicular mexicano. 
Determina qué tipo de documento es:
- Si es INE o IFE, extrae los datos correspondientes.
- Si es una Licencia de Conducir, extrae los datos correspondientes.
- Si es una Tarjeta de Circulación de automóvil, extrae los datos del vehículo.
- Si es una Póliza de Seguro de auto, extrae la vigencia/expiración.

*IMPORTANTE SOBRE EL VIN/NIV:* El número de serie (VIN o NIV) de un vehículo mexicano consta estrictamente de exactamente 17 caracteres alfanuméricos y nunca contiene guiones. Los números con formato como "MT-C-XXXX" o números de 8-12 dígitos con guiones representan el Folio de la Tarjeta de Circulación, NO el VIN. Si no localizas una serie de 17 caracteres, deja el campo "vin" vacío.

*IMPORTANTE SOBRE LA VIGENCIA:* En las tarjetas de circulación mexicanas, la fecha de vigencia puede aparecer como "Vigencia", "Fecha de Vigencia", "Válido hasta", "Expira", "Expiración" o "Vence". Busca cualquiera de estos términos. Si ves una fecha en la tarjeta de circulación, asígnela al campo "expirationDate".

Responde únicamente con un objeto JSON válido con la siguiente estructura (llena únicamente los campos que logres leer claramente, el resto déjalos vacíos o en blanco):

{
  "firstName": "nombres del conductor",
  "paternalLastName": "apellido paterno",
  "maternalLastName": "apellido materno",
  "curp": "CURP de 18 caracteres",
  "dob": "fecha de nacimiento en formato AAAA-MM-DD",
  "electorKey": "clave de elector de 18 caracteres del INE",
  "sex": "M para masculino, F para femenino",
  "address": "domicilio completo",
  "licenseNumber": "número de licencia de conducir",
  "brand": "marca del auto",
  "vehicleName": "submarca o modelo del auto (ej. Sentra)",
  "model": "año/modelo del auto (ej. 2022)",
  "classType": "clase o tipo de auto",
  "expirationDate": "fecha de vigencia/expiración de la licencia, póliza o tarjeta de circulación en formato AAAA-MM-DD",
  "vin": "número de serie / NIV de 17 caracteres",
  "plateNumber": "placa del auto"
}

No incluyas formateo de markdown (como \`\`\`json) en tu respuesta, devuelve estrictamente el JSON plano.`;

    // Connect to Google Gemini API using gemini-3.1-flash-lite
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OCR API] Gemini API error response:", errorText);
      return NextResponse.json({ error: `Gemini service failed: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return NextResponse.json({ error: "Empty response from Gemini model" }, { status: 500 });
    }

    // Parse the JSON output returned by Gemini
    const parsedData = JSON.parse(resultText.trim());
    console.log("[OCR API] Gemini successfully parsed:", parsedData);
    
    return NextResponse.json(parsedData);
  } catch (err: unknown) {
    console.error("[OCR API] Route handler error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
