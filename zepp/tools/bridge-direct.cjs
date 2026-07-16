const { initVariable } = require('../node_modules/@zeppos/zeus-cli/utils/pre-check')
const { bridge } = require('../node_modules/@zeppos/zeus-cli/modules/bridge')

async function main() {
  const argv = { _: ['bridge'], $0: 'zeus' }
  await initVariable({ argv })
  await bridge(argv)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
