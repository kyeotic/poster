import { createSignal, onCleanup, onMount } from 'solid-js'
import Toggle from '../components/Toggle'

// Letter size at 96dpi — 1 CSS px = 1/96 inch, so these print at exactly 8.5"×11"
const PAGE_W = 816 // 8.5"
const PAGE_H = 1056 // 11"
const PADDING = 48

export default function PosterPage() {
  let containerRef!: HTMLDivElement
  let editorRef!: HTMLDivElement

  const [scale, setScale] = createSignal(1)
  const [wordWrap, setWordWrap] = createSignal(true)
  const [sizeEachLine, setSizeEachLine] = createSignal(false)

  const updateScale = () => {
    if (!containerRef) return
    const s = Math.min(
      containerRef.clientWidth / PAGE_W,
      containerRef.clientHeight / PAGE_H,
      1,
    )
    setScale(s)
  }

  let isScaling = false
  const scaleFontSize = () => {
    if (isScaling || !editorRef) return
    isScaling = true
    try {

    const availH = PAGE_H - PADDING * 2
    const availW = PAGE_W - PADDING * 2

    const style = window.getComputedStyle(editorRef)
    const fontFamily = style.fontFamily
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const rawText =
      editorRef.childElementCount > 0
        ? Array.from(editorRef.childNodes)
            .reduce<string[]>((parts, node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                const t = node.textContent ?? ''
                if (t) parts.push(t)
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                parts.push((node as HTMLElement).textContent ?? '')
              }
              return parts
            }, [])
            .join('\n')
        : (editorRef.textContent ?? '')

    // Per-line mode: each line gets its own maximum font size.
    if (!wordWrap() && sizeEachLine()) {
      const lines = rawText.split('\n')
      const LINE_HEIGHT = 1.1
      const EMPTY_LINE_PX = 20 // small fixed height for blank lines

      // Save cursor as (child-node index, char offset within that line's text)
      // so we can restore it after rebuilding the DOM.
      let cursorLine = lines.length - 1
      let cursorOffset = 0
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const anchor = sel.anchorNode
        if (anchor && editorRef.contains(anchor)) {
          const kids = Array.from(editorRef.childNodes)
          for (let i = 0; i < kids.length; i++) {
            const kid = kids[i]
            if (kid === anchor || (kid as Element).contains?.(anchor)) {
              cursorLine = i
              const r = document.createRange()
              r.setStart(kid, 0)
              r.setEnd(anchor, sel.anchorOffset)
              cursorOffset = r.toString().length
              break
            }
          }
        }
      }

      // Measure each non-empty line via a hidden off-DOM span.
      // Linear scaling from a known reference size avoids canvas font-loading issues.
      const measureEl = document.createElement('span')
      measureEl.style.position = 'absolute'
      measureEl.style.visibility = 'hidden'
      measureEl.style.whiteSpace = 'nowrap'
      measureEl.style.fontWeight = '700'
      measureEl.style.fontSize = '100px'
      measureEl.style.fontFamily = fontFamily
      document.body.appendChild(measureEl)

      const sizes = lines.map((line) => {
        if (!line.trim()) return 0
        measureEl.textContent = line
        const w = measureEl.offsetWidth
        return w ? Math.max(8, Math.min(1200, Math.floor((100 * availW) / w))) : 100
      })

      document.body.removeChild(measureEl)

      // Empty lines use a small fixed height, not the average of other lines.
      const totalH = sizes.reduce(
        (sum, s) => sum + (s > 0 ? s : EMPTY_LINE_PX) * LINE_HEIGHT,
        0,
      )
      const factor = totalH > availH ? availH / totalH : 1

      editorRef.style.fontSize = ''
      editorRef.innerHTML = ''
      lines.forEach((line, i) => {
        const div = document.createElement('div')
        div.style.lineHeight = '1.1'
        div.style.margin = '0'
        if (line) {
          div.style.fontSize = `${Math.max(8, Math.floor(sizes[i] * factor))}px`
          div.textContent = line
        } else {
          div.style.fontSize = `${Math.floor(EMPTY_LINE_PX * factor)}px`
          div.appendChild(document.createElement('br'))
        }
        editorRef.appendChild(div)
      })

      // Post-render correction: if browser rendering exceeds available height, scale all
      // font sizes down proportionally to fit exactly. Loop because Math.floor rounding
      // may leave residual overflow.
      for (let pass = 0; pass < 3; pass++) {
        const actualH = editorRef.offsetHeight
        if (actualH <= availH) break
        const shrink = availH / actualH
        for (const child of editorRef.children as HTMLCollectionOf<HTMLElement>) {
          const px = parseFloat(child.style.fontSize)
          if (px) child.style.fontSize = `${Math.floor(px * shrink)}px`
        }
      }

      // Restore cursor to saved line/offset rather than always jumping to end.
      if (sel) {
        const targetIdx = Math.min(cursorLine, editorRef.children.length - 1)
        const targetDiv = editorRef.children[targetIdx] as HTMLElement | undefined
        if (targetDiv) {
          try {
            const range = document.createRange()
            const textNode = targetDiv.firstChild
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              range.setStart(textNode, Math.min(cursorOffset, textNode.textContent?.length ?? 0))
            } else {
              range.setStart(targetDiv, 0)
            }
            range.collapse(true)
            sel.removeAllRanges()
            sel.addRange(range)
          } catch {
            // ignore positioning errors
          }
        }
      }
      return
    }

    // Unified mode: only flatten if children came from size-each-line mode
    // (they'll have per-line font-size styles). Leave browser-created divs
    // (from Enter) intact so trailing newlines remain visible.
    if (editorRef.childElementCount > 0) {
      const hasPerLineStyles = Array.from(editorRef.children).some(
        (el) => (el as HTMLElement).style.fontSize,
      )
      if (hasPerLineStyles) {
        editorRef.textContent = rawText
      }
    }

    let lo = 8,
      hi = 1200

    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2)
      editorRef.style.fontSize = `${mid}px`

      // Height check: how tall is the text at this font size?
      const fitsHeight = editorRef.offsetHeight <= availH

      // Width check using canvas to avoid layout thrashing.
      ctx.font = `700 ${mid}px ${fontFamily}`
      let maxWidth: number
      if (wordWrap()) {
        // Word-wrap mode: ensure no single word exceeds the available width.
        const words = rawText.split(/\s+/).filter(Boolean)
        maxWidth = words.length ? Math.max(...words.map((w) => ctx.measureText(w).width)) : 0
      } else {
        // No-wrap mode: ensure no line (split only on newlines) exceeds the available width.
        const lines = rawText.split('\n')
        maxWidth = lines.length ? Math.max(...lines.map((l) => ctx.measureText(l).width)) : 0
      }
      const fitsWidth = maxWidth <= availW

      if (fitsHeight && fitsWidth) {
        lo = mid
      } else {
        hi = mid
      }
    }

    editorRef.style.fontSize = `${lo}px`
    } finally {
      isScaling = false
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!sizeEachLine() || wordWrap() || e.key !== 'Enter') return
    e.preventDefault()

    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !editorRef) return

    const range = sel.getRangeAt(0)
    range.deleteContents()

    // Find the direct child of editorRef that contains the cursor
    let lineNode: Node | null = range.startContainer
    while (lineNode && lineNode.parentNode !== editorRef) {
      lineNode = lineNode.parentNode
    }

    if (!lineNode) {
      // Cursor directly in editorRef (no div structure yet) — append a new line
      const newDiv = document.createElement('div')
      newDiv.appendChild(document.createElement('br'))
      editorRef.appendChild(newDiv)
      const r = document.createRange()
      r.setStart(newDiv, 0)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
      scaleFontSize()
      return
    }

    // Split the current line at the cursor
    const beforeRange = document.createRange()
    beforeRange.setStart(lineNode, 0)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const textBefore = beforeRange.toString()

    const afterRange = document.createRange()
    afterRange.setStart(range.startContainer, range.startOffset)
    afterRange.setEnd(lineNode, lineNode.childNodes.length)
    const textAfter = afterRange.toString()

    const lineEl = lineNode as HTMLElement
    lineEl.innerHTML = ''
    if (textBefore) {
      lineEl.textContent = textBefore
    } else {
      lineEl.appendChild(document.createElement('br'))
    }

    const newDiv = document.createElement('div')
    if (textAfter) {
      newDiv.textContent = textAfter
    } else {
      newDiv.appendChild(document.createElement('br'))
    }
    lineEl.after(newDiv)

    // Move cursor to start of the new line
    const r = document.createRange()
    const fc = newDiv.firstChild
    if (fc?.nodeType === Node.TEXT_NODE) {
      r.setStart(fc, 0)
    } else {
      r.setStart(newDiv, 0)
    }
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)

    scaleFontSize()
  }

  onMount(() => {
    updateScale()
    scaleFontSize()

    const observer = new ResizeObserver(() => {
      updateScale()
    })
    observer.observe(containerRef)

    // Before printing, convert font-sizes from px to physical `in` and shrink
    // slightly (3%) to prevent clipping from mobile print rendering differences.
    const PRINT_SHRINK = 0.97
    const handleBeforePrint = () => {
      const pxSize = parseFloat(editorRef.style.fontSize) || 0
      if (pxSize) {
        editorRef.style.fontSize = `${(pxSize * PRINT_SHRINK) / 96}in`
      }
      // Also convert per-line font sizes (size-each-line mode)
      for (const child of editorRef.children as HTMLCollectionOf<HTMLElement>) {
        const childPx = parseFloat(child.style.fontSize)
        if (childPx) {
          child.style.fontSize = `${(childPx * PRINT_SHRINK) / 96}in`
        }
      }
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
            align-items: center !important;
            justify-content: center !important;
            width: 8.5in !important;
            height: 11in !important;
            padding: 0.5in !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          .poster-editor {
            width: 100% !important;
            text-align: center !important;
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
        <Toggle
          isChecked={wordWrap()}
          label="Word Wrap"
          onChange={(val) => {
            setWordWrap(val)
            scaleFontSize()
          }}
        />
        {!wordWrap() && (
          <Toggle
            isChecked={sizeEachLine()}
            label="Size Each Line"
            onChange={(val) => {
              setSizeEachLine(val)
              scaleFontSize()
            }}
          />
        )}
      </div>

      {/* Background fills available space; keeps the page centered */}
      <div
        ref={containerRef}
        class="poster-bg flex-1 flex items-center justify-center bg-gray-500 -mx-4 -mb-4 overflow-hidden min-h-0"
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
                onKeyDown={handleKeyDown}
                class="poster-editor outline-none w-full text-center font-bold"
                style={{
                  'white-space': wordWrap() ? 'pre-wrap' : 'pre',
                  'overflow-wrap': wordWrap() ? 'break-word' : 'normal',
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
