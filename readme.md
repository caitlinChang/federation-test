### 前言

federation 是 webpack5 支持的一种跨项目资源共享的方式。

传统的跨资源共享方式有 npm、DLL，都有一定的局限性；不同方案的优劣对比，网上有很多资源，这篇文章不再赘述。

这里主要记录下在实践过程中的踩坑以及相关的原理解析。因为网上的大部分文章都是对配置的简单讲解，但是我在实际应用中还是踩了很多坑，每处理一个问题都要花好长时间，这里记录一下希望能够提供一些帮助。

### 背景

我遇到的业务场景是组件库。使用 federation 主要考虑一下两个需求：

1. 开发：方便调试
2. 生产：方便迭代版本

在这个 demo 中, host1 为 Host 项目, remote1 为 Remote 项目. Remote 项目中暴露了自己的两个组件，Host 项目中引用了这两个组件。
项目信息：
CRA 5+
react: 18+

### 原理

#### 本质上就是异步加载模块

通常我们会把某些项目中的某些资源配置成懒加载：

```javascript
const CutomizeTitle = React.lazy(() => import("./CutomizeTitle"));
```

Federation 就是也是异步加载模块的一个实现，只不过这个模块可以是在另一个独立的项目中，只要配置好资源链接。简单来说，就是 A 项目可以引用 B 项目中的模块。

```javascript
// 当前是在 Host 项目，引用 Remote 项目的 Button 组件
const Button = React.lazy(() => import("Remote/Button"));
```

那么 Host 项目是怎么加载 Remote 项目中的 button 的呢？从打包产物分析更容易理解。

#### 打包产物分析

##### Remote 项目打包产物

Remote 项目的打包产物，相比较非 Federation 架构，多出来了以下 chunk:

1. _moduleEntry.js_ 给 Host 项目的入口文件
2. _src_Button_tsx.js_ 暴露给其他项目使用的 Button 组件
3. 其他暴露的组件的 bundle

**moduleEntry.js**
可以把 moduleEntry.js 把 Remote 项目暴露的组件信息都包含在内了，它定义了一个这样的 module

```json
{
    get:function(moduleId){...},
    init:() => {...}
}
```

##### Host 项目打包产物

因为 Host 项目没有暴露自己的组件出去，所以它并没有额外的 chunk。但是它原本的 chunk 中多了一些支持 Federation 的 runtime 代码。（此处需要一些对 webpack 有一定的了解）

```javascript
/* __webpack__require__.f 是用来异步加载模块的方法，普通的懒加载就是依靠 __webpack__require__.f.j 动态创建一个 script 标签来实现的 */
/* 配置federation后，__webpack__require__.j上多出来了 remotes 和 consumes 方法*/
__webpack__require__.f.remotes = function () {
  // remotes 方法中用来处理 加载 moduleEntry 文件，加载 shared 模块，加载 Button 文件
};
```

#### 踩坑

1. CRA 项目 - 异步加载的模块热更新失败
   这是 dev-server 的一个 bug，它误判了运行环境，认为是运行在非浏览器端所以跳过了 hmr 的执行，按照下图重新配置 webpack 的 target 即可。
   详情见这里：https://github.com/pmmmwh/react-refresh-webpack-plugin/blob/main/docs/TROUBLESHOOTING.md

2. CRA 项目 - 添加 exposes 配置后热更新失败：
   这是因为配置了 exposes 后，项目会生成两个入口文件，一个是项目的主入口 main，另外一个就是暴露给其他项目引用的 moduleEntry 入口文件，这两个入口文件同时被注入到 index.html 文件中；就会加载两份 webpack runtime 的代码，定义了两个 热更新的函数，所以在热更新的时候会错乱，具体原因可以看这里：https://github.com/module-federation/module-federation-examples/issues/358；

3. remote 模块无法在 host 项目热更新
   主要表现为，remote 模块更改后，host 项目出发了整个热更新的流程，网络面板中有 hot-update 文件请求，但是 UI 无变化，表现和问题 1 一样。
   这是因为此时运行了两个 react-refresh 的实例，一个是 host 项目自身的，一个是 remoteEntry 的；host 项目做如下配置：

4. 怎么支持远程 ts
   @cloudbeds/webpack-module-federation-types-plugin

5. 入口资源加载失败的情况，怎么兜底
   目前只能用 ErrorBoundaries 去兜底。尝试了 window.addEventListener 去监听 error 和 unhandlerejection 这两个事件，但是仍然没拦截住，具体表现为控制台仍有报错，页面也崩溃了。可能是因为单纯的事件监听可以监听到错误事件的触发，但是没有办法对 UI 加以控制；

#### 方案优劣

先说劣势，依赖的第三方包无法按需加载，比如 antd
