/**
 * Gerber RS-274X parser
 *
 * Converts tokenized Gerber text into a typed AST. Handles:
 * - Format specification (%FS...)
 * - Units (%MO...)
 * - Aperture definitions (%AD...)
 * - Aperture macros (%AM...)
 * - Load polarity (%LP...)
 * - Step and repeat (%SR...)
 * - G-codes, D-codes, coordinates
 * - Gerber X2 attributes (TF, TA, TO, TD) - stored as unimplemented
 */

import type {
  GerberAST,
  ASTNode,
  ToolShape,
  HoleShape,
  Format,
  ZeroSuppression,
  CoordMode,
} from './types'
import { tokenizeGerber, parseCoordAxes, type Token } from './tokenizer'
import { parseMacroBody } from './macro'

export function parseGerberSource(source: string): GerberAST {
  const tokens = tokenizeGerber(source)
  const children: ASTNode[] = []

  let i = 0

  while (i < tokens.length) {
    const token = tokens[i]!
    const ss = token.sourceStart
    const se = token.sourceEnd

    switch (token.type) {
      case 'extended':
        parseExtendedCommand(token.value, children, ss, se)
        break

      case 'gcode':
        parseGCode(token.value, children, ss, se)
        break

      case 'mcode':
        if (token.value === '00' || token.value === '02') {
          children.push({ type: 'done', sourceStart: ss, sourceEnd: se })
        }
        break

      case 'dcode': {
        const dVal = token.value
        if (dVal === '01') {
          // Interpolate - look back for coordinate
          const prev = findPrevCoord(children)
          if (prev) {
            prev.graphic = 'segment'
            prev.sourceEnd = se
          } else {
            children.push({ type: 'graphic', graphic: 'segment', coordinates: {}, sourceStart: ss, sourceEnd: se })
          }
        } else if (dVal === '02') {
          const prev = findPrevCoord(children)
          if (prev) {
            prev.graphic = 'move'
            prev.sourceEnd = se
          } else {
            children.push({ type: 'graphic', graphic: 'move', coordinates: {}, sourceStart: ss, sourceEnd: se })
          }
        } else if (dVal === '03') {
          const prev = findPrevCoord(children)
          if (prev) {
            prev.graphic = 'shape'
            prev.sourceEnd = se
          } else {
            children.push({ type: 'graphic', graphic: 'shape', coordinates: {}, sourceStart: ss, sourceEnd: se })
          }
        }
        break
      }

      case 'toolSelect':
        children.push({ type: 'toolChange', code: token.value, sourceStart: ss, sourceEnd: se })
        break

      case 'coord': {
        const axes = parseCoordAxes(token.value)
        children.push({ type: 'graphic', coordinates: axes, sourceStart: ss, sourceEnd: se })
        break
      }

      case 'comment':
        children.push({ type: 'comment', text: token.value, sourceStart: ss, sourceEnd: se })
        break
    }

    i++
  }

  return { type: 'root', filetype: 'gerber', children }
}

function findPrevCoord(children: ASTNode[]): (ASTNode & { type: 'graphic'; graphic?: string; sourceEnd?: number }) | null {
  for (let i = children.length - 1; i >= 0; i--) {
    const node = children[i]!
    if (node.type === 'graphic' && node.graphic === undefined) {
      return node as ASTNode & { type: 'graphic'; graphic?: string; sourceEnd?: number }
    }
    break // Only check the very last node
  }
  return null
}

