import { describe, it, expect } from 'vitest'
import { compileCondition } from '../../src/core/conditionParser.js'

describe('conditionParser', () => {
  it('handles true/false', () => {
    expect(compileCondition('true')(0)).toBe(true)
    expect(compileCondition('false')(1)).toBe(false)
  })

  it('compares numbers', () => {
    const f = compileCondition('value > 1000')
    expect(f(1001)).toBe(true)
    expect(f(1000)).toBe(false)
    expect(f(999)).toBe(false)
  })

  it('supports === and !== on strings', () => {
    expect(compileCondition(`value === 'high'`)(`high`)).toBe(true)
    expect(compileCondition(`value === 'high'`)(`low`)).toBe(false)
    expect(compileCondition(`value !== 'off'`)(`on`)).toBe(true)
  })

  it('supports && and ||', () => {
    expect(compileCondition(`value > 50 && value < 100`)(75)).toBe(true)
    expect(compileCondition(`value > 50 && value < 100`)(150)).toBe(false)
    expect(compileCondition(`value < 0 || value > 100`)(-5)).toBe(true)
  })

  it('supports parentheses and !', () => {
    expect(compileCondition(`!(value > 10)`)(5)).toBe(true)
    expect(compileCondition(`(value > 0) && (value < 10)`)(5)).toBe(true)
  })

  it('rejects identifiers beyond value/true/false', () => {
    expect(() => compileCondition('process.exit(1)')).toThrow()
    expect(() => compileCondition('require("fs")')).toThrow()
    expect(() => compileCondition('global')).toThrow()
  })

  it('rejects function calls and property access', () => {
    expect(() => compileCondition('value.constructor()')).toThrow()
    expect(() => compileCondition('eval("hi")')).toThrow()
  })
})