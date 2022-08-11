const { shareAll, withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack');
const addonConfig = require('../addon.config.json');
const blockName = `file_${addonConfig.AddonUUID}`;

const webpackConfig = withModuleFederationPlugin({
    name: blockName,
    filename: `${blockName}.js`,
    exposes: {
        './WebComponents': './src/bootstrap.ts',
    },
    shared: {
        ...shareAll({ strictVersion: true, requiredVersion: 'auto' }),
    }
});

module.exports = {
    ...webpackConfig,
    output: {
        ...webpackConfig.output,
        uniqueName: blockName,
    },
};

// const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
// const mf = require("@angular-architects/module-federation/webpack");
// const path = require("path");
// const share = mf.share;
// const singleSpaAngularWebpack = require('single-spa-angular/lib/webpack').default;
// const webpack = require('webpack');
// const { merge } = require('webpack-merge');

// const filename = 'query_manager'; // addon

// const sharedMappings = new mf.SharedMappings();
// sharedMappings.register(
//     path.join(__dirname, './tsconfig.json'),
//     [
//         /* mapped paths to share */
//     ]);

// module.exports = (config, options, env) => {

//     config.plugins.push(
//         new webpack.DefinePlugin({
//           CLIENT_MODE: JSON.stringify(env.configuration),
//         })
//     )
//     // Only if you need standalone
//     if (env.configuration === 'Standalone') {
//         return config;
//     }
//     else {
//     const mfConfig = {
//         output: {
//             uniqueName: `${filename}`,
//             publicPath: "auto",
//         },
//         optimization: {
//             // Only needed to bypass a temporary bug
//             runtimeChunk: false
//         },   
//         resolve: {
//             alias: {
//             ...sharedMappings.getAliases(),
//             }
//         },
//         plugins: [
//             new ModuleFederationPlugin({
//                 name: `${filename}`,
//                 filename: `${filename}.js`,
//                 exposes: {
//                   './QueryManagerComponent': './src/app/query_manager/index.ts',
//                   './QueryManagerModule': './src/app/query_manager/index.ts'
//                 },
//                 shared: share({
//                     "@angular/core": { eager: true, singleton: true, strictVersion: true, requiredVersion: 'auto' },
//                     "@angular/common": { eager: true, singleton: true, strictVersion: true, requiredVersion: 'auto' }, 
//                     "@angular/common/http": { eager: true, singleton: true, strictVersion: true, requiredVersion: 'auto' }, 
//                     "@angular/router": { eager: true, singleton: true, strictVersion: true, requiredVersion: 'auto' },
                    
//                     ...sharedMappings.getDescriptors()
//                 })
//             }),
//             sharedMappings.getPlugin()
//         ]
//     }

//     const merged = merge(config, mfConfig);
//     const singleSpaWebpackConfig = singleSpaAngularWebpack(merged, options);
//     singleSpaWebpackConfig.entry.main = [...new Set(singleSpaWebpackConfig.entry.main)];
//     return singleSpaWebpackConfig;
//     }
//     // Feel free to modify this webpack config however you'd like to
// };