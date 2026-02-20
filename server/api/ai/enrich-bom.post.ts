export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { apiKey, model, bomLines, smdPnpComponents, thtPnpComponents } = body ?? {}

  if (!apiKey || typeof apiKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing apiKey' })
  }
  if (!model || typeof model !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing model' })
  }
  if (!Array.isArray(bomLines) || bomLines.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or empty bomLines' })
  }

  const systemPrompt = `You are Spark, an expert electronics manufacturing AI assistant specializing in BOM (Bill of Materials) enrichment for PCB assembly.

Your task is to analyze BOM lines and improve them. You receive BOM data along with SMD and THT Pick & Place component lists for cross-referencing.

For each BOM line, suggest improvements where applicable:

1. **Description**: Improve the description to be professional and standardized. Include value, voltage rating, tolerance, and package size where inferable from context (references, package, existing description, additional data fields). Examples:
   - "100nF 50V X7R Ceramic Capacitor 0402" instead of "Cap 100n"
   - "10kΩ 1% 0.1W Thick Film Resistor 0603" instead of "RES 10K"
   - "STM32F407VGT6 ARM Cortex-M4 Microcontroller LQFP-100" instead of "MCU"

2. **Type**: Suggest SMD, THT, Mounting, or Other based on the component data and PnP cross-reference.

3. **Pin Count** (THT only): Suggest the pin count for through-hole components based on the package and description.

4. **SMD Classification** (SMD only): Classify SMD components into exactly one of:
   - "Fast" — chip packages like 0201, 0402, 0603, 0805, 1206, SOT-23, SOT-363, and similar small 2-6 terminal packages suitable for high-speed pick and place
   - "Slow" — larger packages (body >5mm on any side) like SO-8, SOIC-16, SSOP, TSSOP, QFP with standard pitch (≥0.5mm), connectors, electrolytic caps
   - "Finepitch" — packages with very fine pin pitch (<0.5mm) requiring microscope inspection, such as QFN with 0.4mm pitch, fine-pitch QFP, CSP
   - "BGA" — Ball Grid Array packages of any kind (BGA, µBGA, WLCSP, LGA with ball attach)

5. **Manufacturers** (standard passives only): For resistors and capacitors, suggest a specific manufacturer and manufacturer part number. Use well-known manufacturers:
   - Resistors: Yageo, Samsung Electro-Mechanics, Vishay, Panasonic, KOA Speer, TE Connectivity
   - Ceramic Capacitors: Samsung Electro-Mechanics, Murata, Yageo, TDK, Kemet
   - Electrolytic Capacitors: Panasonic, Nichicon, Murata, TDK
   Only suggest manufacturer part numbers you are confident are real, valid, currently-available part numbers. The part number must match the component's value, tolerance, voltage rating, and package size.

IMPORTANT: Only include fields where you have a meaningful suggestion that differs from the existing data. Do not echo back the same values. If a description is already good, omit it. If you cannot determine a field, omit it entirely.

Respond with a JSON object where keys are the BOM line IDs and values are objects with optional fields: description, type, pinCount, smdClassification, manufacturers (array of {manufacturer, manufacturerPart}).

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

  if (Array.isArray(smdPnpComponents) && smdPnpComponents.length > 0) {
    userPayload.smdPnpComponents = smdPnpComponents.map((c: any) => ({
      designator: c.designator,
      value: c.value,
      package: c.package ?? c.cadPackage ?? c.matchedPackage,
      description: c.description,
    }))
  }

  if (Array.isArray(thtPnpComponents) && thtPnpComponents.length > 0) {
    userPayload.thtPnpComponents = thtPnpComponents.map((c: any) => ({
      designator: c.designator,
      value: c.value,
      package: c.package ?? c.cadPackage ?? c.matchedPackage,
      description: c.description,
    }))
  }

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
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze and enrich this BOM data:\n\n${JSON.stringify(userPayload, null, 2)}`,
          },
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

    const suggestions = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return { suggestions }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({
      statusCode: 502,
      statusMessage: 'AI enrichment failed',
      data: { message: err?.message ?? 'Unknown error' },
    })
  }
})
