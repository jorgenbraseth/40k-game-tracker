/** Guards against rendering a free-text URL field as a clickable `<a href>` unless it's actually an
 * http(s) link -- a `javascript:` URI or similar stored there (by a bug, or a malicious
 * participant on a field like `game_players.army_list_url`, which is free text and never
 * re-validated as any particular provider's link format) should never become clickable. */
export function isSafeExternalUrl(url: string | null | undefined): url is string {
  return url != null && /^https?:\/\//i.test(url)
}
