import { Buffer } from 'buffer'

// Shelby's browser bundle currently references Buffer at runtime.
const browserGlobals = globalThis as typeof globalThis & { Buffer: typeof Buffer }
browserGlobals.Buffer = Buffer

const browserProcess = browserGlobals as typeof browserGlobals & {
  process: { env: Record<string, string | undefined> }
}
browserProcess.process = browserProcess.process ?? { env: {} }
