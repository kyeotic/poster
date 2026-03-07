import { createSignal, onCleanup, onMount } from 'solid-js'

// Letter size at 96dpi (CSS pixels = print inches)
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
    )
    setScale(Math.min(s, 1))
  }

  const scaleFontSize = () => {
    if (!editorRef) return

    const availH = PAGE_H - PADDING * 2
    const availW = PAGE_W - PADDING * 2

    let lo = 8,
      hi = 1200

    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      editorRef.style.fontSize = `${mid}px`
      if (editorRef.offsetHeight <= availH && editorRef.scrollWidth <= availW) {
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
    onCleanup(() => observer.disconnect())
  })

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0; }
          body > *, main {
            padding: 0 !important;
            margin: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .poster-controls { display: none !important; }
          .poster-page-transform { transform: none !important; }
          .poster-page { box-shadow: none !important; }
        }
        .poster-editor:empty::before {
          content: 'Start typing your poster...';
          color: #aaa;
          pointer-events: none;
        }
      `}</style>

      <div class="poster-controls flex gap-2 mb-3">
        <button
          onClick={() => window.print()}
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer text-sm font-medium"
        >
          Print
        </button>
      </div>

      <div
        ref={containerRef}
        class="flex-1 flex items-center justify-center bg-gray-500 -mx-4 -mb-4 overflow-hidden"
      >
        <div
          class="poster-page-transform"
          style={{
            transform: `scale(${scale()})`,
            'transform-origin': 'center center',
            'flex-shrink': '0',
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
                'word-break': 'break-word',
                'overflow-wrap': 'break-word',
                'line-height': '1.1',
                'font-size': '100px',
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
