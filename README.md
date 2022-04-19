# Upload Android release to Amazon Appstore Github Action

This action will help you upload an Android `.apk` file to Amazon AppStore. All the steps on this action were created based on the [Amazon AppStore -> API Task Flows](https://developer.amazon.com/docs/app-submission-api/flows.html)

## Prerequisites

To set up one-time API access, first create a security profile in the Developer Console and then associate the security profile with the Submission API. Both steps can be taken from the “API Access” tab under “Apps and Services”. Once the association is completed, you can use the secure ID and client ID to request Login with Amazon access token. This token is used during API calls.

The app must be live on Amazon AppStore. If not you will receive the error `Cannot create a new 'edit' for the app in it's current state.` when the action tries to create the Edit.

## Inputs

### `clientId`

**Required** The client ID of the Amazon AppStore application.

### `clientSecret`

**Required** The client secret of the Amazon AppStore application.

### `appId`

**Required** Amazon Appstore app id of the application you are uploading.

### `releaseFile`

**Required** The Android release file to upload (.apk)

## Sample usage

```yaml
uses: galonga/upload-amazon-appstore@v1.0
  with:
    clientId: ${{secrets.AMAZON_APPSTORE_CLIENT_ID}}
    clientSecret: ${{secrets.AMAZON_APPSTORE_CLIENT_SECRET}}
    appId: ${{ secrets.AMAZON_APPSTORE_APP_ID }}
    apkFile: app/build/outputs/apk/release/app-release.apk
```

