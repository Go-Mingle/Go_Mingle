/**
 * esbuild plugin: gives every mock data/handler module a state accessor.
 *
 * The portals keep their records in module-level variables (`export const
 * mockRoles = [...]`, `let tables = seedTables()`, `const inviteesByTable =
 * new Map()`). Without help those live only in memory, so a restart lost every
 * role, table and menu a user had created. At bundle time this plugin appends a
 * small registration block to each module under src/mocks that exposes its
 * top-level bindings (read, and write for `let`/`var`). The API snapshots them
 * after every change and restores them on start (src/state.js) — no change to
 * the portals' own code, and every store is covered, including ones added later.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const DECL = /^(?:export\s+)?(let|const|var)\s+([A-Za-z_$][\w$]*)\b/gm
const CONSTANT_NAME = /^[A-Z][A-Z0-9_]*$/

export function stateAccessorPlugin(portalDir) {
  const mocksDir = path.join(portalDir, 'src', 'mocks') + path.sep
  return {
    name: 'gm-state',
    setup(build) {
      build.onResolve({ filter: /^gm-state-registry$/ }, () => ({ path: 'gm-state-registry', namespace: 'gm-state' }))
      build.onLoad({ filter: /.*/, namespace: 'gm-state' }, () => ({
        loader: 'js',
        contents: `
export const stateModules = new Map()
export function __register(name, accessor) { stateModules.set(name, accessor) }
`,
      }))
      build.onLoad({ filter: /\.ts$/ }, (args) => {
        if (!args.path.startsWith(mocksDir) || args.path.includes(`${path.sep}__tests__${path.sep}`)) return undefined
        if (args.path.endsWith('.d.ts')) return undefined
        const source = readFileSync(args.path, 'utf8')
        const bindings = []
        for (const m of source.matchAll(DECL)) {
          const [, kind, name] = m
          // ALL_CAPS consts are fixed configuration, not records.
          if (kind === 'const' && CONSTANT_NAME.test(name)) continue
          if (!bindings.some((b) => b.name === name)) bindings.push({ kind, name })
        }
        if (bindings.length === 0) return undefined
        const rel = path.relative(mocksDir, args.path).split(path.sep).join('/')
        const writable = bindings.filter((b) => b.kind !== 'const')
        const block = `
import { __register as __gmRegister } from 'gm-state-registry'
__gmRegister(${JSON.stringify(rel)}, {
  read: () => ({ ${bindings.map((b) => `${JSON.stringify(b.name)}: ${b.name}`).join(', ')} }),
  write: (name, value) => {
    switch (name) {
${writable.map((b) => `      case ${JSON.stringify(b.name)}: ${b.name} = value; return true`).join('\n')}
      default: return false
    }
  },
})
`
        return { contents: source + block, loader: 'ts' }
      })
    },
  }
}
