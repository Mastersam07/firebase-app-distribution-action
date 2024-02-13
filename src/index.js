/**
 * The entrypoint for the action.
 */
const core = require('@actions/core')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { GoogleAuth } = require('google-auth-library')

async function run() {
  try {
    const serviceCredentials = core.getInput('serviceCredentialsFileContent', {
      required: true
    })
    const appId = core.getInput('appId', { required: true })
    const file = core.getInput('file', { required: true })
    const groups = core.getInput('groups')

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
    const uploadUrl = `https://firebaseappdistribution.googleapis.com/v1/projects/${serviceAccountKey.project_id}/apps/${appId}/releases:upload`

    const formData = new FormData()
    formData.append('file', fs.createReadStream(filePath), fileName)

    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data'
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
            text: 'Distributed via GitHub Actions'
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

run()
