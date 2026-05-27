import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const clientSrc = fileURLToPath(new URL('../', import.meta.url))
const removedFeaturePatterns = [
  new RegExp('good[-_]?buy', 'i'),
  new RegExp('good\\s+buy', 'i'),
]

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return sourceFiles(path)
    if (path.endsWith('removedAdminFeatureReferences.test.mjs')) return []
    return /\.(mjs|ts|tsx)$/.test(path) ? [path] : []
  })
}

test('removed admin feature has no client source references', () => {
  const matches = []
  for (const file of sourceFiles(clientSrc)) {
    const text = readFileSync(file, 'utf8')
    for (const pattern of removedFeaturePatterns) {
      if (pattern.test(text)) {
        matches.push(relative(clientSrc, file))
        break
      }
    }
  }

  assert.deepEqual(matches, [])
})
