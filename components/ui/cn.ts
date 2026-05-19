// Phase 4 decision: tiny local `cn` helper — avoids pulling in clsx/tailwind-merge for ~10 lines of behavior.
type Value = string | number | false | null | undefined

export function cn(...inputs: Array<Value | Value[]>): string {
  const out: string[] = []
  for (const v of inputs) {
    if (Array.isArray(v)) {
      for (const x of v) if (x) out.push(String(x))
    } else if (v) {
      out.push(String(v))
    }
  }
  return out.join(' ')
}
