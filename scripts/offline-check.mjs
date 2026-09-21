export function assertNoExternalActiveResources(template, cssSource, appScripts) {
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=\s*["'](?:https?:)?\/\/|\b(?:src|href)\s*=\s*["'](?:https?:)?\/\//i.test(template)) {
    throw new Error('External active HTML resource');
  }
  const css = cssSource.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\/|url\(\s*["']?(?:https?:)?\/\//i.test(css)) {
    throw new Error('External active CSS resource');
  }
  if (/\b(?:fetch|sendBeacon)\s*\(\s*["'`](?:https?:)?\/\/|\bimport\s*\(\s*["'`](?:https?:)?\/\//i.test(appScripts)) {
    throw new Error('External active application request');
  }
}
