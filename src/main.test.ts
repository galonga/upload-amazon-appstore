import * as core from '@actions/core'
import fetch from 'node-fetch'
import {run} from './main'

// Both dependencies must be mocked via a factory rather than automock: node-fetch is
// ESM-only so Jest's CJS loader can't require() it directly, and @actions/core pulls
// in @actions/http-client -> undici, which expects Web Streams globals that aren't
// present in Jest's test environment. A factory replaces the module without ever
// loading the real one. Jest hoists these calls above the imports above at runtime.
jest.mock('node-fetch', () => jest.fn())
jest.mock('@actions/core', () => ({
  getInput: jest.fn(),
  info: jest.fn(),
  setFailed: jest.fn(),
}))

const mockedFetch = fetch as unknown as jest.Mock
const mockedGetInput = core.getInput as jest.Mock
const mockedSetFailed = core.setFailed as jest.Mock

const BASE_URL = 'https://developer.amazon.com/api/appstore'

interface MockResponseInit {
  ok?: boolean
  statusText?: string
  headers?: Record<string, string>
}

function mockResponse(body: unknown, init: MockResponseInit = {}) {
  return {
    ok: init.ok ?? true,
    statusText: init.statusText ?? 'Internal Server Error',
    json: async () => body,
    headers: {get: (name: string) => (init.headers ?? {})[name] ?? null},
  }
}

describe('run', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockedGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        appId: 'app-id',
        releaseFile: __filename,
      }
      return inputs[name]
    })
  })

  it('reuses an open edit and replaces the existing apk', async () => {
    mockedFetch
      .mockResolvedValueOnce(mockResponse({access_token: 'token-123'}))
      .mockResolvedValueOnce(mockResponse({id: 'edit-1'}))
      .mockResolvedValueOnce(mockResponse([{id: 'apk-1', versionCode: 1, name: 'app.apk'}]))
      .mockResolvedValueOnce(mockResponse({}, {headers: {etag: 'etag-1'}}))
      .mockResolvedValueOnce(mockResponse({}))

    await run()

    expect(mockedSetFailed).not.toHaveBeenCalled()
    expect(mockedFetch).toHaveBeenCalledTimes(5)

    const [replaceUrl, replaceOptions] = mockedFetch.mock.calls[4]
    expect(replaceUrl).toBe(`${BASE_URL}/v1/applications/app-id/edits/edit-1/apks/apk-1/replace`)
    expect(replaceOptions.method).toBe('PUT')
    expect(replaceOptions.headers['If-Match']).toBe('etag-1')
  })

  it('creates a new edit and uploads a new apk when none is open or exists', async () => {
    mockedFetch
      .mockResolvedValueOnce(mockResponse({access_token: 'token-123'}))
      .mockResolvedValueOnce(mockResponse({}))
      .mockResolvedValueOnce(mockResponse({id: 'edit-2'}))
      .mockResolvedValueOnce(mockResponse([]))
      .mockResolvedValueOnce(mockResponse({}))

    await run()

    expect(mockedSetFailed).not.toHaveBeenCalled()
    expect(mockedFetch).toHaveBeenCalledTimes(5)

    const [createEditUrl, createEditOptions] = mockedFetch.mock.calls[2]
    expect(createEditUrl).toBe(`${BASE_URL}/v1/applications/app-id/edits`)
    expect(createEditOptions.method).toBe('POST')

    const [apksUrl] = mockedFetch.mock.calls[3]
    expect(apksUrl).toBe(`${BASE_URL}/v1/applications/app-id/edits/edit-2/apks`)

    const [uploadUrl, uploadOptions] = mockedFetch.mock.calls[4]
    expect(uploadUrl).toBe(`${BASE_URL}/v1/applications/app-id/edits/edit-2/apks/upload`)
    expect(uploadOptions.method).toBe('POST')
  })

  it('fails fast without making any request when the release file does not exist', async () => {
    mockedGetInput.mockImplementation((name: string) => (name === 'releaseFile' ? '/nonexistent/app.apk' : 'x'))

    await run()

    expect(mockedFetch).not.toHaveBeenCalled()
    expect(mockedSetFailed).toHaveBeenCalledTimes(1)
    expect(mockedSetFailed).toHaveBeenCalledWith(expect.stringContaining('/nonexistent/app.apk'))
  })

  it('stops immediately and reports the real error when authentication fails', async () => {
    mockedFetch.mockResolvedValueOnce(mockResponse({error: 'invalid_client'}, {ok: false, statusText: 'Unauthorized'}))

    await run()

    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(mockedSetFailed).toHaveBeenCalledTimes(1)
    expect(mockedSetFailed).toHaveBeenCalledWith(expect.stringContaining('Unauthorized'))
  })

  it('stops and reports the real error when the apk upload fails, without a masked follow-up error', async () => {
    mockedFetch
      .mockResolvedValueOnce(mockResponse({access_token: 'token-123'}))
      .mockResolvedValueOnce(mockResponse({id: 'edit-1'}))
      .mockResolvedValueOnce(mockResponse([{id: 'apk-1', versionCode: 1, name: 'app.apk'}]))
      .mockResolvedValueOnce(mockResponse({}, {headers: {etag: 'etag-1'}}))
      .mockResolvedValueOnce(mockResponse({}, {ok: false, statusText: 'Payload Too Large'}))

    await run()

    expect(mockedFetch).toHaveBeenCalledTimes(5)
    expect(mockedSetFailed).toHaveBeenCalledTimes(1)
    expect(mockedSetFailed).toHaveBeenCalledWith(expect.stringContaining('Payload Too Large'))
  })
})
