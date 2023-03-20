const { override, addWebpackPlugin } = require("customize-cra");

const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const { dependencies } = require("./package.json");
const {
  ModuleFederationTypesPlugin,
} = require("@cloudbeds/webpack-module-federation-types-plugin");

const ModifyChunkFileName = () => (config) => {
  config.optimization = {
    minimize: false,
    chunkIds: "named",
    moduleIds: "named",
  };
  config.target = "web";
  return config;
};

const workForRemoteModuleHMR = () => (config) => {
  config.output.uniqueName = "MyLibrary";
  // config.infrastructureLogging = {
  //   level: "log",
  // };
  return config;
};

module.exports = {
  webpack: override(
    workForRemoteModuleHMR(),
    ModifyChunkFileName(),
    addWebpackPlugin(
      new ModuleFederationPlugin({
        name: "main",
        remotes: {
          testCRA: "testCRA@http://localhost:4001/moduleEntry.js",
        },
        shared: {
          // ...dependencies,
          react: {
            singleton: true,
            requiredVersion: dependencies["react"],
          },
          "react-dom": {
            singleton: true,
            requiredVersion: dependencies["react-dom"],
          },
        },
      })
    ),
    addWebpackPlugin(
      new ModuleFederationTypesPlugin({
        // downloadTypesWhenIdleIntervalInSeconds: 60,
        // remoteEntryUrls: {
        //   testCRA: "http://localhost:4001",
        // },
      })
    )
  ),
};
