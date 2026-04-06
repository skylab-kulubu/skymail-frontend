import React from "react";
import { Typography, Card } from "antd";

const { Title, Text } = Typography;

export const Home: React.FC = () => {
  return (
    <Card>
      <Title level={3}>Skymail'e Hoş Geldiniz</Title>
      <Text>Sol menüden işlemlerinizi gerçekleştirebilirsiniz.</Text>
    </Card>
  );
};
