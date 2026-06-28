/**
 * Token-whitelist condition evaluator for alarm rules.
 *
 * Supported grammar (after trimming):
 *   <expr>     := 'true' | 'false' | 'value'
 *               | <value> <op> <literal>
 *               | '(' <expr> ')'
 *               | '!' <expr>
 *               | <expr> ('&&' | '||') <expr>
 *   <op>       := '>' '<' '>=' '<=' '===' '!==' '==' '!='
 *   <literal>  := <number> | "'<string>'" | '"<string>"' | 'true' | 'false'
 *
 * Anything outside the grammar throws at compile time. No identifiers beyond
 * `value`/`true`/`false`. No property access. No function calls. No eval.
 */
const OPS = ['>=', '<=', '===', '!==', '==', '!=', '>', '<'] as const
type Op = (typeof OPS)[number]

function tokenize(src: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (/\s/.test(c)) { i++; continue }
    if (c === '(' || c === ')') { out.push(c); i++; continue }
    if (c === '&' && src[i + 1] === '&') { out.push('&&'); i += 2; continue }
    if (c === '|' && src[i + 1] === '|') { out.push('||'); i += 2; continue }
    if (c === '>') {
      if (src[i + 1] === '=') { out.push('>='); i += 2 }
      else { out.push('>'); i++ }
      continue
    }
    if (c === '<') {
      if (src[i + 1] === '=') { out.push('<='); i += 2 }
      else { out.push('<'); i++ }
      continue
    }
    if (c === '=') {
      if (src[i + 1] === '=' && src[i + 2] === '=') { out.push('==='); i += 3 }
      else if (src[i + 1] === '=') { out.push('=='); i += 2 }
      else throw new Error('unexpected = (use == or ===)')
      continue
    }
    if (c === '!') {
      if (src[i + 1] === '=' && src[i + 2] === '=') { out.push('!=='); i += 3 }
      else if (src[i + 1] === '=') { out.push('!='); i += 2 }
      else { out.push('!'); i++ }
      continue
    }
    if (c === "'" || c === '"') {
      const quote = c
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) { s += src[j + 1]!; j += 2 }
        else { s += src[j]!; j++ }
      }
      if (j >= src.length) throw new Error('unterminated string')
      out.push(`'${s}'`)
      i = j + 1
      continue
    }
    if (/[0-9.]/.test(c)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++
      out.push(src.slice(i, j))
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j++
      const id = src.slice(i, j)
      if (id !== 'value' && id !== 'true' && id !== 'false') {
        throw new Error(`forbidden identifier: ${id}`)
      }
      out.push(id)
      i = j
      continue
    }
    throw new Error(`unexpected char: ${c}`)
  }
  return out
}

function isOp(t: string | undefined): t is Op {
  return t !== undefined && (OPS as readonly string[]).includes(t)
}

class AlarmParser {
  private p = 0
  constructor(private t: string[]) {}
  private peek(): string | undefined { return this.t[this.p] }
  private eat(): string { return this.t[this.p++]! }

  parse(): (value: unknown) => boolean {
    const fn = this.parseExpr()
    if (this.p < this.t.length) throw new Error(`trailing: ${this.t[this.p]}`)
    return fn
  }
  private parseExpr(): (v: unknown) => boolean {
    let left = this.parseAnd()
    while (this.peek() === '||') {
      this.eat()
      const r = this.parseAnd()
      const prev = left
      left = (v) => Boolean(prev(v)) || Boolean(r(v))
    }
    return left
  }
  private parseAnd(): (v: unknown) => boolean {
    let left = this.parseCmp()
    while (this.peek() === '&&') {
      this.eat()
      const r = this.parseCmp()
      const prev = left
      left = (v) => Boolean(prev(v)) && Boolean(r(v))
    }
    return left
  }
  private parseCmp(): (v: unknown) => boolean {
    const lhsFn = this.parseAtom()
    const op = this.peek()
    if (isOp(op)) {
      this.eat()
      const rhs = this.parseLiteral()
      switch (op) {
        case '>':   return (v) => Number(lhsFn(v)) > Number(rhs)
        case '<':   return (v) => Number(lhsFn(v)) < Number(rhs)
        case '>=':  return (v) => Number(lhsFn(v)) >= Number(rhs)
        case '<=':  return (v) => Number(lhsFn(v)) <= Number(rhs)
        case '===': return (v) => lhsFn(v) === rhs
        case '!==': return (v) => lhsFn(v) !== rhs
        case '==':  return (v) => lhsFn(v) == rhs
        case '!=':  return (v) => lhsFn(v) != rhs
      }
    }
    return (v) => Boolean(lhsFn(v))
  }
  private parseAtom(): (v: unknown) => unknown {
    const t = this.peek()
    if (t === '(') {
      this.eat()
      const inner = this.parseExpr()
      if (this.eat() !== ')') throw new Error('expected )')
      return inner
    }
    if (t === '!') {
      this.eat()
      const inner = this.parseAtom()
      return (v) => !inner(v)
    }
    if (t === undefined) throw new Error('unexpected end')
    this.eat()
    if (t === 'value') return (v: unknown) => v
    if (t === 'true') return () => true
    if (t === 'false') return () => false
    // bare number / string — truthy literal
    const lit = this.literalValue(t)
    return () => lit
  }
  private parseLiteral(): unknown {
    const t = this.eat()
    return this.literalValue(t)
  }
  private literalValue(tok: string): unknown {
    if (tok.startsWith("'") && tok.endsWith("'")) return tok.slice(1, -1)
    if (tok === 'true') return true
    if (tok === 'false') return false
    const n = Number(tok)
    if (Number.isFinite(n)) return n
    throw new Error(`invalid literal: ${tok}`)
  }
}

export function compileCondition(expr: string): (value: unknown) => boolean {
  const trimmed = expr.trim()
  if (trimmed === 'true') return () => true
  if (trimmed === 'false') return () => false
  const tokens = tokenize(trimmed)
  return new AlarmParser(tokens).parse()
}