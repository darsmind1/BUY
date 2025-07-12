// src/lib/config.ts
const config = {
  stm: {
    clientId: process.env.NEXT_PUBLIC_STM_CLIENT_ID || '',
    clientSecret: process.env.NEXT_PUBLIC_STM_CLIENT_SECRET || '',
  },
};

export default config;
