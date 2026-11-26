import * as ImagePicker from "expo-image-picker";
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
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { uploadPhotoToDrive } from "../../services/driveUpload";
import { db } from "../../services/firebase";
import { Project, SiteVisit, SiteVisitPhoto } from "../../types/atelier";

function formatTodayPtBr(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function isValidPtBrDate(dateStr: string): boolean {
  const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const parsed = new Date(year, month, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month &&
    parsed.getDate() === day
  );
}

function sanitizeVisitPhoto(photo: SiteVisitPhoto): SiteVisitPhoto {
  const clean: SiteVisitPhoto = {
    id: photo.id,
    driveFileId: photo.driveFileId,
    driveViewUrl: photo.driveViewUrl,
  };
  if (photo.webViewLink) {
    clean.webViewLink = photo.webViewLink;
  }
  if (photo.caption && photo.caption.trim()) {
    clean.caption = photo.caption.trim();
  }
  return clean;
}

export default function VisitsScreen() {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [filterProjectId, setFilterProjectId] = useState<string>("");

  const [showForm, setShowForm] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [visitDate, setVisitDate] = useState(formatTodayPtBr());
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<SiteVisitPhoto[]>([]);

  const listRef = useRef<FlatList<SiteVisit>>(null);

  useEffect(() => {
    const qVisits = query(
      collection(db, "visits"),
      orderBy("createdAt", "desc")
    );
    const unsubVisits = onSnapshot(
      qVisits,
      (snapshot) => {
        const list: SiteVisit[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<SiteVisit, "id">),
        }));
        setVisits(list);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        Alert.alert("Erro", "Não foi possível carregar as visitas em obra.");
      }
    );

    const qProjects = query(
      collection(db, "projects"),
      orderBy("createdAt", "desc")
    );
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      const list: Project[] = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Project, "id">),
      }));
      setProjects(list);
    });

    return () => {
      unsubVisits();
      unsubProjects();
    };
  }, []);

  function resetForm() {
    setEditingVisitId(null);
    setSelectedProjectId("");
    setVisitDate(formatTodayPtBr());
    setSummary("");
    setNotes("");
    setPhotoCaption("");
    setDraftPhotos([]);
    setShowForm(false);
  }

  function handleToggleForm() {
    if (showForm) {
      resetForm();
    } else {
      setEditingVisitId(null);
      setVisitDate(formatTodayPtBr());
      setShowForm(true);
    }
  }

  function handleStartEdit(visit: SiteVisit) {
    setEditingVisitId(visit.id);
    setSelectedProjectId(visit.projectId || "");
    setVisitDate(visit.visitDate || formatTodayPtBr());
    setSummary(visit.summary || "");
    setNotes(visit.notes || "");
    setPhotoCaption("");
    setDraftPhotos((visit.photos || []).map(sanitizeVisitPhoto));
    setShowForm(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  async function handlePickAndUploadPhoto(source: "camera" | "gallery") {
    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à câmera nas configurações do aparelho."
        );
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
      });
    } else {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à galeria nas configurações do aparelho."
        );
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Erro", "Não foi possível ler os dados da imagem.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const chosenProject = projects.find((p) => p.id === selectedProjectId);
      const safePrefix = (chosenProject?.title || summary || "visita_obra")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
      const fileName = `${safePrefix}_visita_${Date.now()}.jpg`;

      const uploaded = await uploadPhotoToDrive({
        base64: asset.base64,
        fileName,
        mimeType: asset.mimeType || "image/jpeg",
      });

      const trimmedCaption = photoCaption.trim();
      const newPhoto = sanitizeVisitPhoto({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        driveFileId: uploaded.driveFileId,
        driveViewUrl: uploaded.driveViewUrl,
        ...(uploaded.webViewLink ? { webViewLink: uploaded.webViewLink } : {}),
        ...(trimmedCaption ? { caption: trimmedCaption } : {}),
      });

      setDraftPhotos((prev) => [...prev, newPhoto]);
      setPhotoCaption("");
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Erro no upload",
        error?.message || "Não foi possível enviar a foto para o Google Drive."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  function promptAddPhoto() {
    Alert.alert("Foto da visita", "Escolha a origem da imagem:", [
      {
        text: "Câmera",
        onPress: () => handlePickAndUploadPhoto("camera"),
      },
      {
        text: "Galeria",
        onPress: () => handlePickAndUploadPhoto("gallery"),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function handleSaveVisit() {
    if (!selectedProjectId) {
      Alert.alert("Atenção", "Selecione o projeto referente à visita.");
      return;
    }

    if (!summary.trim()) {
      Alert.alert("Atenção", "Informe o resumo ou motivo da visita.");
      return;
    }

    const trimmedDate = visitDate.trim();
    if (!isValidPtBrDate(trimmedDate)) {
      Alert.alert(
        "Data inválida",
        "Informe a data no formato DD/MM/AAAA (ex: 25/11/2026)."
      );
      return;
    }

    const chosenProject = projects.find((p) => p.id === selectedProjectId);
    const sanitizedPhotos = draftPhotos.map(sanitizeVisitPhoto);

    setSaving(true);
    try {
      const payload = {
        projectId: selectedProjectId,
        projectName: chosenProject?.title || null,
        visitDate: trimmedDate,
        summary: summary.trim(),
        notes: notes.trim() || null,
        photos: sanitizedPhotos,
      };

      if (editingVisitId) {
        await updateDoc(doc(db, "visits", editingVisitId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "visits"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Erro",
        editingVisitId
          ? "Não foi possível atualizar a visita."
          : "Não foi possível salvar a visita."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteVisit(visit: SiteVisit) {
    Alert.alert(
      "Excluir visita",
      `Deseja remover o registro da visita "${visit.summary}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "visits", visit.id));
              if (editingVisitId === visit.id) {
                resetForm();
              }
            } catch {
              Alert.alert("Erro", "Não foi possível excluir a visita.");
            }
          },
        },
      ]
    );
  }

  const filteredVisits = filterProjectId
    ? visits.filter((v) => v.projectId === filterProjectId)
    : visits;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          {filteredVisits.length}{" "}
          {filteredVisits.length === 1 ? "visita" : "visitas"}
        </Text>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={handleToggleForm}
        >
          <Text style={styles.toggleButtonText}>
            {showForm ? "Fechar" : "+ Nova visita"}
          </Text>
        </TouchableOpacity>
      </View>

      {projects.length > 0 && (
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                !filterProjectId && styles.filterChipActive,
              ]}
              onPress={() => setFilterProjectId("")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !filterProjectId && styles.filterChipTextActive,
                ]}
              >
                Todos os projetos
              </Text>
            </TouchableOpacity>

            {projects.map((p) => {
              const active = filterProjectId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilterProjectId(active ? "" : p.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {p.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {showForm && (
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingVisitId ? "Editar Visita em Obra" : "Registrar Visita em Obra"}
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Projeto *</Text>
              {projects.length === 0 ? (
                <Text style={styles.helperText}>
                  Cadastre um projeto primeiro na aba Projetos.
                </Text>
              ) : (
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
              )}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Data da visita (DD/MM/AAAA) *"
              placeholderTextColor="#9A8F87"
              value={visitDate}
              onChangeText={setVisitDate}
            />

            <TextInput
              style={styles.input}
              placeholder="Resumo da visita (ex: Conferência de alvenaria e pontos) *"
              placeholderTextColor="#9A8F87"
              value={summary}
              onChangeText={setSummary}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Pendências, alinhamentos com empreiteiro ou notas técnicas..."
              placeholderTextColor="#9A8F87"
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.photoSection}>
              <Text style={styles.fieldLabel}>
                Fotos da visita (salvas no Google Drive)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Legenda opcional da foto"
                placeholderTextColor="#9A8F87"
                value={photoCaption}
                onChangeText={setPhotoCaption}
              />

              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={promptAddPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <View style={styles.uploadingRow}>
                    <ActivityIndicator size="small" color="#B85032" />
                    <Text style={styles.photoActionText}>
                      Enviando para o Google Drive...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.photoActionText}>
                    + Adicionar Foto (Câmera ou Galeria)
                  </Text>
                )}
              </TouchableOpacity>

              {draftPhotos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.thumbsRow}
                >
                  {draftPhotos.map((p) => (
                    <View key={p.id} style={styles.thumbBox}>
                      <Image
                        source={{ uri: p.driveViewUrl }}
                        style={styles.thumbImage}
                      />
                      <Text style={styles.thumbTag} numberOfLines={1}>
                        {p.caption || "Foto"}
                      </Text>
                      <TouchableOpacity
                        style={styles.removeThumbBtn}
                        onPress={() =>
                          setDraftPhotos((prev) =>
                            prev.filter((item) => item.id !== p.id)
                          )
                        }
                      >
                        <Text style={styles.removeThumbText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.formActionsRow}>
              {editingVisitId && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={resetForm}
                  disabled={saving || uploadingPhoto}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  editingVisitId && styles.flexOne,
                  (saving || uploadingPhoto) && styles.disabled,
                ]}
                onPress={handleSaveVisit}
                disabled={saving || uploadingPhoto}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingVisitId ? "Salvar alterações" : "Salvar visita"}
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
          data={filteredVisits}
          style={showForm ? styles.listWhenFormOpen : undefined}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nenhuma visita registrada ainda. Toque em "+ Nova visita" para começar.
            </Text>
          }
          renderItem={({ item: visit }) => {
            const photos = visit.photos || [];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{visit.summary}</Text>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.editBadge}
                      onPress={() => handleStartEdit(visit)}
                    >
                      <Text style={styles.editBadgeText}>Editar</Text>
                    </TouchableOpacity>

                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{visit.visitDate}</Text>
                    </View>
                  </View>
                </View>

                {!!visit.projectName && (
                  <Text style={styles.cardProject}>
                    Projeto: {visit.projectName}
                  </Text>
                )}

                {!!visit.notes && (
                  <Text style={styles.cardNotes}>{visit.notes}</Text>
                )}

                {photos.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbsRow}
                  >
                    {photos.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.thumbBox}
                        onPress={() =>
                          Linking.openURL(p.webViewLink || p.driveViewUrl)
                        }
                      >
                        <Image
                          source={{ uri: p.driveViewUrl }}
                          style={styles.thumbImage}
                        />
                        <Text style={styles.thumbTag} numberOfLines={1}>
                          {p.caption || "Abrir no Drive"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={styles.deleteLink}
                  onPress={() => handleDeleteVisit(visit)}
                >
                  <Text style={styles.deleteLinkText}>Excluir visita</Text>
                </TouchableOpacity>
              </View>
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
  filterContainer: {
    marginBottom: 12,
  },
  filterRow: {
    gap: 8,
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
    height: 12,
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
  helperText: {
    fontSize: 13,
    color: "#8C7F77",
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
    minHeight: 68,
    textAlignVertical: "top",
  },
  photoSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  photoActionButton: {
    borderWidth: 1,
    borderColor: "#B85032",
    backgroundColor: "#FAF6F2",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  photoActionText: {
    color: "#B85032",
    fontSize: 13,
    fontWeight: "600",
  },
  thumbsRow: {
    gap: 10,
    marginTop: 12,
    paddingVertical: 2,
  },
  thumbBox: {
    width: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2D9D0",
    backgroundColor: "#FAF6F2",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: 76,
    resizeMode: "cover",
  },
  thumbTag: {
    fontSize: 11,
    fontWeight: "600",
    color: "#241E1A",
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  removeThumbBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(36, 30, 26, 0.75)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  removeThumbText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 15,
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
  cardProject: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A403A",
    marginTop: 4,
  },
  cardNotes: {
    fontSize: 13,
    color: "#6B5E55",
    marginTop: 6,
  },
  deleteLink: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  deleteLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8C7F77",
  },
});