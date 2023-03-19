const { override, addWebpackPlugin } = require("customize-cra");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const { dependencies } = require("./package.json");
const {
  ModuleFederationTypesPlugin,
} = require("@cloudbeds/webpack-module-federation-types-plugin");
/** 修改publicPath */
const rewriteOutputPublicPath = () => (config) => {
  config.output.publicPath = "auto";
  return config;
};

const ModifyChunkFileName = () => (config) => {
  config.optimization = {
    minimize: false,
    chunkIds: "named",
    moduleIds: "named",
  };
  config.target = "web";

  return config;
};

const replaceHtmlWebpackPlugin = () => (config) => {
  // 查找 HtmlWebpackPlugin
  const htmlWebpackPluginIndex = config.plugins.findIndex(
    (plugin) => plugin instanceof HtmlWebpackPlugin
  );

  // 如果找到了 HtmlWebpackPlugin，则替换其配置项
  if (htmlWebpackPluginIndex !== -1) {
    const newHtmlWebpackPlugin = new HtmlWebpackPlugin({
      inject: true,
      template: "/Users/yingying.chang/federation_main/public/index.html",
      version: 5,
      chunks: ["main"],
    });

    config.plugins[htmlWebpackPluginIndex] = newHtmlWebpackPlugin;
  }

  return config;
};

module.exports = {
  webpack: override(
    replaceHtmlWebpackPlugin(),
    rewriteOutputPublicPath() /** 必须要添加的，否则 container 项目加载这里的 exposes 时会找不到对应的依赖地址 */,
    ModifyChunkFileName(),
    addWebpackPlugin(
      new ModuleFederationPlugin({
        name: "testCRA",
        filename: "moduleEntry.js",
        exposes: {
          "./Button": "./src/Button.tsx",
          // "./AntdButton": "./src/Case.tsx",
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
    addWebpackPlugin(new ModuleFederationTypesPlugin({}))
  ),
};
