import { Container } from "@mantine/core";
import * as React from "react";

const Index: React.FC = () => {
  return (
    <Container size="xs">
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        <span style={{ fontSize: "24px", fontWeight: "bold" }}>Welcome</span>
      </header>
      <p>Click "Study" on the left panel to begin a lesson.</p>
    </Container>
  );
};

export default Index;
