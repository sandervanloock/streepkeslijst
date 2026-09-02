import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Login } from './Login'

const signIn = vi.fn(() => Promise.resolve())
vi.mock('./auth', () => ({ signIn: () => signIn() }))

afterEach(() => {
  cleanup()
  signIn.mockReset()
  signIn.mockResolvedValue(undefined)
})

test('wordmark in Anton, lime full-width tap target, canvas glow not covered', () => {
  const { container } = render(<Login />)

  const title = screen.getByRole('heading', { name: 'Streepkeslijst' })
  expect(title.style.font).toContain('Anton')
  expect(title.style.textTransform).toBe('uppercase')

  const button = screen.getByRole('button', { name: 'Aanmelden met Google' })
  expect(button.style.background).toBe('#D8F651')
  expect(button.style.width).toBe('100%')
  expect(parseInt(button.style.minHeight)).toBeGreaterThanOrEqual(44)

  // The body carries the radial glow + scanlines, so main must stay transparent.
  expect(container.querySelector('main')!.style.background).toBe('')
})

test('sign-in errors are shown inline', async () => {
  signIn.mockRejectedValue(new Error('popup gesloten'))
  render(<Login />)

  fireEvent.click(screen.getByRole('button'))

  expect((await screen.findByRole('alert')).textContent).toBe('popup gesloten')
  expect(signIn).toHaveBeenCalledTimes(1)
})
