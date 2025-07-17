// src/lib/config.ts

interface StmCredential {
  clientId: string;
  clientSecret: string;
}

const getStmCredentials = (): StmCredential[] => {
  const credentials: StmCredential[] = [];
  let i = 1;
  while (true) {
    const clientId = process.env[`STM_CLIENT_ID_${i}`];
    const clientSecret = process.env[`STM_CLIENT_SECRET_${i}`];

    if (clientId && clientSecret) {
      credentials.push({ clientId, clientSecret });
      i++;
    } else {
      // If the first one isn't found, check the original env vars for backward compatibility
      if (i === 1) {
          const defaultClientId = process.env.STM_CLIENT_ID;
          const defaultClientSecret = process.env.STM_CLIENT_SECRET;
          if (defaultClientId && defaultClientSecret) {
              credentials.push({ clientId: defaultClientId, clientSecret: defaultClientSecret });
          }
      }
      break; // Exit loop if no more numbered credentials are found
    }
  }
  return credentials;
};


const config = {
  stm: {
    credentials: getStmCredentials(),
  },
};

export default config;
