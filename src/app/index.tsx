import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth } from "../../services/firebase";

const MENU_ITEMS = [
  {
    id: "clients",
    title: "Clientes",
    subtitle: "Cadastro, contatos e histórico",
    route: "/clients",
  },
  {
    id: "projects",
    title: "Projetos",
    subtitle: "Etapas, prazos e acompanhamento",
    route: "/projects",
  },
  {
    id: "materials",
    title: "Estoque & Amostras",
    subtitle: "Materiais, acabamentos e validade",
    route: "/materials",
  },
  {
    id: "visits",
    title: "Visitas em Obra",
    subtitle: "Check-in com localização e notas",
    route: "/visits",
  },
];

export default function IndexScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Atenção", "Preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (error: any) {
      let mensagem = "Não foi possível concluir o acesso.";
      if (error.code === "auth/invalid-email") mensagem = "E-mail inválido.";
      if (error.code === "auth/invalid-credential")
        mensagem = "E-mail ou senha incorretos.";
      if (error.code === "auth/weak-password")
        mensagem = "A senha deve ter pelo menos 6 caracteres.";
      if (error.code === "auth/email-already-in-use")
        mensagem = "Este e-mail já está cadastrado.";
      Alert.alert("Erro", mensagem);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  function handleOpenModule(title: string, route: string) {
    if (
      route === "/clients" ||
      route === "/projects" ||
      route === "/materials" ||
      route === "/visits"
    ) {
      router.push(route as any);
      return;
    }
    Alert.alert(title, `Módulo "${title}" em breve.`);
  }

  if (initializing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B85032" />
      </View>
    );
  }

  if (user) {
    return (
      <ScrollView contentContainerStyle={styles.menuContainer}>
        <View style={styles.header}>
          <Text style={styles.brand}>Atelier</Text>
          <Text style={styles.welcomeText}>{user.email}</Text>
        </View>

        <Text style={styles.sectionTitle}>Menu Principal</Text>

        <View style={styles.grid}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              activeOpacity={0.75}
              onPress={() => handleOpenModule(item.title, item.route)}
            >
              <Text style={styles.menuCardTitle}>{item.title}</Text>
              <Text style={styles.menuCardSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.buttonOutline} onPress={handleLogout}>
          <Text style={styles.buttonOutlineText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.brand}>Atelier</Text>
      <Text style={styles.subtitle}>
        {isSignUp ? "Criar nova conta" : "Gestão de Projetos de Arquitetura"}
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          placeholder="seuemail@escritorio.com"
          placeholderTextColor="#9A8F87"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#9A8F87"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? "Cadastrar" : "Entrar"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsSignUp(!isSignUp)}
        >
          <Text style={styles.switchText}>
            {isSignUp
              ? "Já tem conta? Fazer login"
              : "Primeiro acesso? Criar uma conta"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: "#FAF6F2",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#FAF6F2",
    justifyContent: "center",
    padding: 24,
  },
  menuContainer: {
    flexGrow: 1,
    backgroundColor: "#FAF6F2",
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 28,
  },
  brand: {
    fontSize: 34,
    fontWeight: "700",
    color: "#B85032",
  },
  welcomeText: {
    fontSize: 14,
    color: "#6B5E55",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#241E1A",
    marginBottom: 14,
  },
  grid: {
    gap: 12,
    marginBottom: 28,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 12,
    padding: 18,
  },
  menuCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#241E1A",
    marginBottom: 4,
  },
  menuCardSubtitle: {
    fontSize: 14,
    color: "#6B5E55",
  },
  subtitle: {
    fontSize: 15,
    color: "#6B5E55",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 32,
  },
  form: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#241E1A",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#241E1A",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#B85032",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 18,
    alignItems: "center",
  },
  switchText: {
    color: "#B85032",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: "#B85032",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#B85032",
    fontSize: 15,
    fontWeight: "600",
  },
});