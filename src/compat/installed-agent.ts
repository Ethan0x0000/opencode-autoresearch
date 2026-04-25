import { AUTORESEARCH_SORT_PREFIX, AUTORESEARCH_VISIBLE_NAME } from "./zero-width"

const CANONICAL_NAME_LINE = `name: ${AUTORESEARCH_VISIBLE_NAME}`
const INSTALLED_NAME_LINE = `name: ${AUTORESEARCH_SORT_PREFIX}${AUTORESEARCH_VISIBLE_NAME}`

export function renderInstalledAutoresearchAgent(packagedContent: string) {
  const installedContent = packagedContent.replace(/^name: autoresearch$/m, INSTALLED_NAME_LINE)
  if (installedContent === packagedContent) {
    throw new Error(`Packaged agent asset missing canonical frontmatter line: ${CANONICAL_NAME_LINE}`)
  }
  return installedContent
}
