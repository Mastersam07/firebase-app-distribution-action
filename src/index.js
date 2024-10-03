/**
 * The entrypoint for the action.
 */
const core = require('@actions/core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const FormData = require('form-data');

/**
 * The main function that orchestrates the Firebase distribution process.
 */
async function run() {
  try {
    core.info('🛠️ Starting Firebase distribution');

    // Retrieve and parse inputs
    const serviceCredentials = core.getInput('serviceCredentialsFileContent', {
      required: true,
    });
    const appId = core.getInput('appId', { required: true });
    const file = core.getInput('file', { required: true });
    const groups = core.getInput('groups');
    const releaseNotes =
      core.getInput('releaseNotes') || 'Distributed via GitHub Actions';

    core.debug(`App ID: ${appId}`);
    core.debug(`File to distribute: ${file}`);
    core.debug(`Groups: ${groups}`);

    // Parse Service Account Credentials
    const serviceAccountKey = await parseServiceAccountCredentials(serviceCredentials);

    // Initialize Google Authentication
    const accessToken = await initializeGoogleAuthentication(serviceAccountKey);

    // Resolve and Verify File Path
    const filePath = await resolveAndVerifyFilePath(file);

    // Upload the File
    const projectId = serviceAccountKey.project_id;
    const releaseId = await uploadFile(projectId, appId, filePath, accessToken);

    // Distribute the Release to Groups if specified
    if (groups) {
      await distributeRelease(projectId, appId, releaseId, groups, releaseNotes, accessToken);
    }

    // Create Job Summary
    await createJobSummary(appId, releaseId, groups);

    core.info('🎉 Firebase distribution completed successfully.');
  } catch (error) {
    // Mask sensitive information if present
    if (error.message) {
      core.setSecret(error.message);
    }
    if (error.stack) {
      core.setSecret(error.stack);
    }
    core.error(`❌ Action failed with error: ${error.message}`);
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

/**
 * Parses the service account credentials from JSON.
 * @param {string} serviceCredentials - The service account credentials in JSON format.
 * @returns {Object} - The parsed service account key object.
 */
async function parseServiceAccountCredentials(serviceCredentials) {
  return await core.group('🔧 Parsing Service Account Credentials', async () => {
    try {
      const serviceAccountKey = JSON.parse(serviceCredentials);
      core.info('✅ Service Account Key parsed successfully');
      return serviceAccountKey;
    } catch (parseError) {
      core.error('❌ Failed to parse serviceCredentialsFileContent. Ensure it is valid JSON.');
      core.setFailed('Failed to parse serviceCredentialsFileContent. Ensure it is valid JSON.');
      throw parseError; // Exit the run function
    }
  });
}

/**
 * Initializes Google Authentication and retrieves an access token.
 * @param {Object} serviceAccountKey - The service account key object.
 * @returns {string} - The OAuth2 access token.
 */
async function initializeGoogleAuthentication(serviceAccountKey) {
  return await core.group('🔑 Initializing Google Authentication', async () => {
    try {
      const auth = new GoogleAuth({
        credentials: serviceAccountKey,
        scopes: 'https://www.googleapis.com/auth/firebase',
      });

      const client = await auth.getClient();
      const accessToken = (await client.getAccessToken()).token;

      if (!accessToken) {
        core.error('❌ Failed to obtain access token.');
        core.setFailed('Failed to obtain access token.');
        throw new Error('Access token missing');
      }
      core.info('✅ Access Token obtained successfully');
      return accessToken;
    } catch (authError) {
      core.error('❌ Google Authentication failed.');
      core.setFailed('Google Authentication failed.');
      throw authError; // Exit the run function
    }
  });
}

/**
 * Resolves and verifies the existence of the distribution file.
 * @param {string} file - The path to the file to distribute.
 * @returns {string} - The absolute file path.
 */
async function resolveAndVerifyFilePath(file) {
  return await core.group('📂 Resolving and Verifying File Path', async () => {
    try {
      const filePath = path.resolve(file);
      core.debug(`Resolved file path: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        core.error(`❌ File "${filePath}" not found.`);
        core.setFailed(`File "${filePath}" not found.`);
        throw new Error('File not found');
      }
      core.info(`✅ File "${filePath}" exists and is ready for distribution`);
      return filePath;
    } catch (fileError) {
      core.error(`❌ Error resolving file path: ${fileError.message}`);
      core.setFailed(`Error resolving file path: ${fileError.message}`);
      throw fileError; // Exit the run function
    }
  });
}

/**
 * Uploads the distribution file to Firebase App Distribution.
 * @param {string} projectId - The Firebase Project ID.
 * @param {string} appId - The Firebase App ID.
 * @param {string} filePath - The absolute path to the distribution file.
 * @param {string} accessToken - The OAuth2 access token.
 * @returns {string} - The Release ID obtained after upload.
 */
async function uploadFile(projectId, appId, filePath, accessToken) {
  return await core.group('📤 Uploading the File to Firebase App Distribution', async () => {
    try {
      const uploadUrl = `https://firebaseappdistribution.googleapis.com/upload/v1/projects/${projectId}/apps/${appId}/releases:upload`;
      core.debug(`Upload URL: ${uploadUrl}`);

      const fileName = path.basename(filePath);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), {
        filename: fileName,
        contentType: 'application/octet-stream',
      });

      core.info('🔄 Initiating file upload...');
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      core.debug(`Upload Response: ${JSON.stringify(uploadResponse.data)}`);

      const releaseId = uploadResponse.data.name;
      core.info(`✅ Upload successful. Release ID: ${releaseId}`);

      // Set the release ID as an output
      core.setOutput('releaseName', releaseId);

      return releaseId;
    } catch (uploadError) {
      core.error(`❌ File upload failed: ${uploadError.message}`);
      core.setFailed(`File upload failed: ${uploadError.message}`);
      throw uploadError; // Exit the run function
    }
  });
}

/**
 * Distributes the release to specified groups.
 * @param {string} projectId - The Firebase Project ID.
 * @param {string} appId - The Firebase App ID.
 * @param {string} releaseId - The Release ID obtained after upload.
 * @param {string} groups - Comma-separated group names.
 * @param {string} releaseNotes - Release notes text.
 * @param {string} accessToken - OAuth2 access token.
 */
async function distributeRelease(projectId, appId, releaseId, groups, releaseNotes, accessToken) {
  await core.group('🔄 Distributing Release to Specified Groups', async () => {
    try {
      const distributionUrl = `https://firebaseappdistribution.googleapis.com/v1/projects/${projectId}/apps/${appId}/releases/${releaseId}:distribute`;
      core.debug(`Distribution URL: ${distributionUrl}`);

      core.info(`🔄 Distributing release to groups: ${groups}`);
      await axios.post(
        distributionUrl,
        {
          groupNames: groups.split(',').map((group) => group.trim()),
          releaseNotes: {
            text: releaseNotes,
          },
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      core.info(`✅ Distributed successfully to groups: ${groups}`);
    } catch (distributionError) {
      core.error(`❌ Release distribution failed: ${distributionError.message}`);
      core.setFailed(`Release distribution failed: ${distributionError.message}`);
      throw distributionError; // Exit the run function
    }
  });
}

/**
 * Creates a job summary for the GitHub Action.
 * @param {string} appId - The Firebase App ID.
 * @param {string} releaseId - The Release ID obtained after upload.
 * @param {string} groups - Comma-separated group names.
 */
async function createJobSummary(appId, releaseId, groups) {
  await core.group('📝 Creating Job Summary', async () => {
    try {
      core.summary
        .addHeading('✅ Firebase Distribution Summary', 2)
        .addList([
          `**App ID:** ${appId}`,
          `**Release ID:** ${releaseId}`,
          groups ? `**Distributed to Groups:** ${groups}` : 'No groups specified',
        ])
        .addSeparator()
        .write();
      core.info('📝 Job summary created successfully.');
    } catch (summaryError) {
      core.error(`❌ Failed to create job summary: ${summaryError.message}`);
      core.setFailed(`Failed to create job summary: ${summaryError.message}`);
      throw summaryError; // Exit the run function
    }
  });
}

// Execute the run function
run();
