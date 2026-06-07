import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { openAPI } from 'better-auth/plugins';

import { prisma } from './prisma';
export const auth = betterAuth({
  trustedOrigins: [
    'https://demo.appointment-manager.dev',
    'http://localhost:4200',
    'http://localhost:4000',
  ],
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      const fullUrl = new URL(url);
      const params = new URLSearchParams(fullUrl.search);
      const callbackUrl = params.get('callbackURL');

      if (callbackUrl) {
        const decodedRedirectUrl = decodeURIComponent(callbackUrl);
        const passwordResetURL = `${decodedRedirectUrl}?token=${token}`;
        console.log('Redirect To:', passwordResetURL);
      }
      // await sendEmail({
      //     to: user.email,
      //     subject: "Reset your password",
      //     text: `Click the link to reset your password: ${passwordResetURL}`,
      // });
    },
  },
  plugins: [openAPI()],
});
