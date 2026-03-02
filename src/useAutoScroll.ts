import { useRef, useEffect, useCallback } from 'react'

export function useAutoScroll({ isScrolling, containerRef }: {
  isScrolling: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
}) {
  const scrollTargetRef = useRef(0)
  const scrollAnimRef = useRef<number | null>(null)

  useEffect(() => {
    if (isScrolling) {
      const container = containerRef?.current
      scrollTargetRef.current = container ? container.scrollTop : window.scrollY
      function tick() {
        const container = containerRef?.current
        const current = container ? container.scrollTop : window.scrollY
        const diff = scrollTargetRef.current - current
        if (Math.abs(diff) > 0.5) {
          const next = current + diff * 0.08
          if (container) {
            container.scrollTop = next
          } else {
            window.scrollTo(0, next)
          }
        }
        scrollAnimRef.current = requestAnimationFrame(tick)
      }
      scrollAnimRef.current = requestAnimationFrame(tick)
    } else {
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current)
        scrollAnimRef.current = null
      }
    }

    return () => {
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current)
        scrollAnimRef.current = null
      }
    }
  }, [isScrolling, containerRef])

  const scrollTo = useCallback((target: number) => {
    scrollTargetRef.current = target
  }, [])

  return { scrollTo }
}
