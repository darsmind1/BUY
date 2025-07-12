
// src/lib/config.ts
const config = {
  stm: {
    clientId: process.env.STM_CLIENT_ID || '',
    clientSecret: process.env.STM_CLIENT_SECRET || '',
  },
};

export default config;
