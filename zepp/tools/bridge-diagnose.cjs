const { spawn } = require('child_process')
const path = require('path')

const runner = path.join(__dirname, 'bridge-direct.cjs')
const child = spawn(process.execPath, [runner], {
  cwd: path.join(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe']
})

let started = false

function forward(chunk, stream) {
  const value = chunk.toString()
  stream.write(value)
  if (!started && (value.includes('bridge$') || value.includes("Enter 'help'"))) {
    started = true
    setTimeout(() => child.stdin.write('connect\n'), 1000)
    setTimeout(() => child.stdin.write('screenshot\n'), 7000)
    setTimeout(() => child.stdin.write('exit\n'), 22000)
  }
}

child.stdout.on('data', chunk => forward(chunk, process.stdout))
child.stderr.on('data', chunk => forward(chunk, process.stderr))

setTimeout(() => {
  if (!child.killed) child.stdin.write('exit\n')
}, 30000)

