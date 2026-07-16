const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

async function main() {
  const hardTimeout = setTimeout(() => {
    console.error('CDP_TIMEOUT')
    process.exit(2)
  }, 12000)
  const portFile = path.join(os.homedir(), 'AppData', 'Roaming', 'simulator', 'DevToolsActivePort')
  const [port] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/)
  const targets = await getJson(`http://127.0.0.1:${port}/json/list`)
  const target = targets.find((item) => item.title === 'Huami OS Simulator')
    || targets.find((item) => item.type === 'page' && item.url.startsWith('file:'))
  if (!target) throw new Error('Simulator page target was not found')
  console.log(`TARGET=${target.title}`)

  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  let nextId = 0

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) request.reject(new Error(JSON.stringify(message.error)))
    else request.resolve(message.result)
  }

  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  console.log('SOCKET_OPEN')

  try {
    await send('Runtime.enable')
    console.log('RUNTIME_ENABLED')
    await send('Page.enable')
    console.log('PAGE_ENABLED')
    const launchRequested = process.argv.includes('--launch')
    if (launchRequested) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: 50, y: 150, button: 'left', clickCount: 1,
      })
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: 50, y: 150, button: 'left', clickCount: 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 350))
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: 250, y: 170, button: 'left', clickCount: 1,
      })
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: 250, y: 170, button: 'left', clickCount: 1,
      })
      console.log('LAUNCH_CLICK_SENT')
      return
    }
    if (process.argv.includes('--console')) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: 55, y: 310, button: 'left', clickCount: 1,
      })
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: 55, y: 310, button: 'left', clickCount: 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 500))
      console.log('CONSOLE_CLICK_SENT')
    }
    if (process.argv.includes('--screenshot-tab')) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: 415, y: 50, button: 'left', clickCount: 1,
      })
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: 415, y: 50, button: 'left', clickCount: 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log('SCREENSHOT_TAB_CLICK_SENT')
    }
    if (process.argv.includes('--take-screenshot')) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: 525, y: 423, button: 'left', clickCount: 1,
      })
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: 525, y: 423, button: 'left', clickCount: 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 1500))
      console.log('SCREENSHOT_REQUEST_SENT')
    }
    const state = await send('Runtime.evaluate', {
      expression: `({
        title: document.title,
        visibility: document.visibilityState,
        text: (document.body && document.body.innerText || '').slice(-20000),
        width: window.innerWidth,
        height: window.innerHeight,
        localStorageKeys: Object.keys(localStorage),
        buttons: Array.from(document.querySelectorAll('button')).slice(0, 50).map((button) => {
          const rect = button.getBoundingClientRect()
          return { text: button.innerText, x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }),
        screenShootElements: (() => {
          const result = document.evaluate("//*[normalize-space(text())='ScreenShoot']", document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
          return Array.from({ length: result.snapshotLength }, (_, index) => {
            const element = result.snapshotItem(index)
            const rect = element.getBoundingClientRect()
            return { tag: element.tagName, className: element.className, x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          })
        })()
      })`,
      returnByValue: true,
    })
    console.log('STATE_READ')
    if (process.argv.includes('--no-screenshot') || process.argv.includes('--console')) {
      process.stdout.write(`${JSON.stringify(state.result.value, null, 2)}\n`)
      return
    }
    const screenshot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    })
    console.log('SCREENSHOT_CAPTURED')
    const output = process.argv.find((argument) => argument.toLowerCase().endsWith('.png'))
      || path.resolve(__dirname, '..', '..', 'output', 'simulator-current.png')
    fs.mkdirSync(path.dirname(output), { recursive: true })
    fs.writeFileSync(output, Buffer.from(screenshot.data, 'base64'))
    process.stdout.write(`${JSON.stringify(state.result.value, null, 2)}\nSCREENSHOT=${output}\n`)
  } finally {
    clearTimeout(hardTimeout)
    socket.close()
    setTimeout(() => process.exit(process.exitCode || 0), 250)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
