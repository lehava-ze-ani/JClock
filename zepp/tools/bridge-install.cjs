const { spawn } = require('child_process')
const path = require('path')

const bridgeRunner = path.join(__dirname, 'bridge-direct.cjs')
const child = spawn(process.execPath, [bridgeRunner], {
  cwd: path.join(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe']
})

let started = false
let installSent = false
let output = ''

function write(chunk, stream) {
  const text = chunk.toString()
  output += text
  stream.write(text)

  if (!started && (text.includes('bridge$') || text.includes("Enter 'help'"))) {
    started = true
    setTimeout(() => child.stdin.write('connect\n'), 1500)
    setTimeout(() => {
      installSent = true
      child.stdin.write('install -t "Amazfit Cheetah (Round)"\n')
    }, 5000)
  }
}

child.stdout.on('data', (chunk) => write(chunk, process.stdout))
child.stderr.on('data', (chunk) => write(chunk, process.stderr))

const timeout = setTimeout(() => {
  if (!child.killed) child.stdin.write('exit\n')
}, 60000)

child.on('exit', (code) => {
  clearTimeout(timeout)
  if (!started) {
    console.error('BRIDGE_NOT_STARTED')
    process.exitCode = 2
  } else if (/No connectable online App|No device is connected/.test(output)) {
    console.error('BRIDGE_DEVICE_NOT_FOUND')
    process.exitCode = 3
  } else if (!installSent) {
    console.error('BRIDGE_INSTALL_NOT_SENT')
    process.exitCode = 4
  } else {
    process.exitCode = code || 0
  }
})
