import {
    Container, Header
} from "@mantine/core";
import * as React from "react";

const Index: React.FC = () => {
  return (
    <Container size="xs">
      <Header
        height={80}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>Welcome</span>
      </Header>
    </Container>
  );
};

export default Index;