import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { db } from "../../services/firebase";
import { Client } from "../../types/atelier";

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const listRef = useRef<FlatList<Client>>(null);

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Client[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<Client, "id">),
        }));
        setClients(list);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        Alert.alert("Erro", "Não foi possível carregar os clientes.");
      }
    );

    return unsubscribe;
  }, []);

  function resetForm() {
    setEditingClientId(null);
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setShowForm(false);
  }

  function handleToggleForm() {
    if (showForm) {
      resetForm();
    } else {
      setEditingClientId(null);
      setShowForm(true);
    }
  }

  function handleStartEdit(client: Client) {
    setEditingClientId(client.id);
    setName(client.name || "");
    setPhone(client.phone || "");
    setEmail(client.email || "");
    setAddress(client.address || "");
    setNotes(client.notes || "");
    setShowForm(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  async function handleSaveClient() {
    if (!name.trim()) {
      Alert.alert("Atenção", "O nome do cliente é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      if (editingClientId) {
        await updateDoc(doc(db, "clients", editingClientId), {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "clients"), {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Erro",
        editingClientId
          ? "Não foi possível atualizar o cliente."
          : "Não foi possível salvar o cliente."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClient(client: Client) {
    Alert.alert(
      "Excluir cliente",
      `Deseja remover "${client.name}" da lista?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "clients", client.id));
              if (editingClientId === client.id) {
                resetForm();
              }
            } catch {
              Alert.alert("Erro", "Não foi possível excluir o cliente.");
            }
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
        </Text>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={handleToggleForm}
        >
          <Text style={styles.toggleButtonText}>
            {showForm ? "Fechar" : "+ Novo cliente"}
          </Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingClientId ? "Editar Cliente" : "Cadastrar Cliente"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nome completo *"
              placeholderTextColor="#9A8F87"
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="Telefone / WhatsApp"
              placeholderTextColor="#9A8F87"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#9A8F87"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              style={styles.input}
              placeholder="Endereço do imóvel / cliente"
              placeholderTextColor="#9A8F87"
              value={address}
              onChangeText={setAddress}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Observações (preferências, briefing inicial...)"
              placeholderTextColor="#9A8F87"
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.formActionsRow}>
              {editingClientId && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={resetForm}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  editingClientId && styles.flexOne,
                  saving && styles.disabled,
                ]}
                onPress={handleSaveClient}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingClientId ? "Salvar alterações" : "Salvar cliente"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#B85032" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={clients}
          style={showForm ? styles.listWhenFormOpen : undefined}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nenhum cliente cadastrado ainda. Toque em "+ Novo cliente" para começar.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{item.name}</Text>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.editBadge}
                    onPress={() => handleStartEdit(item)}
                  >
                    <Text style={styles.editBadgeText}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBadge}
                    onPress={() => handleDeleteClient(item)}
                  >
                    <Text style={styles.deleteBadgeText}>Excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {!!item.phone && (
                <Text style={styles.cardInfo}>Tel: {item.phone}</Text>
              )}
              {!!item.email && (
                <Text style={styles.cardInfo}>{item.email}</Text>
              )}
              {!!item.address && (
                <Text style={styles.cardAddress}>{item.address}</Text>
              )}
              {!!item.notes && (
                <Text style={styles.cardNotes}>{item.notes}</Text>
              )}
            </View>
          )}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF6F2",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  counter: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B5E55",
  },
  toggleButton: {
    backgroundColor: "#B85032",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  formScroll: {
    maxHeight: 360,
    marginBottom: 12,
  },
  listWhenFormOpen: {
    maxHeight: 220,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  separator: {
    height: 10,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 12,
    padding: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#241E1A",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#FAF6F2",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#241E1A",
    marginBottom: 10,
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: "top",
  },
  formActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  flexOne: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: "#FAF6F2",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#6B5E55",
    fontSize: 15,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#B85032",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    color: "#6B5E55",
    fontSize: 14,
    marginTop: 40,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#241E1A",
  },
  cardActions: {
    flexDirection: "row",
    gap: 6,
  },
  editBadge: {
    backgroundColor: "#F4E7E1",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  editBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B85032",
  },
  deleteBadge: {
    backgroundColor: "#FAF6F2",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  deleteBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B5E55",
  },
  cardInfo: {
    fontSize: 14,
    color: "#4A403A",
    marginTop: 2,
  },
  cardAddress: {
    fontSize: 13,
    color: "#6B5E55",
    marginTop: 4,
  },
  cardNotes: {
    fontSize: 13,
    color: "#8C7F77",
    fontStyle: "italic",
    marginTop: 6,
  },
});