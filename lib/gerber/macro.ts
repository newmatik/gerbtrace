/**
 * Aperture macro parser and evaluator
 *
 * Handles the macro mini-language: variable assignments, arithmetic
 * expressions, and primitive shape generation.
 */

import type { MacroValue, MacroBlock, MacroExpression } from './types'

/**
 * Parse a macro body string into macro blocks.
 * Macro body is a series of blocks separated by '*', each block is either:
 * - A comment: starts with '0 '
 * - A variable assignment: $N=expression
 * - A primitive: code,param,param,...
 */
export function parseMacroBody(body: string): MacroBlock[] {
  const blocks: MacroBlock[] = []
  const parts = body.split('*').map(s => s.trim()).filter(s => s.length > 0)

  for (const part of parts) {
    if (part.startsWith('0 ') || part.startsWith('0,')) {
      blocks.push({ type: 'comment', text: part.slice(2) })
      continue
    }

    if (part.includes('=') && part.startsWith('$')) {
      const eqIdx = part.indexOf('=')
      const name = part.slice(0, eqIdx).trim()
      const expr = part.slice(eqIdx + 1).trim()
      blocks.push({ type: 'variable', name, value: parseExpression(expr) })
      continue
    }

    // Primitive: code,param,param,...
    const params = part.split(',')
    const code = params[0].trim()
    const paramValues = params.slice(1).map(p => parseExpression(p.trim()))
    blocks.push({ type: 'primitive', code, params: paramValues })
  }

  return blocks
}

/**
 * Parse a macro arithmetic expression.
 * Supports: numbers, variables ($1, $2...), +, -, x (multiply), /
 */
export function parseExpression(expr: string): MacroValue {
  expr = expr.trim()
  if (expr === '') return 0

  // Try direct number
  if (/^[+-]?\d*\.?\d+$/.test(expr)) {
    return Number(expr)
  }

  // Variable reference
  if (/^\$\d+$/.test(expr)) {
    return expr
  }

  // Find the lowest-precedence operator (+ or -) scanning right to left
  // to handle left-to-right associativity
  let parenDepth = 0
  let splitIdx = -1
  let splitOp = ''

  // First pass: look for + or -
  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i]
    if (ch === ')') parenDepth++
    if (ch === '(') parenDepth--
    if (parenDepth === 0 && (ch === '+' || ch === '-') && i > 0) {
      // Make sure this isn't a sign (preceded by operator or start)
      const prev = expr[i - 1]
      if (prev !== 'x' && prev !== '/' && prev !== '(' && prev !== '+' && prev !== '-') {
        splitIdx = i
        splitOp = ch
        break
      }
    }
  }

  if (splitIdx >= 0) {
    const left = parseExpression(expr.slice(0, splitIdx))
    const right = parseExpression(expr.slice(splitIdx + 1))
    return { op: splitOp as '+' | '-', left, right }
  }

  // Second pass: look for x (multiply) or /
  parenDepth = 0
  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i]
    if (ch === ')') parenDepth++
    if (ch === '(') parenDepth--
    if (parenDepth === 0 && (ch === 'x' || ch === 'X' || ch === '/') && i > 0) {
      splitIdx = i
      splitOp = ch.toLowerCase() === 'x' ? 'x' : '/'
      break
    }
  }

  if (splitIdx >= 0) {
    const left = parseExpression(expr.slice(0, splitIdx))
    const right = parseExpression(expr.slice(splitIdx + 1))
    return { op: splitOp as 'x' | '/', left, right }
  }

  // Parenthesized expression
  if (expr.startsWith('(') && expr.endsWith(')')) {
    return parseExpression(expr.slice(1, -1))
  }

  // Fallback: try as number
  const num = Number(expr)
  if (!isNaN(num)) return num

  // Variable or unknown
  return expr
}

/**
 * Evaluate a macro expression with given variable values.
 */
export function evaluateExpression(
  expr: MacroValue,
  variables: Map<string, number>,
): number {
  if (typeof expr === 'number') return expr

  if (typeof expr === 'string') {
    if (expr.startsWith('$')) {
      return variables.get(expr) ?? 0
    }
    const num = Number(expr)
    return isNaN(num) ? 0 : num
  }

  // MacroExpression
  const left = evaluateExpression(expr.left, variables)
  const right = evaluateExpression(expr.right, variables)

  switch (expr.op) {
    case '+': return left + right
    case '-': return left - right
    case 'x': return left * right
    case '/': return right === 0 ? 0 : left / right
    default: return 0
  }
}
