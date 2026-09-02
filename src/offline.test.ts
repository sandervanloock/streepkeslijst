import { expect, test } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOnline } from './offline'

test('follows the browser going offline and back', () => {
  const { result } = renderHook(() => useOnline())
  expect(result.current).toBe(true)

  act(() => window.dispatchEvent(new Event('offline')))
  expect(result.current).toBe(false)

  act(() => window.dispatchEvent(new Event('online')))
  expect(result.current).toBe(true)
})
