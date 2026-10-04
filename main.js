import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs'

const pdfUrl = '/CRC_Report_3af7317d_Sep_2026.pdf'
const viewportElement = document.querySelector('.pdf-viewport')
const pagesElement = document.querySelector('.pdf-pages')
const loadingTask = pdfjsLib.getDocument(pdfUrl)
const pdf = await loadingTask.promise
const activeRenderTasks = new Set()
let zoom = 1
let renderVersion = 0
let resizeTimer
let zoomRenderTimer
let lastPinchDistance = null

async function renderDocument() {
  const currentRender = ++renderVersion
  const previousScrollLeft = viewportElement.scrollLeft
  const previousScrollTop = viewportElement.scrollTop
  const pageWidth = window.matchMedia('(max-width: 900px)').matches ? 920 : 710

  for (const task of activeRenderTasks) {
    task.cancel()
  }

  pagesElement.replaceChildren()
  viewportElement.setAttribute('aria-busy', 'true')
  const outputScale = Math.min(window.devicePixelRatio || 1, 1.5)

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (currentRender !== renderVersion) {
      return
    }

    const page = await pdf.getPage(pageNumber)
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = (pageWidth / baseViewport.width) * zoom
    const viewport = page.getViewport({ scale })
    const pageElement = document.createElement('div')
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    const renderTask = page.render({
      canvasContext: context,
      viewport,
      transform: [outputScale, 0, 0, outputScale, 0, 0],
      background: 'rgb(255, 255, 255)',
    })

    pageElement.className = 'pdf-page'
    pageElement.setAttribute('aria-label', `CRC report page ${pageNumber}`)
    canvas.className = 'pdf-canvas'
    canvas.width = Math.ceil(viewport.width * outputScale)
    canvas.height = Math.ceil(viewport.height * outputScale)
    canvas.style.width = `${Math.ceil(viewport.width)}px`
    canvas.style.height = `${Math.ceil(viewport.height)}px`
    pageElement.append(canvas)
    pagesElement.append(pageElement)
    activeRenderTasks.add(renderTask)

    try {
      await renderTask.promise
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') {
        throw error
      }
    } finally {
      activeRenderTasks.delete(renderTask)
    }
  }

  if (currentRender === renderVersion) {
    viewportElement.scrollLeft = previousScrollLeft
    viewportElement.scrollTop = previousScrollTop
    viewportElement.setAttribute('aria-busy', 'false')
  }
}

function changeZoom(factor) {
  const nextZoom = Math.max(0.5, Math.min(2, zoom * factor))
  if (nextZoom === zoom) {
    return
  }

  zoom = nextZoom
  clearTimeout(zoomRenderTimer)
  zoomRenderTimer = setTimeout(renderDocument, 80)
}

function touchDistance(touches) {
  const horizontal = touches[0].clientX - touches[1].clientX
  const vertical = touches[0].clientY - touches[1].clientY
  return Math.hypot(horizontal, vertical)
}

viewportElement.addEventListener('wheel', (event) => {
  if (!event.ctrlKey && !event.metaKey) {
    return
  }

  event.preventDefault()
  changeZoom(Math.exp(-event.deltaY * 0.0015))
}, { passive: false })

viewportElement.addEventListener('touchstart', (event) => {
  lastPinchDistance = event.touches.length === 2 ? touchDistance(event.touches) : null
}, { passive: true })

viewportElement.addEventListener('touchmove', (event) => {
  if (event.touches.length !== 2 || lastPinchDistance === null) {
    return
  }

  event.preventDefault()
  const nextDistance = touchDistance(event.touches)
  changeZoom(nextDistance / lastPinchDistance)
  lastPinchDistance = nextDistance
}, { passive: false })

viewportElement.addEventListener('touchend', (event) => {
  if (event.touches.length < 2) {
    lastPinchDistance = null
  }
}, { passive: true })

viewportElement.addEventListener('keydown', (event) => {
  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    changeZoom(1.1)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    changeZoom(1 / 1.1)
  } else if (event.key === '0') {
    event.preventDefault()
    zoom = 1
    clearTimeout(zoomRenderTimer)
    renderDocument()
  }
})

renderDocument()
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(renderDocument, 120)
})
