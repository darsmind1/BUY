
const config = {
  stm: {
    clientId: process.env.STM_CLIENT_ID,
    clientSecret: process.env.STM_CLIENT_SECRET,
  },
};

if (!config.stm.clientId || config.stm.clientId === 'YOUR_CLIENT_ID_HERE') {
  throw new Error(
    'STM_CLIENT_ID is not defined in the environment variables. Please check your .env.local file.'
  );
}

if (!config.stm.clientSecret || config.stm.clientSecret === 'YOUR_CLIENT_SECRET_HERE') {
  throw new Error(
    'STM_CLIENT_SECRET is not defined in the environment variables. Please check your .env.local file.'
  );
}

export default config;
