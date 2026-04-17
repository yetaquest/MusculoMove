import type { EvaluateRequest, OptimizeRequest } from '../types/api'

const API_ROOT = import.meta.env.VITE_API_ROOT ?? '/api'

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with status ${response.status}`)
  }
  return payload
}

export async function fetchManifest() {
  return fetchJson<unknown>(`${API_ROOT}/manifest`)
}

export async function postEvaluate(body: EvaluateRequest) {
  return fetchJson<unknown>(`${API_ROOT}/evaluate`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function postOptimize(body: OptimizeRequest) {
  return fetchJson<unknown>(`${API_ROOT}/optimize`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchSampleResponse() {
  return fetchJson<unknown>('/sample-response.json')
}

export async function probeAvatarAsset() {
  const response = await fetch('/models/avatar.glb', { method: 'HEAD' })
  return response.ok
}
