import type { Request } from 'express'

export interface UploadedFile {
  bytes: Buffer
  type: string
  name: string
}

export interface FormFields {
  text(name: string): string | null
  file(name: string): Promise<UploadedFile | null>
}

/** Parses a multipart/form-data (or urlencoded) request body from its raw bytes. */
export async function formData(req: Request): Promise<FormFields> {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
  let fd: FormData
  try {
    fd = await new Response(new Uint8Array(raw), {
      headers: { 'content-type': String(req.headers['content-type'] ?? '') },
    }).formData()
  } catch {
    fd = new FormData()
  }
  return {
    text(name) {
      const v = fd.get(name)
      return typeof v === 'string' ? v : null
    },
    async file(name) {
      const v = fd.get(name)
      if (v === null || typeof v === 'string') return null
      return { bytes: Buffer.from(await v.arrayBuffer()), type: v.type, name: v.name }
    },
  }
}
