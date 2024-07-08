/**
 * The entrypoint for the action.
 */
const core = require('@actions/core')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { GoogleAuth } = require('google-auth-library')
const FormData = require('form-data')

async function run() {
  try {
    const serviceCredentials = core.getInput('serviceCredentialsFileContent', {
      required: true
    })
    const appId = core.getInput('appId', { required: true })
    const file = core.getInput('file', { required: true })
    const groups = core.getInput('groups')
    const releaseNotes =
      core.getInput('releaseNotes') || 'Distributed via GitHub Actions'

    const serviceAccountKey = JSON.parse(serviceCredentials)
    const auth = new GoogleAuth({
      credentials: serviceAccountKey,
      scopes: 'https://www.googleapis.com/auth/firebase'
    })

    const client = await auth.getClient()
    const accessToken = (await client.getAccessToken()).token

    const filePath = path.resolve(file)
    const fileName = path.basename(file)

    if (!fs.existsSync(filePath)) {
      core.setFailed(`File "${filePath}" not found.`)
      return
    }

    // Adjusted upload URL
    const uploadUrl = `https://firebaseappdistribution.googleapis.com/upload/v1/projects/${serviceAccountKey.project_id}/apps/${appId}/releases:upload`

    const formData = new FormData()
    formData.append('file', fs.createReadStream(filePath), {
      filename: fileName,
      contentType: 'application/octet-stream'
    })

    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    const releaseId = uploadResponse.data.name // Assuming 'name' contains the release ID

    if (groups) {
      // Adjusted distribution URL
      const distributionUrl = `https://firebaseappdistribution.googleapis.com/v1/projects/${serviceAccountKey.project_id}/apps/${appId}/releases/${releaseId}:distribute`

      await axios.post(
        distributionUrl,
        {
          groupNames: groups.split(','),
          releaseNotes: {
            text: releaseNotes
          }
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      )
    }

    core.setOutput('releaseName', releaseId)
  } catch (error) {
    core.setFailed(`Action failed with error ${error}`)
  }
}

// Export the run function to make it available for import
module.exports = {
  run
}
