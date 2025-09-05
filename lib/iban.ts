const A = 'A'.charCodeAt(0)
export function isValidIBAN(iban?: string | null) {
  if (!iban) return true; // opcional
  const s = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(s)) return false
  const rearr = s.slice(4) + s.slice(0, 4)
  const digits = rearr.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - A + 10).toString())
  // mod 97
  let rem = 0
  for (let i = 0; i < digits.length; i += 7) {
    const block = (rem.toString() + digits.slice(i, i + 7))
    rem = parseInt(block, 10) % 97
  }
  return rem === 1
}
