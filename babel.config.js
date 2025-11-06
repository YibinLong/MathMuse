module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated requires its Babel plugin and it must be listed last
    plugins: ['react-native-reanimated/plugin']
  };
};


