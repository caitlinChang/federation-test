import { Typography } from "antd";
import { observer } from "mobx-react-lite";
import { useState } from "react";

const Case = () => {
  const [count, setCount] = useState(0);
  return (
    <Typography.Text onClick={() => setCount(count + 1)}>
      容器自己的组件{count}{" "}
    </Typography.Text>
  );
};

export default observer(Case);
