# Firebase App Distribution GitHub Action

This GitHub Action uploads an artifact to Firebase App Distribution and optionally distributes it to specified groups.

[![GitHub Super-Linter](https://github.com/mastersam07/firebase-app-distribution-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![Coverage](https://raw.githubusercontent.com/mastersam07/firebase-app-distribution-action/master/badges/coverage.svg)

## Inputs

- `serviceCredentialsFileContent`: **Required**. The JSON content of the Firebase service account key used for authentication.
- `appId`: **Required**. The Firebase App ID to which the artifact will be uploaded.
- `file`: **Required**. The path to the artifact file (e.g., APK or IPA) you want to upload.
- `groups`: Optional. A comma-separated list of distribution group aliases to which the artifact will be distributed.

## Outputs

- `releaseName`: The name of the release created in Firebase App Distribution.

## Usage

To use this action in your workflow, follow these steps:

1. **Prepare your Firebase Service Account Key:**
   - Go to the [Firebase Console](https://console.firebase.google.com/).
   - Select your project and go to Project settings > Service accounts.
   - Generate a new private key and save the JSON file.

2. **Add your Service Account Key to GitHub Secrets:**
   - Go to your GitHub repository's Settings > Secrets.
   - Add a new secret containing the entire JSON content of the Firebase service account key file. Name it something like `FIREBASE_SERVICE_ACCOUNT_KEY`.

3. **Configure the Workflow:**
   - In your repository, create a `.github/workflows` directory if it doesn't exist.
   - Create a new YAML file for your workflow (e.g., `.github/workflows/firebase-distribution.yml`).

4. **Add the Workflow Configuration:**

```yaml
name: Distribute App via Firebase

on:
  push:
    branches:
      - main  # Or any other branch from which you want to distribute builds

jobs:
  firebase_distribution:
    runs-on: ubuntu-latest  # Can be any supported runner
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Upload and Distribute App
        uses: mastersam07/firebase-app-distribution-action@v0.1
        with:
          serviceCredentialsFileContent: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY }}
          appId: ${{ secrets.FIREBASE_APP_ID }}
          file: '<path-to-your-artifact>'  # e.g., './build/app/outputs/flutter-apk/app-release.apk'
          groups: 'testers,qa'  # Optional: distribution groups
```

## Contributing/Initial Setup

After you've cloned the repository to your local machine or codespace, you'll
need to perform some initial setup steps before you can develop your action.

> [!NOTE]
>
> You'll need to have a reasonably modern version of
> [Node.js](https://nodejs.org) handy. If you are using a version manager like
> [`nodenv`](https://github.com/nodenv/nodenv) or
> [`nvm`](https://github.com/nvm-sh/nvm), you can run `nodenv install` in the
> root of your repository to install the version specified in
> [`package.json`](./package.json). Otherwise, 20.x or later should work!

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the JavaScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

   ```bash
   $ npm test

   PASS  __tests__/index.test.js
    Firebase App Distribution Action
      ✓ uploads a file successfully (2 ms)
      ✓ handles upload failure

   ...
   ```
