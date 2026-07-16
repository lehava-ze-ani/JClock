const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@zeppos',
  'zml',
  'dist',
  'zml-app.js'
)

const source = fs.readFileSync(target, 'utf8')
const startMarker = 'const C=e("@zos/ble/TransferFile"),q='
const endMarker = 'var P;function D'
const start = source.indexOf(startMarker)
const end = source.indexOf(endMarker, start)

if (start < 0) {
  if (source.includes('const q={onFile(){return this},offFile(){return this}')) {
    console.log('ZML API 2 compatibility patch already applied')
    process.exit(0)
  }
  throw new Error('Could not locate the ZML TransferFile initializer')
}

if (end < 0) throw new Error('Could not locate the end of the ZML TransferFile initializer')

const compatibilityShim = [
  'const q={',
  'onFile(){return this},',
  'offFile(){return this},',
  'getFile(){return null},',
  'sendFile(){throw new Error("fileTransfer is not available")}',
  '};function D'
].join('')

const patched = source.slice(0, start) + compatibilityShim + source.slice(end + endMarker.length)
fs.writeFileSync(target, patched, 'utf8')
console.log('Patched unused ZML TransferFile initialization for API 2 compatibility')

