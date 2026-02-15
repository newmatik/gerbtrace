/**
 * Parse .pck text into structured PckRecord objects.
 *
 * Each record is delimited by '#' in the input text.
 * All dimensional values are converted from µm to mm.
 * Angles remain in millidegrees.
 */

/**
 * @typedef {Object} PckLeadGroup
 * @property {string} shape - CHIP, GULLWING, FLAT, J_LEAD, BGAB, OUTLINE
 * @property {number} numLeads
 * @property {number} param1 - distance from center (um in file, stored as mm)
 * @property {number} param2 - ccHalf or rowY (um in file, stored as mm)
 * @property {number} angle - millidegrees
 * @property {string} type - NORMAL
 */

/**
 * @typedef {Object} PckPadDimensions
 * @property {number} padW - mm
 * @property {number} padWmax - mm
 * @property {number} padWmin - mm
 * @property {number} padL - mm
 * @property {number} padLmax - mm
 * @property {number} padLmin - mm
 * @property {number} ccDist - mm
 * @property {number} leadW - mm
 * @property {number} leadWmax - mm
 * @property {number} param
 */

/**
 * @typedef {Object} PckCenteringPhase
 * @property {string} method - OPTICAL | MECHANICAL
 * @property {string[]} [tools] - Z_TOOL, HYDRA_TOOL
 * @property {{ angle: number, param: number, position: string, force: string }} [mechanical]
 * @property {{ nominal: number, max: number, min: number }} [jaw]
 */

/**
 * @typedef {Object} PckRecord
 * @property {string} name
 * @property {string} type - PT_TWO_POLE, PT_THREE_POLE, etc.
 * @property {{ x: number, y: number }} body - mm
 * @property {{ x: number, y: number }} searchArea - mm
 * @property {{ nominal: number, max: number, min: number }} height - mm
 * @property {{ x: number, y: number }} centerOffset - mm
 * @property {{ nozzle: string, params: number[], flags: boolean[] }} nozzle
 * @property {{ flag: string, levels: string[], params: number[], hydraFinePitch: boolean }} accuracy
 * @property {{ mode: string, heads: string[] }} headAssignment
 * @property {number[]} pinNumbering
 * @property {{ group: PckLeadGroup, pad: PckPadDimensions, lighting: { brightness: string, mode1: string, mode2: string } }[]} leadGroups
 * @property {PckCenteringPhase[]} centering
 * @property {string[]} visionModes071
 * @property {string[]} visionModes073
 * @property {boolean} coplanarity
 * @property {{ mode: string, matching: string, positions: Array<{ x: number, y: number, param1: number, param2: number }> }} glue
 * @property {Array<{ x: number, y: number, dotType: string }>} markingPositions
 */

const um2mm = (v) => Number(v) / 1000

/**
 * Parse a single .pck record text (lines between # delimiters) into a PckRecord.
 * @param {string} text - Text of a single record
 * @returns {PckRecord}
 */
