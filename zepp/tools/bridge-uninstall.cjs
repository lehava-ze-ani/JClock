const { spawn } = require('child_process')
const path = require('path')

const APP_ID = '1094762'
const bridgeRunner = path.join(__dirname, 'bridge-direct.cjs')
const child = spawn(process.execPath, [bridgeRunner], {
  cwd: path.join(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe']
})

let started = false
let uninstallSent = false
let output = ''

function write(chunk, stream) {
  const value = chunk.toString()
  output += value
  stream.write(value)

  if (!started && (value.includes('bridge$') || value.includes("Enter 'help'"))) {
    started = true
    setTimeout(() => child.stdin.write('connect\n'), 1200)
    setTimeout(() => {
      uninstallSent = true
      child.stdin.write(`uninstall ${APP_ID}\n`)
    }, 4500)
    setTimeout(() => child.stdin.write('exit\n'), 22000)
  }
}

child.stdout.on('data', chunk => write(chunk, process.stdout))
child.stderr.on('data', chunk => write(chunk, process.stderr))

const timeout = setTimeout(() => {
  if (!child.killed) child.stdin.write('exit\n')
}, 30000)

child.on('exit', code => {
  clearTimeout(timeout)
  if (!started) {
    console.error('BRIDGE_NOT_STARTED')
    process.exitCode = 2
  } else if (/No connectable online App|No device is connected/.test(output)) {
    console.error('BRIDGE_DEVICE_NOT_FOUND')
    process.exitCode = 3
  } else if (!uninstallSent) {
    console.error('BRIDGE_UNINSTALL_NOT_SENT')
    process.exitCode = 4
  } else if (/uninstall.*(?:success|succeed)|(?:success|succeed).*uninstall/i.test(output)) {
    console.log('BRIDGE_UNINSTALL_CONFIRMED')
    process.exitCode = 0
  } else {
    console.error('BRIDGE_UNINSTALL_NOT_CONFIRMED')
    process.exitCode = code || 5
  }
})
