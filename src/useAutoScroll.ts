import { useRef, useEffect, useCallback } from 'react'

export function useAutoScroll({ isScrolling }: { isScrolling: boolean }) {
  const scrollTargetRef = useRef(0)
  const scrollAnimRef = useRef<number | null>(null)

  useEffect(() => {
    if (isScrolling) {
      scrollTargetRef.current = window.scrollY
      function tick() {
        const diff = scrollTargetRef.current - window.scrollY
        if (Math.abs(diff) > 0.5) {
          window.scrollTo(0, window.scrollY + diff * 0.08)
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
  }, [isScrolling])

  const scrollTo = useCallback((target: number) => {
    scrollTargetRef.current = target
  }, [])

  return { scrollTo }
}
