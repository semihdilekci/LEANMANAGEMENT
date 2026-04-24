import { SetMetadata } from '@nestjs/common';

export const SKIP_CONSENT_KEY = 'skipConsent';

/** Aktif rıza yokken bile erişilebilir — yalnızca POST /auth/consent/accept */
export const SkipConsent = () => SetMetadata(SKIP_CONSENT_KEY, true);
