// Configuração do Metro. Na web (expo start --web), o expo-sqlite (sessão do Supabase) usa
// SQLite em WebAssembly, então o Metro precisa tratar .wasm como asset.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
