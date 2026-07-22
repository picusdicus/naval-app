import { useEffect, useRef, useState } from 'react'

export function useLazyLoad(items, itemsPerPage = 12) {
  const [displayed, setDisplayed] = useState(Math.min(itemsPerPage, items.length))
  const observerRef = useRef(null)

  useEffect(() => {
    setDisplayed(Math.min(itemsPerPage, items.length))
  }, [items, itemsPerPage])

  useEffect(() => {
    if (!observerRef.current || displayed >= items.length) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && displayed < items.length) {
        setDisplayed((prev) => Math.min(prev + itemsPerPage, items.length))
      }
    })

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [displayed, items.length, itemsPerPage])

  return {
    items: items.slice(0, displayed),
    isComplete: displayed >= items.length,
    observerRef,
  }
}
