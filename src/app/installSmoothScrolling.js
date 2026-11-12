const SCROLL_SMOOTHING = 140
const WHEEL_SCALE = 0.8
const TOUCH_SCALE = 0.72

function getScrollTop(element, root) {
  return element === root ? window.scrollY : element.scrollTop
}

function getMaxScroll(element, root) {
  return element === root
    ? Math.max(0, root.scrollHeight - window.innerHeight)
    : Math.max(0, element.scrollHeight - element.clientHeight)
}

function canScroll(element, delta, root, animations) {
  if (element !== root) {
    const overflowY = window.getComputedStyle(element).overflowY
    if (!['auto', 'scroll', 'overlay'].includes(overflowY)) return false
    if (element.scrollHeight <= element.clientHeight + 1) return false
  }

  const animation = animations.get(element)
  const position = animation?.target ?? getScrollTop(element, root)
  const maxScroll = getMaxScroll(element, root)
  return delta > 0 ? position < maxScroll - 1 : position > 1
}

function findScrollTarget(target, delta, root, animations) {
  let element = target instanceof Element ? target : target?.parentElement
  while (element && element !== document.documentElement) {
    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element)
      if (canScroll(element, delta, root, animations)) return element
      if (['auto', 'scroll', 'overlay'].includes(style.overflowY)
        && element.scrollHeight > element.clientHeight + 1
        && ['contain', 'none'].includes(style.overscrollBehaviorY)) return null
    }
    element = element.parentElement
  }
  return canScroll(root, delta, root, animations) ? root : null
}

export function installSmoothScrolling() {
  const root = document.scrollingElement || document.documentElement
  const animations = new WeakMap()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let touchSession = null

  function animate(element, animation, time) {
    if (!element.isConnected && element !== root) {
      cancelAnimationFrame(animation.frame)
      animations.delete(element)
      return
    }

    const current = getScrollTop(element, root)
    const distance = animation.target - current
    if (Math.abs(distance) < 0.5) {
      element.scrollTop = animation.target
      animations.delete(element)
      return
    }

    const elapsed = Math.min(time - animation.lastFrame, 50)
    animation.lastFrame = time
    const progress = 1 - Math.exp(-elapsed / SCROLL_SMOOTHING)
    element.scrollTop = current + distance * progress
    animation.frame = requestAnimationFrame((nextTime) => animate(element, animation, nextTime))
  }

  function addScrollDelta(element, delta) {
    const current = getScrollTop(element, root)
    let animation = animations.get(element)
    if (!animation) {
      animation = { target: current, lastFrame: performance.now(), frame: 0 }
      animations.set(element, animation)
    }

    const previousTarget = animation.target
    animation.target = Math.max(0, Math.min(getMaxScroll(element, root), animation.target + delta))
    if (animation.target === previousTarget) return false

    if (!animation.frame) {
      animation.frame = requestAnimationFrame((time) => animate(element, animation, time))
    }
    return true
  }

  function handleWheel(event) {
    if (reducedMotion.matches || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !event.deltaY) return

    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? Math.max(window.innerHeight, 1)
        : 1
    const delta = event.deltaY * unit * WHEEL_SCALE
    const element = findScrollTarget(event.target, delta, root, animations)
    if (!element) return

    if (addScrollDelta(element, delta) && event.cancelable) event.preventDefault()
  }

  function handleTouchStart(event) {
    if (reducedMotion.matches || event.touches.length !== 1) {
      touchSession = null
      return
    }
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      touchSession = null
      return
    }
    for (let element = target; element && element !== document.documentElement; element = element.parentElement) {
      if (window.getComputedStyle(element).touchAction === 'none') {
        touchSession = null
        return
      }
    }
    const touch = event.touches[0]
    touchSession = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      lastY: touch.clientY,
      axis: null,
      didPreventDefault: false,
    }
  }

  function handleTouchMove(event) {
    if (reducedMotion.matches || !touchSession) return
    if (event.touches.length !== 1 || event.touches[0].identifier !== touchSession.identifier) {
      touchSession = null
      return
    }

    const touch = event.touches[0]
    const totalX = touch.clientX - touchSession.startX
    const totalY = touch.clientY - touchSession.startY
    if (!touchSession.axis) {
      if (Math.max(Math.abs(totalX), Math.abs(totalY)) < 8) return
      if (Math.abs(totalX) > Math.abs(totalY)) {
        touchSession.axis = 'horizontal'
        return
      }
      touchSession.axis = 'vertical'
    }
    if (touchSession.axis !== 'vertical') return

    const delta = (touchSession.lastY - touch.clientY) * TOUCH_SCALE
    touchSession.lastY = touch.clientY
    if (Math.abs(delta) < 0.25) return

    const element = findScrollTarget(event.target, delta, root, animations)
    if (!element) {
      if (touchSession.didPreventDefault && event.cancelable) event.preventDefault()
      return
    }

    if (addScrollDelta(element, delta)) {
      touchSession.didPreventDefault = true
      if (event.cancelable) event.preventDefault()
    }
  }

  function handleTouchEnd() {
    touchSession = null
  }

  window.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd, { passive: true })
  window.addEventListener('touchcancel', handleTouchEnd, { passive: true })
  return () => {
    window.removeEventListener('wheel', handleWheel)
    window.removeEventListener('touchstart', handleTouchStart)
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', handleTouchEnd)
    window.removeEventListener('touchcancel', handleTouchEnd)
  }
}
