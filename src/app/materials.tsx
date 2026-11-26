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
import {
  MaterialCategory,
  MaterialItem,
  Project,
} from "../../types/atelier";

function parsePtBrDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function getExpirationBadge(dateStr?: string | null): {
  label: string;
  urgent: boolean;
} | null {
  const target = parsePtBrDate(dateStr);
  if (!target) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    return { label: `Vencido (${dateStr})`, urgent: true };
  }
  if (diffDays <= 15) {
    return {
      label:
        diffDays === 0
          ? `Vence hoje (${dateStr})`
          : `Vence em ${diffDays}d (${dateStr})`,
      urgent: true,
    };
  }
  return { label: `Validade: ${dateStr}`, urgent: false };
}

export default function MaterialsScreen() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filterCategory, setFilterCategory] = useState<
    "todos" | MaterialCategory
  >("todos");

  const [showForm, setShowForm] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(
    null
  );
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MaterialCategory>("amostra");
  const [quantity, setQuantity] = useState("1");
  const [minQuantity, setMinQuantity] = useState("");
  const [unit, setUnit] = useState("un");
  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [notes, setNotes] = useState("");

  const listRef = useRef<FlatList<MaterialItem>>(null);

  useEffect(() => {
    const qMaterials = query(
      collection(db, "materials"),
      orderBy("createdAt", "desc")
    );
    const unsubMaterials = onSnapshot(
      qMaterials,
      (snapshot) => {
        const list: MaterialItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<MaterialItem, "id">),
        }));
        setItems(list);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        Alert.alert("Erro", "Não foi possível carregar o estoque e amostras.");
      }
    );

    const qProjects = query(
      collection(db, "projects"),
      orderBy("createdAt", "desc")
    );
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const list: Project[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Project, "id">),
      }));
      setProjects(list);
    });

    return () => {
      unsubMaterials();
      unsubProjects();
    };
  }, []);

  function resetForm() {
    setEditingMaterialId(null);
    setName("");
    setCategory("amostra");
    setQuantity("1");
    setMinQuantity("");
    setUnit("un");
    setSupplier("");
    setLocation("");
    setExpirationDate("");
    setSelectedProjectId("");
    setNotes("");
    setShowForm(false);
  }

  function handleToggleForm() {
    if (showForm) {
      resetForm();
    } else {
      setEditingMaterialId(null);
      setShowForm(true);
    }
  }

  function handleStartEdit(item: MaterialItem) {
    setEditingMaterialId(item.id);
    setName(item.name || "");
    setCategory(item.category || "amostra");
    setQuantity(String(item.quantity ?? 0));
    setMinQuantity(
      typeof item.minQuantity === "number" ? String(item.minQuantity) : ""
    );
    setUnit(item.unit || "un");
    setSupplier(item.supplier || "");
    setLocation(item.location || "");
    setExpirationDate(item.expirationDate || "");
    setSelectedProjectId(item.projectId || "");
    setNotes(item.notes || "");
    setShowForm(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  async function handleSaveMaterial() {
    if (!name.trim()) {
      Alert.alert("Atenção", "Informe o nome do material ou amostra.");
      return;
    }

    const parsedQty = Number(quantity.replace(",", "."));
    if (Number.isNaN(parsedQty) || parsedQty < 0) {
      Alert.alert("Atenção", "Informe uma quantidade válida.");
      return;
    }

    const trimmedExp = expirationDate.trim();
    if (trimmedExp && !parsePtBrDate(trimmedExp)) {
      Alert.alert(
        "Data de validade inválida",
        "Use o formato DD/MM/AAAA (ex: 30/12/2026) ou deixe em branco."
      );
      return;
    }

    const parsedMin = minQuantity.trim()
      ? Number(minQuantity.replace(",", "."))
      : undefined;

    if (
      minQuantity.trim() &&
      (parsedMin === undefined || Number.isNaN(parsedMin) || parsedMin < 0)
    ) {
      Alert.alert("Atenção", "Informe uma quantidade mínima válida.");
      return;
    }

    const chosenProject = projects.find((p) => p.id === selectedProjectId);

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        category,
        quantity: parsedQty,
        minQuantity: parsedMin !== undefined ? parsedMin : null,
        unit: unit.trim() || "un",
        supplier: supplier.trim() || null,
        location: location.trim() || null,
        expirationDate: trimmedExp || null,
        projectId: chosenProject?.id || "",
        projectName: chosenProject?.title || null,
        notes: notes.trim() || null,
      };

      if (editingMaterialId) {
        await updateDoc(doc(db, "materials", editingMaterialId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "materials"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Erro",
        editingMaterialId
          ? "Não foi possível atualizar o item."
          : "Não foi possível salvar o item."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjustQuantity(item: MaterialItem, delta: number) {
    const nextQty = Math.max(0, (item.quantity || 0) + delta);
    try {
      await updateDoc(doc(db, "materials", item.id), {
        quantity: nextQty,
        updatedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert("Erro", "Não foi possível atualizar a quantidade.");
    }
  }

  function handleDeleteMaterial(item: MaterialItem) {
    Alert.alert("Excluir item", `Deseja remover "${item.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "materials", item.id));
            if (editingMaterialId === item.id) {
              resetForm();
            }
          } catch {
            Alert.alert("Erro", "Não foi possível excluir o item.");
          }
        },
      },
    ]);
  }

  const filteredItems =
    filterCategory === "todos"
      ? items
      : items.filter((i) => i.category === filterCategory);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          {filteredItems.length}{" "}
          {filteredItems.length === 1 ? "item" : "itens"}
        </Text>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={handleToggleForm}
        >
          <Text style={styles.toggleButtonText}>
            {showForm ? "Fechar" : "+ Novo item"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { key: "todos", label: "Todos" },
            { key: "amostra", label: "Amostras" },
            { key: "estoque", label: "Estoque" },
          ] as const
        ).map((tab) => {
          const active = filterCategory === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilterCategory(tab.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showForm && (
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingMaterialId
                ? "Editar Material ou Amostra"
                : "Cadastrar Material ou Amostra"}
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={styles.rowGap}>
                {(
                  [
                    { value: "amostra", label: "Amostra" },
                    { value: "estoque", label: "Estoque" },
                  ] as const
                ).map((opt) => {
                  const active = category === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategory(opt.value)}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nome (ex: Porcelanato Calacata / Linho Cru) *"
              placeholderTextColor="#9A8F87"
              value={name}
              onChangeText={setName}
            />

            <View style={styles.rowGap}>
              <TextInput
                style={[styles.input, styles.flexOne]}
                placeholder="Quantidade *"
                placeholderTextColor="#9A8F87"
                keyboardType="decimal-pad"
                value={quantity}
                onChangeText={setQuantity}
              />
              <TextInput
                style={[styles.input, styles.unitInput]}
                placeholder="Un. (m², un)"
                placeholderTextColor="#9A8F87"
                value={unit}
                onChangeText={setUnit}
              />
              <TextInput
                style={[styles.input, styles.flexOne]}
                placeholder="Qtd. mínima"
                placeholderTextColor="#9A8F87"
                keyboardType="decimal-pad"
                value={minQuantity}
                onChangeText={setMinQuantity}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Fornecedor / marca (opcional)"
              placeholderTextColor="#9A8F87"
              value={supplier}
              onChangeText={setSupplier}
            />

            <View style={styles.rowGap}>
              <TextInput
                style={[styles.input, styles.flexOne]}
                placeholder="Local / prateleira"
                placeholderTextColor="#9A8F87"
                value={location}
                onChangeText={setLocation}
              />
              <TextInput
                style={[styles.input, styles.flexOne]}
                placeholder="Validade (DD/MM/AAAA)"
                placeholderTextColor="#9A8F87"
                value={expirationDate}
                onChangeText={setExpirationDate}
              />
            </View>

            {projects.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vincular projeto (opcional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {projects.map((p) => {
                    const active = selectedProjectId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSelectedProjectId(active ? "" : p.id)}
                      >
                        <Text
                          style={[styles.chipText, active && styles.chipTextActive]}
                        >
                          {p.title}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Referência, lote, acabamento ou observações..."
              placeholderTextColor="#9A8F87"
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.formActionsRow}>
              {editingMaterialId && (
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
                  editingMaterialId && styles.flexOne,
                  saving && styles.disabled,
                ]}
                onPress={handleSaveMaterial}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingMaterialId ? "Salvar alterações" : "Salvar item"}
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
          data={filteredItems}
          style={showForm ? styles.listWhenFormOpen : undefined}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nenhum item encontrado. Toque em "+ Novo item" para cadastrar.
            </Text>
          }
          renderItem={({ item }) => {
            const expBadge = getExpirationBadge(item.expirationDate);
            const isLowStock =
              typeof item.minQuantity === "number" &&
              !Number.isNaN(item.minQuantity) &&
              item.quantity <= item.minQuantity;

            return (
              <TouchableOpacity
                style={styles.card}
                onLongPress={() => handleDeleteMaterial(item)}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.editBadge}
                      onPress={() => handleStartEdit(item)}
                    >
                      <Text style={styles.editBadgeText}>Editar</Text>
                    </TouchableOpacity>

                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.category === "amostra" ? "Amostra" : "Estoque"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.qtyRow}>
                  <Text
                    style={[styles.qtyText, isLowStock && styles.urgentText]}
                  >
                    Saldo: {item.quantity} {item.unit || "un"}
                    {isLowStock ? " (Baixo)" : ""}
                  </Text>

                  <View style={styles.stepperGroup}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleAdjustQuantity(item, -1)}
                    >
                      <Text style={styles.stepBtnText}>-1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleAdjustQuantity(item, 1)}
                    >
                      <Text style={styles.stepBtnText}>+1</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {!!item.projectName && (
                  <Text style={styles.cardInfo}>
                    Projeto: {item.projectName}
                  </Text>
                )}
                {!!item.supplier && (
                  <Text style={styles.cardInfo}>
                    Fornecedor: {item.supplier}
                  </Text>
                )}
                {!!item.location && (
                  <Text style={styles.cardAddress}>Local: {item.location}</Text>
                )}
                {expBadge && (
                  <Text
                    style={[
                      styles.cardInfo,
                      expBadge.urgent && styles.urgentText,
                    ]}
                  >
                    {expBadge.label}
                  </Text>
                )}
                {!!item.notes && (
                  <Text style={styles.cardNotes}>{item.notes}</Text>
                )}

                <Text style={styles.cardHint}>
                  Use -1 / +1 para ajustar • Editar para alterar • Segure para excluir
                </Text>
              </TouchableOpacity>
            );
          }}
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
    marginBottom: 10,
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#241E1A",
    borderColor: "#241E1A",
  },
  filterChipText: {
    fontSize: 13,
    color: "#4A403A",
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  formScroll: {
    maxHeight: 360,
    marginBottom: 12,
  },
  listWhenFormOpen: {
    maxHeight: 200,
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
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A403A",
    marginBottom: 6,
  },
  rowGap: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  flexOne: {
    flex: 1,
  },
  unitInput: {
    width: 82,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: "#FAF6F2",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "#B85032",
    borderColor: "#B85032",
  },
  chipText: {
    fontSize: 13,
    color: "#4A403A",
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
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
    minHeight: 64,
    textAlignVertical: "top",
  },
  formActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
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
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#241E1A",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editBadge: {
    backgroundColor: "#FAF6F2",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A403A",
  },
  badge: {
    backgroundColor: "#F4E7E1",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#B85032",
  },
  qtyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#241E1A",
  },
  urgentText: {
    color: "#B85032",
    fontWeight: "700",
  },
  stepperGroup: {
    flexDirection: "row",
    gap: 6,
  },
  stepBtn: {
    backgroundColor: "#FAF6F2",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#241E1A",
  },
  cardInfo: {
    fontSize: 14,
    color: "#4A403A",
    marginTop: 2,
  },
  cardAddress: {
    fontSize: 13,
    color: "#6B5E55",
    marginTop: 2,
  },
  cardNotes: {
    fontSize: 13,
    color: "#8C7F77",
    fontStyle: "italic",
    marginTop: 6,
  },
  cardHint: {
    fontSize: 11,
    color: "#9A8F87",
    marginTop: 10,
  },
});