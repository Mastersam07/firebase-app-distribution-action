/**
 * Unit tests for the action's entrypoint, src/index.js
 */

const path = require('path')
const { run } = require('../src/index')
const core = require('@actions/core')
const fs = require('fs')
const { Readable } = require('stream')
const axios = require('axios')

// Mock @actions/core functions
jest.mock('@actions/core')

// Mock fs.existsSync
jest.spyOn(fs, 'existsSync').mockReturnValue(true)

jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
  const mockStream = new Readable()
  mockStream._read = () => {}
  mockStream.push('mock file content')
  mockStream.push(null)
  return mockStream
})

// Mock GoogleAuth and its methods
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: jest.fn().mockResolvedValue({
      getAccessToken: jest
        .fn()
        .mockResolvedValue({ token: 'fake-access-token' })
    })
  }))
}))

// Mock FormData and its append method
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => {
    return {
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({
        'Content-Type':
          'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
      }) // Mock getHeaders method
    }
  })
})

// Mock axios
jest.mock('axios')

// Example service account for testing
const serviceAccountKey = {
  project_id: 'test-project',
  client_email: 'fake@email.com',
  type: 'service_account',
  private_key_id: '394a144bb215e4abc5f0a898a39be429360eb581',
  private_key: 'some-private-key',
  client_id: '114736475092980236049',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'some-cert-url',
  universe_domain: 'googleapis.com'
}

describe('Firebase App Distribution Action', () => {
  beforeEach(() => {
    // Reset core input/output mocks
    core.getInput.mockReset()
    core.setOutput.mockReset()
    core.setFailed.mockReset()

    // Setup default input mocks
    core.getInput.mockImplementation(name => {
      switch (name) {
        case 'serviceCredentialsFileContent':
          return JSON.stringify(serviceAccountKey)
        case 'appId':
          return '1:1234567890:android:abc123def456'
        case 'file':
          return 'path/to/app.apk'
        case 'groups':
          return 'testers'
        case 'releaseNotes':
          return 'Distributed via GitHub Actions'
        default:
          return ''
      }
    })
  })

  it('uploads a file successfully', async () => {
    axios.post.mockImplementation((url, data, config) => {
      if (url.includes('releases:upload')) {
        // Simulate a successful upload response
        return Promise.resolve({ data: { name: 'releases/release-id' } })
      } else if (url.includes(':distribute')) {
        // Simulate an error response for distribution
        return Promise.resolve({ data: { name: 'releases/release-id' } })
      }

      // Default to a generic error or successful response if needed
      const error = new Error('Unexpected URL')
      error.response = { status: 500, data: { message: 'Unexpected URL' } }
      return Promise.reject(error)
    })

    await run()

    // Check if setOutput was called with expected release name
    expect(core.setOutput).toHaveBeenCalledWith(
      'releaseName',
      'releases/release-id'
    )

    // Ensure setFailed was not called
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  it('handles upload failure', async () => {
    axios.post.mockImplementation((url, data, config) => {
      if (url.includes('releases:upload')) {
        // Simulate a successful upload response
        return Promise.resolve({ data: { name: 'releases/release-id' } })
      } else if (url.includes(':distribute')) {
        // Simulate an error response for distribution
        const error = new Error('Request failed with status code 400')
        error.response = { status: 400, data: { message: 'Bad Request' } }
        return Promise.reject(error)
      }

      // Default to a generic error or successful response if needed
      const error = new Error('Unexpected URL')
      error.response = { status: 500, data: { message: 'Unexpected URL' } }
      return Promise.reject(error)
    })

    await run()

    // Check if setFailed was called due to upload failure
    expect(core.setFailed).toHaveBeenCalledWith(expect.any(String))
  })
})
