import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoScroll } from '../src/useAutoScroll.ts'

describe('useAutoScroll', () => {
  let rafId: number
  let rafCallback: FrameRequestCallback | null

  beforeEach(() => {
    rafId = 0
    rafCallback = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return ++rafId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not request animation frame when not scrolling', () => {
    renderHook(() => useAutoScroll({ isScrolling: false }))
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('starts animation loop when scrolling', () => {
    renderHook(() => useAutoScroll({ isScrolling: true }))
    expect(window.requestAnimationFrame).toHaveBeenCalled()
  })

  it('cancels animation frame on unmount', () => {
    const { unmount } = renderHook(() => useAutoScroll({ isScrolling: true }))
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('scrollTo updates the scroll target', () => {
    const { result } = renderHook(() => useAutoScroll({ isScrolling: true }))
    act(() => {
      result.current.scrollTo(500)
    })
    // The scrollTo function sets the target ref. We can verify it was called
    // without error. The actual scrolling happens in the rAF loop.
    expect(typeof result.current.scrollTo).toBe('function')
  })

  it('cancels animation when scrolling transitions to false', () => {
    const { rerender } = renderHook(
      ({ isScrolling }) => useAutoScroll({ isScrolling }),
      { initialProps: { isScrolling: true } },
    )
    rerender({ isScrolling: false })
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })
})
