import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  // Fail loudly at startup rather than surfacing cryptic Supabase client
  // errors later -- this is almost always a missing .env file locally, or
  // a missing build secret in CI.
  throw new Error(
    `Missing/invalid environment variables: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}. Did you copy .env.example to .env?`,
  )
}

export const env = parsed.data
