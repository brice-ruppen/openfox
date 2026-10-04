import { z } from 'zod'
import { logger } from '../utils/logger.js'

const tokenLimit = z.number().int().positive().nullish()
const modelInfoSchema = z.object({
  max_input_tokens: tokenLimit,
  supports_vision: z.boolean().nullish(),
})
const modelSchema = modelInfoSchema.extend({
  id: z.string().min(1),
  max_model_len: tokenLimit,
  context_length: tokenLimit,
  capabilities: z.object({ vision: z.boolean().optional() }).nullish(),
  input_modalities: z.array(z.string()).nullish(),
  architecture: z.object({ input_modalities: z.array(z.string()).optional() }).nullish(),
})
const infoEntrySchema = z.object({ model_name: z.string(), model_info: modelInfoSchema })
const listingSchema = z.object({ data: z.array(z.unknown()) })

export interface BackendModelMetadata {
  id: string
  contextWindow: number | undefined
  supportsVision?: boolean | undefined
}

async function readListing(url: string, headers: Record<string, string>): Promise<unknown> {
  try {
    const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(10000) })
    if (!response.ok) {
      logger.debug('Model metadata endpoint unavailable', { url, status: response.status })
      return undefined
    }
    return await response.json()
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof DOMException || error instanceof SyntaxError)) throw error
    logger.debug('Model metadata request failed', { url, error: error.message })
    return undefined
  }
}

/** Read OpenAI listings, enriching LiteLLM-shaped responses with scoped model info. */
export async function fetchOpenAiModelMetadata(url: string, apiKey?: string): Promise<BackendModelMetadata[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const listing = listingSchema.safeParse(await readListing(url, headers))
  if (!listing.success) {
    logger.debug('Model listing has no valid data array', { url })
    return []
  }
  const entries = listing.data.data.flatMap((row) => {
    const parsed = modelSchema.safeParse(row)
    if (!parsed.success) {
      logger.debug('Skipping invalid model metadata', { url })
      return []
    }
    return [parsed.data]
  })
  const models = entries.map((entry): BackendModelMetadata => {
    const modalities = entry.input_modalities ?? entry.architecture?.input_modalities
    const vision = entry.supports_vision ?? entry.capabilities?.vision ?? modalities?.includes('image')
    return {
      id: entry.id,
      contextWindow: entry.max_model_len ?? entry.context_length ?? entry.max_input_tokens ?? undefined,
      ...(vision !== undefined ? { supportsVision: vision } : {}),
    }
  })
  // Standard OpenAI/vLLM servers do not have this LiteLLM extension. Probe it
  // only when the listing exposes LiteLLM's input-limit field and lacks vision.
  if (
    !entries.some((entry) => Object.hasOwn(entry, 'max_input_tokens')) ||
    !models.some((model) => model.supportsVision === undefined)
  )
    return models

  const infoUrl = url.replace(/\/models\/?$/, '/model/info')
  const infoListing = listingSchema.safeParse(await readListing(infoUrl, headers))
  if (!infoListing.success) {
    logger.debug('Optional LiteLLM metadata has no valid data array', { url: infoUrl })
    return models
  }
  const info = new Map(
    infoListing.data.data.flatMap((row) => {
      const parsed = infoEntrySchema.safeParse(row)
      if (!parsed.success) {
        logger.debug('Skipping invalid LiteLLM model info', { url: infoUrl })
        return []
      }
      return [[parsed.data.model_name, parsed.data.model_info] as const]
    }),
  )
  // Join only aliases already present in the authenticated model listing.
  // Never import provider parameters, keys, or extra models from model/info.
  return models.map((model) => {
    const metadata = info.get(model.id)
    const vision = model.supportsVision ?? metadata?.supports_vision ?? undefined
    return {
      ...model,
      contextWindow: model.contextWindow ?? metadata?.max_input_tokens ?? undefined,
      ...(vision !== undefined ? { supportsVision: vision } : {}),
    }
  })
}