function parseExtendedCommand(cmd: string, nodes: ASTNode[], ss: number, se: number): void {
  // Format specification: FSLAX24Y24 or FSTAX34Y34
  if (cmd.startsWith('FS')) {
    parseFormatSpec(cmd, nodes, ss, se)
    return
  }

  // Units: MOIN or MOMM
  if (cmd.startsWith('MO')) {
    const units = cmd.slice(2).toUpperCase()
    nodes.push({ type: 'units', units: units === 'IN' ? 'in' : 'mm', sourceStart: ss, sourceEnd: se })
    return
  }

  // Aperture definition: ADD{code}{shape},{params}
  if (cmd.startsWith('AD')) {
    parseApertureDef(cmd.slice(2), nodes, ss, se)
    return
  }

  // Aperture macro: AM{name}*{body}
  if (cmd.startsWith('AM')) {
    parseApertureMacro(cmd.slice(2), nodes, ss, se)
    return
  }

  // Load polarity: LPD or LPC
  if (cmd.startsWith('LP')) {
    const pol = cmd[2]
    nodes.push({ type: 'polarity', polarity: pol === 'D' ? 'dark' : 'clear', sourceStart: ss, sourceEnd: se })
    return
  }

  // Step and repeat: SRX{n}Y{n}I{n}J{n}
  if (cmd.startsWith('SR')) {
    parseStepRepeat(cmd.slice(2), nodes, ss, se)
    return
  }

  // Layer name (LN), Layer polarity (LP already handled), image params
  // X2 attributes: TF, TA, TO, TD
  if (/^(TF|TA|TO|TD|LN|IF|IP|IR|AS|OF|SF|IJ|IN|IO|KO)/.test(cmd)) {
    nodes.push({ type: 'unimplemented', value: cmd, sourceStart: ss, sourceEnd: se })
    return
  }

  // Unknown extended command
  nodes.push({ type: 'unimplemented', value: cmd, sourceStart: ss, sourceEnd: se })
}

function parseFormatSpec(cmd: string, nodes: ASTNode[], ss: number, se: number): void {
  let format: Format | undefined
  let zeroSuppression: ZeroSuppression | undefined
  let mode: CoordMode | undefined

  // Parse zero suppression: L = leading, T = trailing
  if (cmd.includes('L')) zeroSuppression = 'leading'
  else if (cmd.includes('T')) zeroSuppression = 'trailing'

  // Parse mode: A = absolute, I = incremental
  if (cmd.includes('A')) mode = 'absolute'
  else if (cmd.includes('I')) mode = 'incremental'

  // Parse format: X{int}{dec}Y{int}{dec}
  const formatMatch = cmd.match(/X(\d)(\d)/)
  if (formatMatch) {
    format = [parseInt(formatMatch[1]), parseInt(formatMatch[2])]
  }

  nodes.push({ type: 'format', format, zeroSuppression, mode, sourceStart: ss, sourceEnd: se })
}

function parseApertureDef(cmd: string, nodes: ASTNode[], ss: number, se: number): void {
  // D{code}{shape},{params}
  // Examples: D10C,0.0100 or D11R,0.060X0.060 or D70CUSTOM,0.5
  const match = cmd.match(/^D(\d+)([A-Za-z][A-Za-z0-9_]*)(?:,(.+))?$/)
  if (!match) return

  const code = `D${match[1]}`
  const shapeName = match[2].toUpperCase()
  const paramStr = match[3] || ''
  const allParams = paramStr.split('X').map(Number).filter(n => !isNaN(n))

  let shape: ToolShape
  let hole: HoleShape | undefined

  switch (shapeName) {
    case 'C': {
      // Circle: diameter[,holeDiam]
      shape = { type: 'circle', params: [allParams[0] || 0] }
      if (allParams.length > 1 && allParams[1] > 0) {
        hole = { type: 'circle', params: [allParams[1]] }
      }
      break
    }
    case 'R': {
      // Rectangle: xSize,ySize[,holeDiam]
      shape = { type: 'rectangle', params: [allParams[0] || 0, allParams[1] || 0] }
      if (allParams.length > 2 && allParams[2] > 0) {
        hole = { type: 'circle', params: [allParams[2]] }
      }
      break
    }
    case 'O': {
      // Obround: xSize,ySize[,holeDiam]
      shape = { type: 'obround', params: [allParams[0] || 0, allParams[1] || 0] }
      if (allParams.length > 2 && allParams[2] > 0) {
        hole = { type: 'circle', params: [allParams[2]] }
      }
      break
    }
    case 'P': {
      // Polygon: outerDiam,vertices[,rotation[,holeDiam]]
      shape = { type: 'polygon', params: allParams.slice(0, 3) }
      if (allParams.length > 3 && allParams[3] > 0) {
        hole = { type: 'circle', params: [allParams[3]] }
      }
      break
    }
    default: {
      // Macro shape reference
      shape = { type: 'macroShape', params: allParams, macroName: shapeName }
      break
    }
  }

  nodes.push({ type: 'toolDef', code, shape, hole, sourceStart: ss, sourceEnd: se })
}

