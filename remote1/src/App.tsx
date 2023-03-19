import React, { useEffect, useState } from "react";
import "./App.css";
import { Button as AButton } from "antd";
import AntdButton from "./Case";
import "antd/dist/antd.variable.css";
// import Button from "./Button";
const Button = React.lazy(() => import("./Button"));

function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="App">
      ABB {count} 次数
      <Button />
      <AntdButton text="Antd Button" />
      <AButton onClick={() => setCount(count + 1)}>Click here</AButton>
    </div>
  );
}

export default App;
