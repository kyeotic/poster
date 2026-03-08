import { createSignal, onCleanup, onMount } from 'solid-js'

// Letter size at 96dpi — 1 CSS px = 1/96 inch, so these print at exactly 8.5"×11"
const PAGE_W = 816 // 8.5"
const PAGE_H = 1056 // 11"
const PADDING = 48

export default function PosterPage() {
  let containerRef!: HTMLDivElement
  let editorRef!: HTMLDivElement

  const [scale, setScale] = createSignal(1)

  const updateScale = () => {
    if (!containerRef) return
    const s = Math.min(
      containerRef.clientWidth / PAGE_W,
      containerRef.clientHeight / PAGE_H,
      1,
    )
    setScale(s)
  }

  const scaleFontSize = () => {
    if (!editorRef) return

    const availH = PAGE_H - PADDING * 2
    const availW = PAGE_W - PADDING * 2

    // canvas measureText for per-word width check (prevents mid-word breaks)
    const style = window.getComputedStyle(editorRef)
    const fontFamily = style.fontFamily
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const rawText = editorRef.innerText ?? ''
    const words = rawText.split(/\s+/).filter(Boolean)

    let lo = 8,
      hi = 1200

    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      editorRef.style.fontSize = `${mid}px`

      // Height check: how tall is the text when allowed to word-wrap?
      const fitsHeight = editorRef.offsetHeight <= availH

      // Width check: does any single word overflow the available width?
      // Using canvas so we don't need to toggle white-space on the live element.
      ctx.font = `700 ${mid}px ${fontFamily}`
      const maxWord = words.length
        ? Math.max(...words.map((w) => ctx.measureText(w).width))
        : 0
      const fitsWidth = maxWord <= availW

      if (fitsHeight && fitsWidth) {
        lo = mid
      } else {
        hi = mid
      }
    }

    editorRef.style.fontSize = `${lo}px`
  }

  onMount(() => {
    updateScale()
    scaleFontSize()

    const observer = new ResizeObserver(() => {
      updateScale()
    })
    observer.observe(containerRef)

    // Before printing, convert font-size from px to physical `in` so the browser
    // renders it at the correct size regardless of the print viewport / DPI.
    const handleBeforePrint = () => {
      const pxSize = parseFloat(editorRef.style.fontSize) || 100
      editorRef.style.fontSize = `${pxSize / 96}in`
    }
    // After printing, restore the px-based size for the screen layout.
    const handleAfterPrint = () => {
      scaleFontSize()
    }

    window.addEventListener('beforeprint', handleBeforePrint)
    window.addEventListener('afterprint', handleAfterPrint)

    onCleanup(() => {
      observer.disconnect()
      window.removeEventListener('beforeprint', handleBeforePrint)
      window.removeEventListener('afterprint', handleAfterPrint)
    })
  })

  return (
    <>
      <style>{`
        @media print {
          @page { size: 8.5in 11in portrait; margin: 0; }

          /* Reset the outer SolidJS app layout so it doesn't constrain print */
          html, body,
          body > div,
          body > div > main {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            max-height: none !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            width: 100% !important;
          }

          /* Hide non-poster UI */
          .poster-controls { display: none !important; }
          .poster-bg {
            background: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Remove the scale transform wrappers */
          .poster-scale-outer,
          .poster-page-transform {
            display: block !important;
            position: static !important;
            transform: none !important;
            width: auto !important;
            height: auto !important;
          }

          /*
           * Page fills the paper exactly.
           * All dimensions use physical 'in' units so they are device/DPI-independent.
           * PADDING=48px = 48/96in = 0.5in.
           * overflow:visible prevents clipping if the browser's print px mapping
           * differs slightly from the screen; the paper edge becomes the natural clip.
           */
          .poster-page {
            display: flex !important;
            width: 8.5in !important;
            height: 11in !important;
            padding: 0.5in !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
        }

        .poster-editor:empty::before {
          content: 'Start typing…';
          color: #bbb;
          pointer-events: none;
        }
      `}</style>

      <div class="flex gap-2 mb-3 print:hidden">
        <button
          onClick={() => window.print()}
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer text-sm font-medium"
        >
          Print
        </button>
      </div>

      {/* Background fills available space; keeps the page centered */}
      <div
        ref={containerRef}
        class="poster-bg flex-1 flex items-center justify-center bg-gray-500 -mx-4 -mb-4 overflow-hidden"
      >
        {/*
          Outer div occupies exactly the scaled dimensions in layout so the
          flex container sizes correctly and there is no mobile overflow.
        */}
        <div
          class="poster-scale-outer"
          style={{
            width: `${PAGE_W * scale()}px`,
            height: `${PAGE_H * scale()}px`,
            'flex-shrink': '0',
            position: 'relative',
          }}
        >
          {/* Inner div applies the visual scale from the top-left corner */}
          <div
            class="poster-page-transform"
            style={{
              transform: `scale(${scale()})`,
              'transform-origin': 'top left',
              position: 'absolute',
              top: '0',
              left: '0',
            }}
          >
            <div
              class="poster-page bg-white shadow-2xl"
              style={{
                width: `${PAGE_W}px`,
                height: `${PAGE_H}px`,
                padding: `${PADDING}px`,
                'box-sizing': 'border-box',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                overflow: 'hidden',
              }}
            >
              <div
                ref={editorRef}
                contentEditable="true"
                onInput={scaleFontSize}
                class="poster-editor outline-none w-full text-center font-bold"
                style={{
                  'white-space': 'pre-wrap',
                  'overflow-wrap': 'break-word',
                  'line-height': '1.1',
                  'font-size': '100px',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
