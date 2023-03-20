# CRA 项目使用 Federation 实践

## 1 前言 & 背景

federation 是 webpack5 支持的一种跨项目资源共享的方式。

传统的跨项目资源共享方式有 npm、DLL、externals 等等，都有一定的局限性；
我所遇到的业务场景是组件库。组件库经常会有小 feature，修复一些小 bug。传统的 npm 方式在通过 npm link 联调时，因为要保证运行环境中只能有一个 react 实例，所以还要去 link react;并且组件库版本更新时，所有依赖的项目都要去更新版本，再重新构建、部署，流程繁琐。

所以使用 federation 主要考虑以下两个需求：

1. 开发过程中方便调试
2. 简化发版流程

这篇文章主要解析 federation 的原理，以及我在实践过程中踩的诸多坑，因为网上的大部分文章都是对配置的简单讲解。至于多种不同资源共享方案的优劣对比和适用场景，网上有很多资源，这篇文章不再赘述。
这里主要记录下在实践过程中的踩坑以及相关的原理解析。网上的大部分文章都是对配置的讲解，实际上还是会遇到很多问题，在这里记录一下希望能够提供一些帮助。

### 1.1 基础信息

在这个 demo 中, Remote 项目中暴露了自己的两个组件，Host 项目中引用了这两个组件。
项目信息：
CRA 5+
react: 18+

## 2 Federation 原理解析

### 2.1 是什么

