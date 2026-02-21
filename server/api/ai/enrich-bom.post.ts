const MAX_BOM_LINES = 500
const MAX_PNP_COMPONENTS = 1000

const VALID_TYPES = ['SMD', 'THT', 'Mounting', 'Other'] as const
const VALID_SMD_CLASSES = ['Fast', 'Slow', 'Finepitch', 'BGA'] as const

interface SanitizedManufacturer { manufacturer: string; manufacturerPart: string }
interface SanitizedSuggestion {
  description?: string
  type?: string
  pinCount?: number
  smdClassification?: string
  manufacturers?: SanitizedManufacturer[]
  group?: string
}
type SanitizedSuggestions = Record<string, SanitizedSuggestion>

/**
 * Validate and sanitize AI-returned suggestions against the expected schema.
 * Drops unknown keys and coerces values to the correct types so malformed
 * model output never propagates to the client.
 */
function sanitizeSuggestions(raw: unknown): SanitizedSuggestions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor'])
  const result: SanitizedSuggestions = Object.create(null)

  for (const [lineId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (dangerousKeys.has(lineId)) continue
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const src = entry as Record<string, unknown>
    const suggestion: SanitizedSuggestion = {}

    if (typeof src.description === 'string' && src.description.trim()) {
      suggestion.description = src.description.trim()
    }

    if (typeof src.type === 'string' && (VALID_TYPES as readonly string[]).includes(src.type)) {
      suggestion.type = src.type
    }

    if (typeof src.pinCount === 'number' && Number.isInteger(src.pinCount) && src.pinCount > 0) {
      suggestion.pinCount = src.pinCount
    }

    if (typeof src.smdClassification === 'string' && (VALID_SMD_CLASSES as readonly string[]).includes(src.smdClassification)) {
      suggestion.smdClassification = src.smdClassification
    }

    if (typeof src.group === 'string' && src.group.trim()) {
      suggestion.group = src.group.trim()
    }

    if (Array.isArray(src.manufacturers)) {
      const mfrs: SanitizedManufacturer[] = []
      for (const m of src.manufacturers) {
        if (m && typeof m === 'object' && typeof m.manufacturer === 'string' && typeof m.manufacturerPart === 'string') {
          const mfr = m.manufacturer.trim()
          const part = m.manufacturerPart.trim()
          if (mfr && part) mfrs.push({ manufacturer: mfr, manufacturerPart: part })
        }
      }
      if (mfrs.length > 0) suggestion.manufacturers = mfrs
    }

    if (Object.keys(suggestion).length > 0) {
      result[lineId] = suggestion
    }
  }

  return result
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { apiKey, model, bomLines, smdPnpComponents, thtPnpComponents, existingGroups, teamPlan } = body ?? {}

  if (teamPlan === 'free') {
    throw createError({ statusCode: 403, statusMessage: 'Spark AI requires a Pro plan or higher' })
  }

  if (!apiKey || typeof apiKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing apiKey' })
  }
  if (!model || typeof model !== 'string' || !model.startsWith('claude-')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid model' })
  }
  if (!Array.isArray(bomLines) || bomLines.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or empty bomLines' })
  }
  if (bomLines.length > MAX_BOM_LINES) {
    throw createError({ statusCode: 400, statusMessage: `BOM exceeds ${MAX_BOM_LINES} line limit` })
  }

  const systemPrompt = `You are Spark, an expert electronics manufacturing AI assistant specializing in BOM (Bill of Materials) enrichment for PCB assembly.

Your task is to analyze BOM lines and improve them. You receive BOM data along with SMD and THT Pick & Place component lists for cross-referencing.

For each BOM line, suggest improvements where applicable:

1. **Description**: Improve the description to be professional and standardized. Follow these naming conventions strictly:

   **MLCC / Ceramic Capacitors** — format: "Capacitor MLCC {value} {voltage} {dielectric} ±{tolerance} {package}"
   - "Capacitor MLCC 4.7µF 16V X5R ±10% 0603" instead of "Cap 4u7"
   - "Capacitor MLCC 100nF 50V X7R ±10% 0402" instead of "Cap 100n"
   - "Capacitor MLCC 10µF 25V X5R ±20% 0805" instead of "CAP 10UF"

   **Electrolytic Capacitors** — format: "Capacitor Electrolytic {value} {voltage} ±{tolerance} {dimensions/package}"
   - "Capacitor Electrolytic 100µF 25V ±20% 6.3x7.7mm" instead of "ECAP 100u"

   **Thick Film Resistors** — format: "Resistor Thick Film {value} {tolerance} {power} {TCR} {package}"
   - "Resistor Thick Film 27kΩ 1% 0.063W 100ppm 0402" instead of "RES 27K"
   - "Resistor Thick Film 10kΩ 1% 0.1W 100ppm 0603" instead of "R 10K 1%"
   - "Resistor Thick Film 0Ω (Jumper) 0.063W 0402" instead of "0R"

   **Thin Film Resistors** — format: "Resistor Thin Film {value} {tolerance} {power} {TCR} {package}"
   - "Resistor Thin Film 4.99kΩ 0.1% 0.1W 25ppm 0603"

   **ICs / Semiconductors** — format: "{Part Number} {brief function} {package}"
   - "STM32F407VGT6 ARM Cortex-M4 Microcontroller LQFP-100" instead of "MCU"
   - "LM1117-3.3 3.3V LDO Regulator SOT-223" instead of "REG 3V3"

   **Other components** — use a clear, descriptive format: "{Type} {key specs} {package}"
   - "LED Green 520nm 20mA 0603" instead of "LED GRN"
   - "Inductor 10µH 1.5A ±20% 4x4mm" instead of "IND 10u"

   Use µ (micro sign U+00B5) for micro, Ω (U+03A9) for ohm. Omit fields you cannot infer — never guess voltage, tolerance, TCR, or power ratings.

2. **Type**: Suggest SMD, THT, Mounting, or Other based on the component data and PnP cross-reference.

3. **Pin Count** (THT only): Suggest the pin count for through-hole components based on the package and description.

4. **SMD Classification** (SMD only): Classify SMD components into exactly one of:
   - "Fast" — chip packages like 0201, 0402, 0603, 0805, 1206, SOT-23, SOT-363, and similar small 2-6 terminal packages suitable for high-speed pick and place
   - "Slow" — larger packages (body >5mm on any side) like SO-8, SOIC-16, SSOP, TSSOP, QFP with standard pitch (≥0.5mm), connectors, electrolytic caps
   - "Finepitch" — packages with very fine pin pitch (<0.5mm) requiring microscope inspection, such as QFN with 0.4mm pitch, fine-pitch QFP, CSP
   - "BGA" — Ball Grid Array packages of any kind (BGA, µBGA, WLCSP, LGA with ball attach)

5. **Manufacturers** (standard passives): For resistors and capacitors, suggest manufacturers and manufacturer part numbers. This includes suggesting **alternative second-source options** when the line already has a manufacturer — the goal is to give users safe 1-to-1 drop-in replacements from different vendors.
   - If a line has NO manufacturers, suggest 2 options from different vendors.
   - If a line already HAS a manufacturer, suggest 1–2 ALTERNATIVE manufacturers (different vendor, same specs) as second sources.
   - Do NOT repeat a manufacturer+part that already exists on the line.
   Use well-known manufacturers:
   - Resistors: Yageo, Samsung Electro-Mechanics, Vishay, Panasonic, KOA Speer, TE Connectivity
   - Ceramic Capacitors: Samsung Electro-Mechanics, Murata, Yageo, TDK, Kemet
   - Electrolytic Capacitors: Panasonic, Nichicon, Murata, TDK
   Only suggest manufacturer part numbers you are confident are real, valid, currently-available part numbers. The part number must exactly match the component's value, tolerance, voltage rating, and package size. For example, if the line is "Capacitor MLCC 4.7µF 16V X5R ±10% 0603" with Samsung Electro-Mechanics CL10A475K08NNNC, suggest Murata GRM188R61C475KE15D as an alternative.

6. **Group**: Suggest a group name to organize the BOM. Use these standard group names consistently:
   - "Standard Resistors" — generic thick/thin film resistors (non-precision, non-specialty)
   - "Standard MLCC" — generic MLCC ceramic capacitors (non-precision, non-specialty)
   - "Electrolytic Capacitors" — electrolytic and tantalum capacitors
   - "ICs" — integrated circuits, microcontrollers, regulators, op-amps, etc.
   - "Connectors" — connectors, headers, sockets
   - "THT Components" — through-hole components that don't fit other groups
   - "LEDs & Indicators" — LEDs, displays, indicator components
   - "Inductors & Ferrites" — inductors, ferrite beads, transformers
   - "Diodes & Transistors" — discrete semiconductors
   - "Mechanical" — mounting hardware, heatsinks, spacers
   Use these exact names when applicable. Only create a new group name if a component truly doesn't fit any of the above categories.

IMPORTANT: Only include fields where you have a meaningful suggestion that differs from the existing data. Do not echo back the same values. If a description is already good, omit it. If you cannot determine a field, omit it entirely.
For manufacturers: DO include the manufacturers array even if the line already has manufacturers — suggest NEW alternative manufacturers only (do not repeat existing ones). The system will automatically deduplicate.

Respond with a JSON object where keys are the BOM line IDs and values are objects with optional fields: description, type, pinCount, smdClassification, manufacturers (array of {manufacturer, manufacturerPart}), group (string).

Only output the JSON object, nothing else.`

  const userPayload: Record<string, unknown> = {
    bomLines: bomLines.map((line: any) => ({
      id: line.id,
      description: line.description,
      type: line.type,
      package: line.package,
      references: line.references,
      quantity: line.quantity,
      comment: line.comment,
      manufacturers: line.manufacturers,
      extra: line.extra,
    })),
  }

  if (Array.isArray(existingGroups) && existingGroups.length > 0) {
    userPayload.existingGroups = existingGroups.map((g: any) => g?.name).filter(Boolean)
  }

  if (Array.isArray(smdPnpComponents) && smdPnpComponents.length > 0) {
    userPayload.smdPnpComponents = smdPnpComponents.slice(0, MAX_PNP_COMPONENTS).map((c: any) => ({
      designator: c.designator,
      value: c.value,
      package: c.package ?? c.cadPackage ?? c.matchedPackage,
      ...(c.description ? { description: c.description } : {}),
    }))
  }

  if (Array.isArray(thtPnpComponents) && thtPnpComponents.length > 0) {
    userPayload.thtPnpComponents = thtPnpComponents.slice(0, MAX_PNP_COMPONENTS).map((c: any) => ({
      designator: c.designator,
      value: c.value,
      package: c.package ?? c.cadPackage ?? c.matchedPackage,
      ...(c.description ? { description: c.description } : {}),
    }))
  }

  const userContent = `Analyze and enrich this BOM data:\n\n${JSON.stringify(userPayload)}`

  try {
    const response = await $fetch<any>('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: {
        model,
        max_tokens: 16384,
        temperature: 0,
        system: [{ type: 'text', text: systemPrompt }],
        messages: [
          { role: 'user', content: userContent },
        ],
      },
    })

    const textBlock = response?.content?.find((b: any) => b.type === 'text')
    if (!textBlock?.text) {
      throw createError({ statusCode: 502, statusMessage: 'No text response from AI' })
    }

    const raw = textBlock.text.trim()
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw createError({ statusCode: 502, statusMessage: 'AI response is not valid JSON' })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    } catch {
      throw createError({ statusCode: 502, statusMessage: 'AI response contains malformed JSON' })
    }

    const suggestions = sanitizeSuggestions(parsed)
    return { suggestions }
  } catch (err: any) {
    if (err.__h3_error__) throw err

    const anthropicError = err?.data?.error?.message ?? err?.data?.message ?? null
    const status = err?.statusCode ?? err?.status ?? 502

    console.error('[Spark] Anthropic API error:', {
      status,
      anthropicError,
      message: err?.message,
    })

    throw createError({
      statusCode: status === 401 || status === 403 ? status : 502,
      statusMessage: status === 401 || status === 403 ? 'Invalid API key' : 'AI enrichment failed',
      data: { message: anthropicError ?? err?.message ?? 'Unknown error' },
    })
  }
})
