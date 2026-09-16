const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        // Absolute path so `.env` is found no matter which directory Metro /
        // `expo start` is launched from. A RELATIVE path resolves against
        // process.cwd(); when Metro runs from a parent folder (e.g. the repo
        // root instead of expenses-ginie/), the file isn't found and — with
        // allowUndefined:true — every env var silently becomes `undefined`,
        // so BASE_URL is empty and every backend request fails with
        // "Network request failed".
        path: path.resolve(__dirname, '.env'),
        blacklist: null,
        whitelist: null,
        safe: false,
        allowUndefined: true,
      }],
      'react-native-reanimated/plugin', // MUST be last
    ],
  };
};
