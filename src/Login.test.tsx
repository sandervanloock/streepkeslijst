import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { Login } from './Login'

let resolveSignIn: () => void
const signIn = vi.fn(() => new Promise<void>((res) => (resolveSignIn = res)))
vi.mock('./auth', () => ({ signIn: () => signIn() }))

afterEach(() => {
  cleanup()
  signIn.mockReset()
  signIn.mockImplementation(() => new Promise<void>((res) => (resolveSignIn = res)))
})

test('start state: wordmark in Anton, paper Google pill, canvas glow not covered', () => {
  const { container } = render(<Login />)

  const title = screen.getByRole('heading', { name: /streepkes\s*lijst/i })
  expect(title.style.font).toContain('Anton')
  expect(title.style.textTransform).toBe('uppercase')

  const button = screen.getByRole('button', { name: /Doorgaan met Google/ })
  expect(button.style.background).toBe('#F4F1E6')
  expect(button.style.borderRadius).toBe('99px')
  expect(parseInt(button.style.height)).toBeGreaterThanOrEqual(44)

  // The body carries the radial glow + scanlines, so main must stay transparent.
  expect(container.querySelector('main')!.style.background).toBe('')
})

test('clicking swaps the button for the checking state', () => {
  render(<Login />)

  fireEvent.click(screen.getByRole('button', { name: /Doorgaan met Google/ }))

  expect(signIn).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Google-account controleren…')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Doorgaan met Google/ })).toBeNull()
  resolveSignIn() // App.tsx swaps in Lijst from here; the screen stays in "bezig"
})

test('a failed sign-in shows the error inline and restores the button', async () => {
  signIn.mockRejectedValue(new Error('popup gesloten'))
  render(<Login />)

  fireEvent.click(screen.getByRole('button', { name: /Doorgaan met Google/ }))

  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('popup gesloten')
  expect(screen.getByRole('button', { name: /Doorgaan met Google/ })).toBeTruthy()
})

test('the waarom sheet explains the invite-only rule', () => {
  render(<Login />)

  expect(screen.queryByText(/Waarom enkel op uitnodiging/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'waarom?' }))
  expect(screen.getByText(/Waarom enkel op uitnodiging/)).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'Duidelijk' }))
  expect(screen.queryByText(/Waarom enkel op uitnodiging/)).toBeNull()
})
