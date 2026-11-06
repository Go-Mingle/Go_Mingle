import { describe, it, expect } from 'vitest'

import {
  LoginStep,
  RequestOtpStep,
  VerifyOtpStep,
  NewPasswordStep,
  SuccessStep,
} from '../components/LoginSteps'

describe('LoginSteps barrel', () => {
  it('re-exports all login step components', () => {
    expect(LoginStep).toBeDefined()
    expect(RequestOtpStep).toBeDefined()
    expect(VerifyOtpStep).toBeDefined()
    expect(NewPasswordStep).toBeDefined()
    expect(SuccessStep).toBeDefined()
  })
})