function parseApertureMacro(cmd: string, nodes: ASTNode[], ss: number, se: number): void {
  // First part before * is the name, rest is the body
  const firstStar = cmd.indexOf('*')
  if (firstStar < 0) {
    // Name-only macro (unlikely but handle gracefully)
    nodes.push({ type: 'toolMacro', name: cmd.trim(), blocks: [], sourceStart: ss, sourceEnd: se })
    return
  }

  const name = cmd.slice(0, firstStar).trim()
  const body = cmd.slice(firstStar + 1)
  const blocks = parseMacroBody(body)

  nodes.push({ type: 'toolMacro', name, blocks, sourceStart: ss, sourceEnd: se })
}

function parseStepRepeat(cmd: string, nodes: ASTNode[], ss: number, se: number): void {
  const xMatch = cmd.match(/X(\d+)/)
  const yMatch = cmd.match(/Y(\d+)/)
  const iMatch = cmd.match(/I([\d.]+)/)
  const jMatch = cmd.match(/J([\d.]+)/)

  nodes.push({
    type: 'stepRepeat',
    x: xMatch ? parseInt(xMatch[1]) : 1,
    y: yMatch ? parseInt(yMatch[1]) : 1,
    i: iMatch ? parseFloat(iMatch[1]) : 0,
    j: jMatch ? parseFloat(jMatch[1]) : 0,
    sourceStart: ss,
    sourceEnd: se,
  })
}

function parseGCode(code: string, nodes: ASTNode[], ss: number, se: number): void {
  switch (code) {
    case '01':
      nodes.push({ type: 'interpolateMode', mode: 'line', sourceStart: ss, sourceEnd: se })
      break
    case '02':
      nodes.push({ type: 'interpolateMode', mode: 'cwArc', sourceStart: ss, sourceEnd: se })
      break
    case '03':
      nodes.push({ type: 'interpolateMode', mode: 'ccwArc', sourceStart: ss, sourceEnd: se })
      break
    case '36':
      nodes.push({ type: 'regionMode', region: true, sourceStart: ss, sourceEnd: se })
      break
    case '37':
      nodes.push({ type: 'regionMode', region: false, sourceStart: ss, sourceEnd: se })
      break
    case '70':
      nodes.push({ type: 'units', units: 'in', sourceStart: ss, sourceEnd: se })
      break
    case '71':
      nodes.push({ type: 'units', units: 'mm', sourceStart: ss, sourceEnd: se })
      break
    case '74':
      nodes.push({ type: 'quadrantMode', quadrant: 'single', sourceStart: ss, sourceEnd: se })
      break
    case '75':
      nodes.push({ type: 'quadrantMode', quadrant: 'multi', sourceStart: ss, sourceEnd: se })
      break
    case '54':
      // Deprecated tool select prefix, ignore (the D-code follows)
      break
    case '90':
      // Deprecated absolute mode
      break
    case '91':
      // Deprecated incremental mode
      break
    default:
      nodes.push({ type: 'unimplemented', value: `G${code}`, sourceStart: ss, sourceEnd: se })
  }
}
