import { Button } from "antd";
import { getName } from "./utils";
import { useState } from "react";

const AntdButton = ({ text }: { text: string }) => {
  const name = getName();
  const [count, setCount] = useState(0);
  return (
    <Button onClick={() => setCount(count + 1)}>
      AntdButto99n - {name} - {text} - {count}
    </Button>
  );
};

export default AntdButton;
