// Metro configuration with NativeWind
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  // Keep default options; enable TS types generation if you like
  disableTypeScriptGeneration: false
});


