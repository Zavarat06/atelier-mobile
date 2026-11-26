import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#FAF6F2",
        },
        headerTintColor: "#B85032",
        headerTitleStyle: {
          fontWeight: "700",
          color: "#241E1A",
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: "#FAF6F2",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="clients"
        options={{
          title: "Clientes",
        }}
      />
      <Stack.Screen
        name="projects"
        options={{
          title: "Projetos",
        }}
      />
      <Stack.Screen
        name="materials"
        options={{
          title: "Estoque & Amostras",
        }}
      />
    </Stack>
  );
}