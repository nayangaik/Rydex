import dotenv from 'dotenv'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const backendEnv = fileURLToPath(new URL('../../../.env', import.meta.url))
dotenv.config({ path: backendEnv })

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL is required. Set it in ${backendEnv} or the process environment.`)
}

const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url))
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2), '--schema=prisma/schema.prisma'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: process.env,
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
