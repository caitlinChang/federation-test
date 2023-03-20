import React from "react";
import "./App.css";
import "antd/dist/antd.variable.css";

import SelfCase from "./Case";
import ErrorBoundary from "./components/ErrorBoundaries";
const RemoteTest = React.lazy(() => import("./components/remoteTest"));

// const RatioDiv = React.lazy(() => import("formula/RatioDiv"));
// const Foo = React.lazy(() => import("testUmi/Foo"));

// @ts-ignore
const Button = React.lazy(() => import("testCRA/Button"));

// const Button = React.lazy(() => {
//   try {
//     // @ts-ignore
//     const res = await import("testCRA/Button");
//     return React.createElement("NoData");
//   } catch (err) {
//     return React.createElement("NoData");
//   }
// });
// const AntdButton = React.lazy(() => import("testCRA/AntdButton"));

const itemStyle = {
  width: "100%",
  height: "100%",
  border: "1px solid #CCC",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function App() {
  return (
    <div className="App">
      <div>
        <h3>CRA容器ddd</h3>
        <div>
          <SelfCase />
          <RemoteTest />
        </div>
      </div>

      <React.Suspense fallback="Loading Button">
        <div>
          <h3>cra 项目测试</h3>
          <ErrorBoundary>
            <Button />
          </ErrorBoundary>

          {/* <AntdButton text="AntdButton" /> */}
        </div>
        {/* <div>
          <h3>Umi3 项目测试</h3>
          <Foo title={"Umi3"} />
        </div> */}
        {/* <div>
          <h3>formula 项目测试</h3>
          <RatioDiv ratio={[4, 3]} width={300}>
            <div style={itemStyle}>
              <h1>4:3</h1>
            </div>
          </RatioDiv>
        </div> */}
      </React.Suspense>
    </div>
  );
}

export default App;

const value = [
  {
    leftCorner: {
      value: "物料数",
      tip: "Formula 平台物料数量",
    },
    content: 10,
    remark: "",
  },
  {
    leftCorner: {
      value: "物料使用量",
      tip: "Formula 平台上物料的使用次数总和",
    },
    content: 100,
    remark: "",
  },
];
