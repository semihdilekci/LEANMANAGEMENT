import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/** @Public() mutating endpoint’lerde CSRF istenmez (login, reset vb.) */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
