import type { UdevRule } from '../shared/types.js'

export function renderUdevRule(rule: UdevRule, comment?: string): string {
  const lines: string[] = []
  if (comment) lines.push(`# ${comment}`)
  const filters: string[] = []
  if (rule.matchVendor) filters.push(`ATTRS{idVendor}=="${rule.matchVendor}"`)
  if (rule.matchProduct) filters.push(`ATTRS{idProduct}=="${rule.matchProduct}"`)
  if (rule.matchSerial) filters.push(`ATTRS{serial}=="${rule.matchSerial}"`)
  const env = filters.join(', ')
  lines.push(`SUBSYSTEM=="tty", ${env}, SYMLINK+="${rule.symlink}", MODE="0660", GROUP="dialout"`)
  return lines.join('\n') + '\n'
}

export function renderUdevRulesFile(rules: UdevRule[]): string {
  return rules.map((r, i) => renderUdevRule(r, `envctrl rule ${i + 1}`)).join('\n')
}