const fs = require('fs')
const path = require('path')
const zepp = require('zeppos-app-utils')
const { initVariable } = require('../node_modules/@zeppos/zeus-cli/utils/pre-check')

const root = path.resolve(__dirname, '..')
const target = 'cheetah-round'
const deviceSources = [8192256, 8192257]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function connectedTargets() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(1000)
    try {
      const targets = JSON.parse(process.env._bridgeOptionalDevice || '{}')
      if (Object.keys(targets).length) return targets
    } catch (_) {}
  }
  return {}
}

async function main() {
  const argv = { _: ['bridge'], $0: 'zeus' }
  await initVariable({ argv })
  process.env._targetDeviceToBuild = target

  const packages = fs.readdirSync(path.join(root, 'dist'))
    .filter((name) => name.endsWith('.zab'))
    .sort()
  if (!packages.length) throw new Error('No ZAB package found in dist')
  const packagePath = path.join(root, 'dist', packages[packages.length - 1])

  const bridgeUrl = await zepp.api.getConnectDevServerWebSocketCode()
  let client
  let finished = false

  client = new zepp.WebSocketClass({
    url: `${bridgeUrl}?type=development&name=CLI`,
    connectWSCB: async () => {
      try {
        const targets = await connectedTargets()
        const names = Object.keys(targets)
        const targetName = names.find((name) => name.toLowerCase().includes('app-android')) || names[0]
        if (!targetName) throw new Error('No online Zepp App found in Developer Bridge')

        process.env._bridgeChoiredDevice = targetName
        client.sendMessage({ clientId: targets[targetName] }, { method: 'connectClient' })
        console.log(`BRIDGE_CONNECTED=${targetName}`)
        await sleep(2000)

        const params = await zepp.modules.previewBuild(root, {}, packagePath, 'app', 'install')
        if (!params || params === 'reTry') throw new Error('Package upload failed')
        params.target = 'SwiftW'
        params.devices = deviceSources
        client.sendMessage(params, { method: 'packagePush' })
        console.log(`PACKAGE_PUSHED=${path.basename(packagePath)}`)
        console.log('CHECK_ZEPP_APP_AND_WATCH')
        finished = true
        setTimeout(() => process.exit(0), 45000)
      } catch (error) {
        console.error(error)
        process.exit(1)
      }
    },
    disConnectWSCB: () => {
      if (!finished) {
        console.error('BRIDGE_DISCONNECTED')
        process.exit(2)
      }
    }
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
