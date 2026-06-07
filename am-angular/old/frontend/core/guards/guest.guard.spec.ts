import { TestBed } from '@angular/core/testing';
import { CanMatchFn } from '@angular/router';

import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  const executeGuard: CanMatchFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => guestGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
