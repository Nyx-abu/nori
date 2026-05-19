// P3 decision: domain extraction happens server-side (e.g. in shapeTool, /api/search route). Clients only consume the resolved domain string; URL parsing never runs on the client.

export function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function getClearbitLogoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`
}

export function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
}
