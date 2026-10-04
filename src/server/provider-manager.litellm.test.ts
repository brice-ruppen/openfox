import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchModelsWithContext } from './provider-manager.js'

const mockFetch = vi.fn()

describe('LiteLLM model discovery', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => vi.unstubAllGlobals())

  function response(data: unknown) {
    return { ok: true, json: async () => ({ data }) }
  }

  it('imports MiniMax context and vision from LiteLLM metadata with the same scoped key', async () => {
    const id = 'openrouter/minimax/minimax-m3'
    mockFetch
      .mockResolvedValueOnce(response([{ id, max_input_tokens: 1048576, max_output_tokens: 512000 }]))
      .mockResolvedValueOnce(
        response([{ model_name: id, model_info: { max_input_tokens: 1048576, supports_vision: true } }]),
      )

    const models = await fetchModelsWithContext('https://gateway.test/proxy/v1', 'fixture-key', 'unknown')
    expect(models).toEqual([{ id, contextWindow: 1048576, supportsVision: true, source: 'backend' }])
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://gateway.test/proxy/v1/model/info',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fixture-key' }) }),
    )
  })

  it('preserves explicit text-only capability from model info', async () => {
    mockFetch
      .mockResolvedValueOnce(response([{ id: 'glm', max_input_tokens: 1048576 }]))
      .mockResolvedValueOnce(response([{ model_name: 'glm', model_info: { supports_vision: false } }]))
    expect(await fetchModelsWithContext('https://gateway.test')).toEqual([
      { id: 'glm', contextWindow: 1048576, supportsVision: false, source: 'backend' },
    ])
  })

  it('keeps listing context if model info is forbidden without claiming vision', async () => {
    mockFetch
      .mockResolvedValueOnce(response([{ id: 'qwen', max_input_tokens: 131072 }]))
      .mockResolvedValueOnce({ ok: false, status: 403 })
    expect(await fetchModelsWithContext('https://gateway.test')).toEqual([
      { id: 'qwen', contextWindow: 131072, source: 'backend' },
    ])
  })

  it('does not import hidden models or credentials from the metadata endpoint', async () => {
    mockFetch.mockResolvedValueOnce(response([{ id: 'public-alias', max_input_tokens: 131072 }])).mockResolvedValueOnce(
      response([
        {
          model_name: 'public-alias',
          model_info: { supports_vision: true },
          litellm_params: { api_key: 'must-not-import' },
        },
        { model_name: 'hidden-alias', model_info: { max_input_tokens: 1048576, supports_vision: true } },
      ]),
    )
    expect(await fetchModelsWithContext('https://gateway.test')).toEqual([
      { id: 'public-alias', contextWindow: 131072, supportsVision: true, source: 'backend' },
    ])
  })

  it('preserves explicit false in a model listing without a metadata probe', async () => {
    mockFetch.mockResolvedValueOnce(response([{ id: 'text-only', context_length: 32768, supports_vision: false }]))
    expect(await fetchModelsWithContext('https://backend.test')).toEqual([
      { id: 'text-only', contextWindow: 32768, supportsVision: false, source: 'backend' },
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('understands OpenRouter architecture modalities without a LiteLLM probe', async () => {
    mockFetch.mockResolvedValueOnce(
      response([
        { id: 'multimodal', context_length: 1048576, architecture: { input_modalities: ['text', 'image', 'video'] } },
      ]),
    )
    expect(await fetchModelsWithContext('https://openrouter.test/api/v1')).toEqual([
      { id: 'multimodal', contextWindow: 1048576, supportsVision: true, source: 'backend' },
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('leaves existing vLLM discovery unchanged', async () => {
    mockFetch.mockResolvedValueOnce(
      response([{ id: 'vllm-model', max_model_len: 65536, capabilities: { vision: true } }]),
    )
    expect(await fetchModelsWithContext('https://vllm.test', undefined, 'vllm')).toEqual([
      { id: 'vllm-model', contextWindow: 65536, supportsVision: true, source: 'backend' },
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('never uses output token limits as input context', async () => {
    mockFetch.mockResolvedValueOnce(response([{ id: 'unknown-model', max_output_tokens: 512000 }]))
    expect(await fetchModelsWithContext('https://backend.test')).toEqual([
      { id: 'unknown-model', contextWindow: 200000, source: 'default' },
    ])
  })

  it('keeps known listing metadata when optional model info is malformed', async () => {
    mockFetch
      .mockResolvedValueOnce(response([{ id: 'qwen', max_input_tokens: 131072 }]))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ detail: 'not model metadata' }) })
    expect(await fetchModelsWithContext('https://gateway.test')).toEqual([
      { id: 'qwen', contextWindow: 131072, source: 'backend' },
    ])
  })
})
