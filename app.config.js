module.exports = ({ config }) => {
  const basePath = process.env.EXPO_BASE_PATH || '';
  if (!/^(?:\/[A-Za-z0-9._~-]+)*$/.test(basePath)) {
    throw new Error('EXPO_BASE_PATH must be empty or an absolute URL path without a trailing slash.');
  }
  return {
    ...config,
    experiments: { ...config.experiments, baseUrl: basePath },
  };
};
