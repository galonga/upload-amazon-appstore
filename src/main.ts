import * as core from '@actions/core'
import fs from "fs"
import fetch from 'node-fetch'

async function run() {
    try {
        const clientId = core.getInput('clientId')
        const clientSecret = core.getInput('clientSecret')
        const appId = core.getInput('appId')
        const apkFile = core.getInput('releaseFile')
        const baseUrl = 'https://developer.amazon.com/api/appstore'
        let editId, apkId, eTag

        // @ts-ignore
        function handleErrors(response) {
            if (!response.ok) throw Error(`[Error] ${response.statusText}`)
            return response
        }

        core.info('Getting Authentication Token')

        const authTokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
            method: 'POST',
            body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=appstore::apps:readwrite`,
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        })
            .then(handleErrors)
            .then((response) => response.json())
            .catch((error) => {
                core.setFailed(error.message)
            })

        const authHeader = `Bearer ${authTokenResponse.access_token}`

        core.info('Checking if an open Edit exists')

        const getActiveEditResponse = await fetch(`${baseUrl}/v1/applications/${appId}/edits`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
        })
            .then(handleErrors)
            .then((response) => response.json())
            .catch((error) => {
                core.setFailed(error.message)
            })

        if (JSON.stringify(getActiveEditResponse) === '{}') {
            core.info('No active edit found, creating new one')

            const createEditResponse = await fetch(`${baseUrl}/v1/applications/${appId}/edits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: authHeader,
                },
            })
                .then(handleErrors)
                .then((response) => response.json())
                .catch((error) => {
                    core.setFailed(error.message)
                })

            core.info('Creating new Edit')
            editId = createEditResponse.id
        } else {
            core.info('Open edit found')
            editId = getActiveEditResponse.id
        }

        await fetch(`${baseUrl}/v1/applications/${appId}/edits/${editId}/apks`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
        })
            .then(handleErrors)
            .then((response) => response.json())
            .then((data) => {
                for (const apk of data) {
                    core.info(`Found apk with version code ${apk.versionCode} - id ${apk.id} - ${apk.name}`)
                    apkId = apk.id
                }
            })
            .catch((error) => {
                core.setFailed(error.message)
            })


        eTag = ""

        await fetch(`${baseUrl}/v1/applications/${appId}/edits/${editId}/apks/${apkId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
        })
            .then(handleErrors)
            .then((response) => {
                eTag = response.headers.get('etag')
            })
            .catch((error) => {
                core.setFailed(error.message)
            })

        await fetch(`${baseUrl}/v1/applications/${appId}/edits/${editId}/apks/${apkId}/replace`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/vnd.android.package-archive',
                Authorization: authHeader,
                'If-Match': eTag,
            },
            body: fs.createReadStream(apkFile),
        })
            .then(handleErrors)
            .then((response) => {
                core.info('Successfully uploaded apk')
            })
            .catch((error) => {
                core.setFailed(`Failed to upload apk due to ${error.message}`)
            })
    } catch (error) {
        core.setFailed(`[Error] There was an error with the action: ${error}`)
    }
}

run();
