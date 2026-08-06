import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './diagnostics'

describe('known client error messages', () => {
  it('turns wallet rejection errors into an actionable message', () => {
    expect(getErrorMessage(new Error('User has rejected the request')))
      .toBe('Transaction cancelled in wallet.')
  })

  it('turns duplicate-name errors into a recovery instruction', () => {
    expect(getErrorMessage(new Error('blob already exists on Shelby')))
      .toBe('A work with this blob name already exists. Choose a new name.')
  })

  it('turns timeout errors into a retry instruction', () => {
    expect(getErrorMessage(new Error('Shelby request timed out')))
      .toBe('The request timed out. Check the network and try again.')
  })
})
