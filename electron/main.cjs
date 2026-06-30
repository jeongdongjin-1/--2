// Electron 메인 프로세스.
// 내장 Express 서버(server/index.mjs)를 띄워 dist + /api를 서빙하고,
// BrowserWindow에서 http://localhost:PORT 를 로드한다.
const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const PORT = 4173
process.env.PORT = String(PORT)
// dist를 강제로 찾도록 server의 root 기준 경로는 그대로 두고, NODE_ENV만 표시
process.env.ELECTRON = '1'

let win = null

async function startServer() {
  // server/index.mjs는 ESM → 동적 import로 기동(부수효과로 app.listen 실행)
  const serverUrl = path.join(__dirname, '..', 'server', 'index.mjs')
  await import('file://' + serverUrl.replace(/\\/g, '/'))
}

function loadWithRetry(url, tries = 0) {
  win.loadURL(url).catch(() => {
    if (tries < 30) setTimeout(() => loadWithRetry(url, tries + 1), 300)
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: '집찾기 · 수도권 아파트',
    backgroundColor: '#f4f6f9',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  // 서버가 아직 안 떴을 수 있으니 실패 시 재시도
  win.webContents.on('did-fail-load', () => loadWithRetry(`http://localhost:${PORT}`))
  loadWithRetry(`http://localhost:${PORT}`)

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(async () => {
  try {
    await startServer()
  } catch (e) {
    console.error('[electron] server start failed:', e)
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
