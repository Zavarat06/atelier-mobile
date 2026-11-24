import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { auth, db } from "../../services/firebase";

export default function IndexScreen() {
  const [status, setStatus] = useState("Testando conexão com o Firebase...");

  useEffect(() => {
    (async () => {
      try {
        await getDocs(collection(db, "clients"));
        setStatus(`Conectado ao Firebase (${auth.app.options.projectId}) com sucesso!`);
      } catch (err: any) {
        setStatus(`Aviso na conexão: ${err?.message || "verifique as regras do Firestore"}`);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Atelier</Text>
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6F2",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    fontSize: 32,
    fontWeight: "700",
    color: "#B85032",
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    color: "#241E1A",
    textAlign: "center",
  },
});