federation 的核心思想是将一个应用程序的某些部分（如组件、工具或库）作为独立的模块暴露，以便其他应用程序可以在运行时动态地加载和使用这些模块.
federation 如何配置以及各个配置项是什么意思，请查看[官方文档](https://webpack.js.org/concepts/module-federation/)，这里也不再叙述，直接进入原理解析阶段。
在 Demo 中，Remote 项目暴露了 Button 组件，Host 项目使用了这个 Button 组件。

### 2.2 Federation 本质上就是异步加载模块

在做性能优化的时候，我们常常会把某些项目中的某些资源配置成懒加载：

```javascript
const Button = React.lazy(() => import("./Button"));
```

webpack 会把这个 Button 组件打包成一个单独的 chunk，并且在使用到这个组件的时候再去加载这个 chunk；

引用 Remote 项目的 Button 也是同样的使用方式：

```javascript
// 当前是在 Host 项目，引用 Remote 项目的 Button 组件
const Button = React.lazy(() => import("Remote/Button"));
```

同样地，在使用到远程项目中的 Button 模块时，才会去加载这个 chunk，只不过这个 chunk 在另一个独立的项目中；

所以 Federation 本质上就是异步加载模块；这个模块是其他应用暴露出来的 chunk，只要配置好资源链接地址，它能找得到这个 chunk 就行；

```javascript
/** Host 项目中要配置远程应用的入口地址 **/
const federation_config = {
  name: "Host",
  remotes: {
    Remote: "Remote@http://localhost:4001/remoteEntry.js",
  },
};
```

做了如上配置后，Host 项目是怎么加载 Remote 项目中的 button 的呢？从打包产物分析更容易理解

### 2.3 webpack 是怎么实现异步加载模块的

**2.3.1. 先来看一下 webpack 是怎么实现懒加载的**

```javascript
// 源码
const Button = React.lazy(() => import("./Button"));

// 编译成
var Button = __webpack_require__
  .e("src_Button_tsx")
  .then(__webpack_require__("src_Button_tsx")); // 简单起见，这里去掉了React.lazy的编译代码
```

`__webpack_require__.e` 是 webpack 中用来实现异步加载模块的一个方法，它通过动态添加 script 标签的方式实现异步加载模块；

```javascript
// __webpack_require__.e 就是执行 __webpack_require__.f 上的方法
__webpack_require__.e = (chunkId) => {
  return Promise.all(
    Object.keys(__webpack_require__.f).reduce((promises, key) => {
      __webpack_require__.f[key](chunkId, promises);
      return promises;
    }, [])
  );
};
//__webpack_require__.f 上有 __webpack_require__.f.j 方法，用于加载 js 文件，还有 __webpack_require__.f.miniCss 方法，用于加载 css 文件
```

**2.3.2 在这个基础之上再实现 federation**

那么 webpack 是怎么加载远程应用的模块的呢？

```javascript
const Button = React.lazy(() => import("Remote/Button"));

// 编译成
var Button = __webpack_require__
  .e("src_Button_tsx")
  .then(__webpack_require__("src_Button_tsx")); // 这里去掉了React.lazy的编译代码
```

它还是依靠 `__webpack_require__.e` 去加载的远程模块, `__webpack_require__.e`会执行 `__webpack_require__.f`上的所有方法，发生变化的是 `__webpack_require__.f`.

### 2.4 `__webpack_require__.f` 有哪些变化

`__webpack_require__.f` 上多出来了 **remotes** 和 **consumes** 方法.
**2.4.1. remotes 方法用于加载远程模块**
第一次加载远程模块时，要先加载远程应用的 remoteEntry 文件；

```javascript
/* 配置federation后，__webpack_require__.j上多出来了 remotes 和 consumes 方法 */
__webpack_require__.f.remotes = function () {
  // remotes 方法中用来处理 加载 moduleEntry 文件，加载 shared 模块，加载 Button 文件
  /**
   * 1. 加载远程应用的 remoteEntry 文件
   * 2. 执行 __webpack_require__.I 方法，也就是执行 remoteEntry 中暴露的init 方法，设置共享作用域
   * 3. 执行 remoteEntry 中暴露的 get 方法获取 Button 模块
   * 4. 将 Button 模块注册到项目的 __webpack_require__.m 中
   * 5. 加载 Button 模块 __webpack_require__(Button)
   * /
};
```

**2.4.2 consumes 方法用于处理 shared 模块**

上述的 Button 模块中引用了 React;当 Host 项目中使用这个 Button 时，应该保证它和其他 Local 组件使用同一个 React 实例；
所以在配置的时候要在 shared 中把 react 和 react-dom 配置为 singleton;

```javascript
/** Host 项目中要配置远程应用的入口地址 **/
const federation_config = {
  name: "Host",
  remotes: {
    Remote: "Remote@http://localhost:4001/remoteEntry.js",
  },
  shared: {
    react: {
      singleton: true,
      requiredVersion: dependencies["react"],
    },
    "react-dom": {
      singleton: true,
      requiredVersion: dependencies["react-dom"],
    },
  },
};
```

在 remotes 方法中的最后一步，\__webpack_require_(Button)时，处理 Button 中对 react 的消费，要用到 consumes 方法；
consumes 方法就是处理远程模块对 shared 中的共享模块的使用的。具体处理细节可以看下节对 Remote 打包产物的分析。

### 2.5 Remote 项目打包产物

结合上述分析也可以得到，Remote 项目的打包产物，要出来了以下 chunk:

1. `remoteEntry.js` 给 Host 项目的入口文件
2. `src_Button_tsx.js` 暴露给其他应用使用的 Button 组件

**2.5.1. remoteEntry.js**

remoteEntry.js 相当于定义了一个 module，这个 module 有两个方法：

```javascript
var Remote = {
    get:function(moduleId){...},
    init:() => {...}
}
```

`init` 方法用来初始化两个项目的共享作用域，共享作用域指的是 shared 中声明的依赖；
`get` 方法用来获取对应的组件，例如 get(Button);

Host 项目加载 remoteEntry 文件后，就会先后执行这两个方法。

**2.5.2 src_button_tsx.js**

Remote 项目的 bundle 中会有两个 button 的 chunk, 一个是普通的文件，另一个是给 Host 项目引用的文件；在这个给 Host 项目引用的 bundle 文件中，它包含了对 react 的依赖声明：`webpack_sharing_consume_default_react_react`；

consumes 方法会处理对`webpack_sharing_consume_default_react_react`模块的使用。

### 2.6 `__webpack_require__.I`处理共享作用域

待补充

## 3 踩坑

> 有一些坑是官网上说明了的。

### “shared module not found”

这是因为一旦配置了 `shared`，`shared`中声明的依赖就会被异步加载，它们是以异步的方式提供给应用程序的。[官网有说明](https://webpack.js.org/concepts/module-federation/#troubleshooting); 我用了它提供的“入口文件也异步加载”的方案解决的。

### Host 项目加载 Remote 模块时，地址错误

需要配置 `output.publicPath = "auto"`
在模块联邦架构中，各个应用程序可能会运行在不同的服务器或 URL 上，而这些应用程序之间会共享和动态加载代码。将 publicPath 设置为 auto 可以确保在运行时动态地确定资源的正确 URL，而不是硬编码到 Webpack 配置中。

### 添加 exposes 配置后热更新失败：

这是因为配置了 exposes 后，项目会生成两个入口文件，一个是项目的主入口 main，另外一个就是暴露给其他项目引用的 moduleEntry 入口文件，这两个入口文件同时被注入到 index.html 文件中；就会加载两份 webpack runtime 的代码，定义了两个 热更新的函数，所以在热更新的时候会错乱，具体原因可以看这里：https://github.com/module-federation/module-federation-examples/issues/358；

Remote 项目需要对 HtmlWebpackPlugin 的配置项做修改

```javascript
const replaceHtmlWebpackPlugin = () => (config) => {
  // 查找 HtmlWebpackPlugin
  const htmlWebpackPluginIndex = config.plugins.findIndex(
    (plugin) => plugin instanceof HtmlWebpackPlugin
  );

  // 如果找到了 HtmlWebpackPlugin，则替换其配置项
  if (htmlWebpackPluginIndex !== -1) {
    const newHtmlWebpackPlugin = new HtmlWebpackPlugin({
      inject: true,
      template: "./public/index.html",
      version: 5,
      chunks: ["main"], // 重点是添加这个，只加载 main chunk
    });

    config.plugins[htmlWebpackPluginIndex] = newHtmlWebpackPlugin;
  }

  return config;
};
```

### remote 模块无法在 host 项目热更新

主要表现为，remote 模块更改后，host 项目出发了整个热更新的流程，网络面板中有 hot-update 文件请求，但是 UI 无变化，表现和问题 1 一样。
这是因为此时运行了两个 react-refresh 的实例，一个是 host 项目自身的，一个是 remoteEntry 的；

host 项目要修改 webpack 配置: `config.output.uniqueName = "MyLibrary";`.

### CRA 项目 - 异步加载的模块热更新失败

这是 dev-server 的一个 bug，它误判了运行环境，认为是运行在非浏览器端所以跳过了 hmr 的执行，重新配置 webpack 的 target 即可: `config.target = "web"`。
详情见这里：https://github.com/pmmmwh/react-refresh-webpack-plugin/blob/main/docs/TROUBLESHOOTING.md

### Umi 3x 项目的 sourceMap 配置会影响 federation 模式下的构建，

没有细究原理，改为 eval 模式是可行的，但是是否影响调试还待验证；

### Umi 3x 项目的不支持入口异步加载，

所以 react 的依赖要配置为 eager；但是正常的生产环境不能配置 eager，否则 shared 无意义；这一点怎么处理 开发环境 和 生产环境

## 遗留问题

### 1 怎么支持远程 ts

因为 federation 是运行时的功能，所以 不支持 ts、manifest 等等在开发阶段方便调试的能力，所以需要额外的插件提供支持。
`@cloudbeds/webpack-module-federation-types-plugin`将 Remote 项目中编辑的 @types/manifest 文件定时下载到 Host 项目中，协助开发。

### 2 入口资源加载失败的情况，怎么兜底

目前只能用 ErrorBoundaries 去兜底。尝试了 window.addEventListener 去监听 error 和 unhandlerejection 这两个事件，但是仍然没拦截住，具体表现为控制台仍有报错，页面也崩溃了。可能是因为单纯的事件监听可以监听到错误事件的触发，但是没有办法对 UI 加以控制；

### 依赖的第三方包无法按需加载

比如 antd