export function parsePckRecord(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  /** @type {PckRecord} */
  const record = {
    name: '',
    type: '',
    body: { x: 0, y: 0 },
    searchArea: { x: 0, y: 0 },
    height: { nominal: 0, max: 0, min: 0 },
    centerOffset: { x: 0, y: 0 },
    nozzle: { nozzle: '', params: [], flags: [] },
    accuracy: { flag: '', levels: [], params: [], hydraFinePitch: false },
    headAssignment: { mode: 'AUTO', heads: [] },
    pinNumbering: [],
    leadGroups: [],
    centering: [],
    visionModes071: [],
    visionModes073: [],
    coplanarity: false,
    glue: { mode: 'NONE', matching: 'STANDARD', positions: [] },
    markingPositions: [],
  }

  // Track current lead group being built (P051 + P054 + P055 triplet)
  let pendingLeadGroup = null
  let pendingLighting = null

  for (const line of lines) {
    const parts = line.split(/\s+/)
    const field = parts[0]

    if (field === 'P00') {
      record.name = parts.slice(1).join(' ')
    } else if (field === 'P000') {
      record.type = parts[1]
    } else if (field === 'P01') {
      const nums = parts.slice(1).map(Number)
      record.body = { x: um2mm(nums[0] ?? 0), y: um2mm(nums[1] ?? 0) }
      record.searchArea = { x: um2mm(nums[2] ?? 0), y: um2mm(nums[3] ?? 0) }
      record.height = {
        nominal: um2mm(nums[4] ?? 0),
        max: um2mm(nums[5] ?? 0),
        min: um2mm(nums[6] ?? 0),
      }
    } else if (field === 'P011') {
      record.centerOffset = { x: um2mm(Number(parts[1] ?? 0)), y: um2mm(Number(parts[2] ?? 0)) }
    } else if (field === 'P022') {
      record.nozzle = {
        nozzle: parts[1] ?? '',
        params: parts.slice(2, 9).map(Number),
        flags: parts.slice(9).map((v) => v === 'true'),
      }
    } else if (field === 'P03') {
      record.accuracy = {
        flag: parts[1] ?? 'false',
        levels: [parts[2], parts[3], parts[4], parts[6], parts[7], parts[8], parts[11]].filter(Boolean),
        params: [Number(parts[9] ?? 0), Number(parts[10] ?? 0)],
        hydraFinePitch: parts[5] === 'true',
      }
    } else if (field === 'P032-1') {
      record.headAssignment.mode = parts[1] ?? 'AUTO'
    } else if (field === 'P032-2') {
      record.headAssignment.heads.push(parts[1] ?? '')
    } else if (field === 'P04') {
      record.pinNumbering = parts.slice(1).map(Number).filter((n) => n !== 0)
    } else if (field === 'P051') {
      // Flush any pending lead group
      if (pendingLeadGroup) {
        record.leadGroups.push({
          group: pendingLeadGroup,
          pad: null,
          lighting: pendingLighting,
        })
      }
      pendingLeadGroup = {
        shape: parts[1] ?? 'GULLWING',
        numLeads: Number(parts[2] ?? 0),
        param1: um2mm(Number(parts[3] ?? 0)),
        param2: um2mm(Number(parts[4] ?? 0)),
        angle: Number(parts[5] ?? 0),
        type: parts[6] ?? 'NORMAL',
      }
      pendingLighting = null
    } else if (field === 'P054') {
      pendingLighting = {
        brightness: parts[1] ?? 'BRIGHT',
        mode1: parts[2] ?? 'AUTO',
        mode2: parts[3] ?? 'AUTO',
      }
    } else if (field === 'P055') {
      const nums = parts.slice(1).map(Number)
      const pad = {
        padW: um2mm(nums[0] ?? 0),
        padWmax: um2mm(nums[1] ?? 0),
        padWmin: um2mm(nums[2] ?? 0),
        padL: um2mm(nums[3] ?? 0),
        padLmax: um2mm(nums[4] ?? 0),
        padLmin: um2mm(nums[5] ?? 0),
        ccDist: um2mm(nums[6] ?? 0),
        leadW: um2mm(nums[7] ?? 0),
        leadWmax: um2mm(nums[8] ?? 0),
        param: nums[9] ?? 0,
      }
      if (pendingLeadGroup) {
        record.leadGroups.push({
          group: pendingLeadGroup,
          pad,
          lighting: pendingLighting,
        })
        pendingLeadGroup = null
        pendingLighting = null
      }
    } else if (field === 'P061') {
      record.centering.push({ method: parts[1] ?? 'OPTICAL', tools: [] })
    } else if (field === 'P062-M') {
      const last = record.centering[record.centering.length - 1]
      if (last) {
        last.mechanical = {
          angle: Number(parts[1] ?? 0),
          param: Number(parts[2] ?? 0),
          position: parts[3] ?? 'POS_MIDDLE',
          force: parts[4] ?? 'MIDDLE_FORCE',
        }
      }
    } else if (field === 'P063') {
      const last = record.centering[record.centering.length - 1]
      if (last) {
        last.jaw = {
          nominal: um2mm(Number(parts[1] ?? 0)),
          max: um2mm(Number(parts[2] ?? 0)),
          min: um2mm(Number(parts[3] ?? 0)),
        }
      }
    } else if (field === 'P064-O') {
      const last = record.centering[record.centering.length - 1]
      if (last) {
        if (!last.tools) last.tools = []
        last.tools.push(parts[1] ?? 'Z_TOOL')
      }
    } else if (field === 'P07') {
      record.coplanarity = parts[1] === 'true'
    } else if (field === 'P071') {
      const mode = line.match(/"([^"]+)"/)
      if (mode) record.visionModes071.push(mode[1])
    } else if (field === 'P073') {
      const mode = line.match(/"([^"]+)"/)
      if (mode) record.visionModes073.push(mode[1])
    } else if (field === 'P08') {
      record.glue.mode = parts[1] ?? 'NONE'
    } else if (field === 'P083') {
      record.glue.matching = parts[1] ?? 'STANDARD'
    } else if (field === 'P084') {
      record.glue.positions.push({
        x: um2mm(Number(parts[1] ?? 0)),
        y: um2mm(Number(parts[2] ?? 0)),
        param1: Number(parts[3] ?? 0),
        param2: Number(parts[4] ?? 0),
      })
    } else if (field === 'P09') {
      record.markingPositions.push({
        x: um2mm(Number(parts[1] ?? 0)),
        y: um2mm(Number(parts[2] ?? 0)),
        dotType: parts[3] ?? '',
      })
    }
    // Skip P11, P12, P121, P122 — reference points and images
  }

  // Flush any remaining pending lead group
  if (pendingLeadGroup) {
    record.leadGroups.push({
      group: pendingLeadGroup,
      pad: null,
      lighting: pendingLighting,
    })
  }

  return record
}

/**
 * Parse a complete .pck file (potentially containing multiple records) into an array.
 * @param {string} fileText - Full .pck file text
 * @returns {PckRecord[]}
 */
export function parsePckFile(fileText) {
  // Split on '#' delimiter (records are separated by # on its own line)
  const records = fileText.split(/\n#\s*\n|^#\s*$/m)
  return records
    .map((r) => r.trim())
    .filter(Boolean)
    .filter((r) => r.startsWith('P00'))
    .map(parsePckRecord)
}

/**
 * Map P03 accuracy level keywords to our AccLevel type strings.
 * @param {string} level - e.g. ACC_LOWEST, ACC_LOW, ACC_HIGH, ACC_HIGHEST
 * @returns {string}
 */
export function mapAccLevel(level) {
  const map = {
    ACC_LOWEST: 'lowest',
    ACC_LOW: 'low',
    ACC_HIGH: 'high',
    ACC_HIGHEST: 'highest',
  }
  return map[level] ?? 'high'
}
