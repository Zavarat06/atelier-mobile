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
import { Client, Project, ProjectStatus } from "../../types/atelier";

type PhotoCategory = "andamento" | "planta";

interface ProjectDrivePhoto {
  id: string;
  category: PhotoCategory;
  driveFileId: string;
  driveViewUrl: string;
  webViewLink?: string;
  caption?: string;
}

interface ProjectWithMedia extends Project {
  photos?: ProjectDrivePhoto[];
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "estudo_preliminar", label: "Estudo Preliminar" },
  { value: "anteprojeto", label: "Anteprojeto" },
  { value: "executivo", label: "Executivo" },
  { value: "obra", label: "Em Obra" },
  { value: "concluido", label: "Concluído" },
];

function sanitizePhotoForFirestore(photo: ProjectDrivePhoto): ProjectDrivePhoto {
  const cleanPhoto: ProjectDrivePhoto = {
    id: photo.id,
    category: photo.category,
    driveFileId: photo.driveFileId,
    driveViewUrl: photo.driveViewUrl,
  };

  if (photo.webViewLink) {
    cleanPhoto.webViewLink = photo.webViewLink;
  }
  if (photo.caption && photo.caption.trim()) {
    cleanPhoto.caption = photo.caption.trim();
  }

  return cleanPhoto;
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<ProjectWithMedia[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDraftPhoto, setUploadingDraftPhoto] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("estudo_preliminar");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<ProjectDrivePhoto[]>([]);
  const [photoCaption, setPhotoCaption] = useState("");

  const [attachingProjectId, setAttachingProjectId] = useState<string | null>(
    null
  );

  const listRef = useRef<FlatList<ProjectWithMedia>>(null);

  useEffect(() => {
    const qProjects = query(
      collection(db, "projects"),
      orderBy("createdAt", "desc")
    );
    const unsubProjects = onSnapshot(
      qProjects,
      (snapshot) => {
        const list: ProjectWithMedia[] = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<ProjectWithMedia, "id">),
        }));
        setProjects(list);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        Alert.alert("Erro", "Não foi possível carregar os projetos.");
      }
    );

    const qClients = query(collection(db, "clients"), orderBy("name", "asc"));
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      const list: Client[] = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Client, "id">),
      }));
      setClients(list);
    });

    return () => {
      unsubProjects();
      unsubClients();
    };
  }, []);

  function resetForm() {
    setEditingProjectId(null);
    setTitle("");
    setSelectedClientId("");
    setStatus("estudo_preliminar");
    setAddress("");
    setDescription("");
    setDraftPhotos([]);
    setPhotoCaption("");
    setShowForm(false);
  }

  function handleToggleForm() {
    if (showForm) {
      resetForm();
    } else {
      setEditingProjectId(null);
      setShowForm(true);
    }
  }

  function handleStartEdit(project: ProjectWithMedia) {
    setEditingProjectId(project.id);
    setTitle(project.title || "");
    setSelectedClientId(project.clientId || "");
    setStatus(project.status || "estudo_preliminar");
    setAddress(project.address || "");
    setDescription(project.description || "");
    setDraftPhotos((project.photos || []).map(sanitizePhotoForFirestore));
    setPhotoCaption("");
    setShowForm(true);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  async function pickAndUploadToDrive(
    source: "camera" | "gallery",
    category: PhotoCategory,
    projectLabel?: string
  ): Promise<ProjectDrivePhoto | null> {
    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à câmera nas configurações do aparelho."
        );
        return null;
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
        return null;
      }

      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
      });
    }

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Erro", "Não foi possível ler os dados da imagem.");
      return null;
    }

    const safePrefix = (projectLabel || title || "projeto")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    const fileName = `${safePrefix}_${category}_${Date.now()}.jpg`;

    const uploaded = await uploadPhotoToDrive({
      base64: asset.base64,
      fileName,
      mimeType: asset.mimeType || "image/jpeg",
    });

    const trimmedCaption = photoCaption.trim();

    return sanitizePhotoForFirestore({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category,
      driveFileId: uploaded.driveFileId,
      driveViewUrl: uploaded.driveViewUrl,
      ...(uploaded.webViewLink ? { webViewLink: uploaded.webViewLink } : {}),
      ...(trimmedCaption ? { caption: trimmedCaption } : {}),
    });
  }

  async function handleDraftCapture(
    source: "camera" | "gallery",
    category: PhotoCategory
  ) {
    setUploadingDraftPhoto(true);
    try {
      const photo = await pickAndUploadToDrive(source, category);
      if (photo) {
        setDraftPhotos((prev) => [...prev, photo]);
        setPhotoCaption("");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Erro no upload",
        error?.message || "Não foi possível salvar a foto no Google Drive."
      );
    } finally {
      setUploadingDraftPhoto(false);
    }
  }

  function promptAddPhotoForDraft() {
    Alert.alert(
      "Enviar foto para o Drive",
      "Escolha o tipo de registro e a origem:",
      [
        {
          text: "Câmera • Andamento",
          onPress: () => handleDraftCapture("camera", "andamento"),
        },
        {
          text: "Galeria • Andamento",
          onPress: () => handleDraftCapture("gallery", "andamento"),
        },
        {
          text: "Câmera • Planta",
          onPress: () => handleDraftCapture("camera", "planta"),
        },
        {
          text: "Galeria • Planta",
          onPress: () => handleDraftCapture("gallery", "planta"),
        },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  }

  async function handleAttachPhotoToExistingProject(
    project: ProjectWithMedia,
    source: "camera" | "gallery",
    category: PhotoCategory
  ) {
    setAttachingProjectId(project.id);
    try {
      const photo = await pickAndUploadToDrive(source, category, project.title);
      if (!photo) return;

      const existingSanitized = (project.photos || []).map(
        sanitizePhotoForFirestore
      );
      const updatedPhotos = [...existingSanitized, photo];

      await updateDoc(doc(db, "projects", project.id), {
        photos: updatedPhotos,
        updatedAt: serverTimestamp(),
      });

      if (editingProjectId === project.id) {
        setDraftPhotos(updatedPhotos);
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        "Erro no upload",
        error?.message || "Não foi possível enviar a foto para o Drive."
      );
    } finally {
      setAttachingProjectId(null);
    }
  }

  function openExistingProjectPhotoMenu(project: ProjectWithMedia) {
    Alert.alert(project.title, "Enviar foto para o Google Drive:", [
      {
        text: "Foto de Andamento (Câmera)",
        onPress: () =>
          handleAttachPhotoToExistingProject(project, "camera", "andamento"),
      },
      {
        text: "Foto de Andamento (Galeria)",
        onPress: () =>
          handleAttachPhotoToExistingProject(project, "gallery", "andamento"),
      },
      {
        text: "Foto de Planta (Câmera)",
        onPress: () =>
          handleAttachPhotoToExistingProject(project, "camera", "planta"),
      },
      {
        text: "Foto de Planta (Galeria)",
        onPress: () =>
          handleAttachPhotoToExistingProject(project, "gallery", "planta"),
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function handleSaveProject() {
    if (!title.trim()) {
      Alert.alert("Atenção", "O título do projeto é obrigatório.");
      return;
    }

    const chosenClient = clients.find((c) => c.id === selectedClientId);
    const sanitizedPhotos = draftPhotos.map(sanitizePhotoForFirestore);

    setSaving(true);
    try {
      const dataToSave = {
        title: title.trim(),
        clientId: chosenClient?.id || "",
        clientName: chosenClient?.name || null,
        status,
        address: address.trim() || null,
        description: description.trim() || null,
        photos: sanitizedPhotos,
      };

      if (editingProjectId) {
        await updateDoc(doc(db, "projects", editingProjectId), {
          ...dataToSave,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "projects"), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Erro",
        editingProjectId
          ? "Não foi possível atualizar o projeto."
          : "Não foi possível salvar o projeto."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleChangeStatus(project: ProjectWithMedia) {
    Alert.alert(
      "Atualizar etapa",
      `Escolha a etapa atual de "${project.title}":`,
      [
        ...STATUS_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: async () => {
            try {
              await updateDoc(doc(db, "projects", project.id), {
                status: opt.value,
                updatedAt: serverTimestamp(),
              });
            } catch {
              Alert.alert("Erro", "Não foi possível atualizar a etapa.");
            }
          },
        })),
        { text: "Cancelar", style: "cancel" },
      ]
    );
  }

  function handleDeleteProject(project: ProjectWithMedia) {
    Alert.alert(
      "Excluir projeto",
      `Deseja remover "${project.title}" da lista?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "projects", project.id));
              if (editingProjectId === project.id) {
                resetForm();
              }
            } catch {
              Alert.alert("Erro", "Não foi possível excluir o projeto.");
            }
          },
        },
      ]
    );
  }

  function getStatusLabel(value: ProjectStatus) {
    return (
      STATUS_OPTIONS.find((opt) => opt.value === value)?.label ||
      "Estudo Preliminar"
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          {projects.length} {projects.length === 1 ? "projeto" : "projetos"}
        </Text>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={handleToggleForm}
        >
          <Text style={styles.toggleButtonText}>
            {showForm ? "Fechar" : "+ Novo projeto"}
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
              {editingProjectId ? "Editar Projeto" : "Cadastrar Projeto"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nome do projeto (ex: Residência Silva) *"
              placeholderTextColor="#9A8F87"
              value={title}
              onChangeText={setTitle}
            />

            {clients.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vincular cliente (opcional)</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {clients.map((c) => {
                    const active = selectedClientId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSelectedClientId(active ? "" : c.id)}
                      >
                        <Text
                          style={[styles.chipText, active && styles.chipTextActive]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Etapa atual</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {STATUS_OPTIONS.map((opt) => {
                  const active = status === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setStatus(opt.value)}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Endereço da obra / terreno"
              placeholderTextColor="#9A8F87"
              value={address}
              onChangeText={setAddress}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Escopo, metragem ou notas do projeto..."
              placeholderTextColor="#9A8F87"
              multiline
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.photoSection}>
              <Text style={styles.fieldLabel}>
                Fotos de Andamento & Plantas (salvas no Google Drive)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Legenda opcional da foto (ex: Planta térreo / Laje)"
                placeholderTextColor="#9A8F87"
                value={photoCaption}
                onChangeText={setPhotoCaption}
              />

              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={promptAddPhotoForDraft}
                disabled={uploadingDraftPhoto}
              >
                {uploadingDraftPhoto ? (
                  <View style={styles.uploadingRow}>
                    <ActivityIndicator size="small" color="#B85032" />
                    <Text style={styles.photoActionText}>
                      Enviando para o Google Drive...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.photoActionText}>
                    + Câmera / Galeria (Andamento ou Planta)
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
                      <Text style={styles.thumbTag}>
                        {p.category === "planta" ? "Planta" : "Andamento"}
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
              {editingProjectId && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={resetForm}
                  disabled={saving || uploadingDraftPhoto}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  editingProjectId && styles.flexOne,
                  (saving || uploadingDraftPhoto) && styles.disabled,
                ]}
                onPress={handleSaveProject}
                disabled={saving || uploadingDraftPhoto}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingProjectId ? "Salvar alterações" : "Salvar projeto"}
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
          data={projects}
          style={showForm ? styles.listWhenFormOpen : undefined}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nenhum projeto cadastrado ainda. Toque em "+ Novo projeto" para começar.
            </Text>
          }
          renderItem={({ item }) => {
            const photos = item.photos || [];
            const isAttaching = attachingProjectId === item.id;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    style={styles.titleTouch}
                    onPress={() => handleChangeStatus(item)}
                    onLongPress={() => handleDeleteProject(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </TouchableOpacity>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.editBadge}
                      onPress={() => handleStartEdit(item)}
                    >
                      <Text style={styles.editBadgeText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.badge}
                      onPress={() => handleChangeStatus(item)}
                    >
                      <Text style={styles.badgeText}>
                        {getStatusLabel(item.status)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {!!item.clientName && (
                  <Text style={styles.cardClient}>
                    Cliente: {item.clientName}
                  </Text>
                )}
                {!!item.address && (
                  <Text style={styles.cardAddress}>{item.address}</Text>
                )}
                {!!item.description && (
                  <Text style={styles.cardNotes}>{item.description}</Text>
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
                        <Text style={styles.thumbTag}>
                          {p.category === "planta" ? "Planta" : "Andamento"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.cardFooterRow}>
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={() => openExistingProjectPhotoMenu(item)}
                    disabled={isAttaching}
                  >
                    {isAttaching ? (
                      <View style={styles.uploadingRow}>
                        <ActivityIndicator size="small" color="#B85032" />
                        <Text style={styles.attachBtnText}>
                          Enviando ao Drive...
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.attachBtnText}>
                        + Foto (Obra / Planta)
                      </Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.cardHint}>
                    Toque na foto: abrir no Drive • Título/Etapa: mudar etapa • Segure título: excluir
                  </Text>
                </View>
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
  titleTouch: {
    flex: 1,
  },
  cardTitle: {
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
  cardClient: {
    fontSize: 14,
    fontWeight: "500",
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
  cardFooterRow: {
    marginTop: 12,
    gap: 6,
  },
  attachBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#FAF6F2",
    borderWidth: 1,
    borderColor: "#E2D9D0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attachBtnText: {
    color: "#B85032",
    fontSize: 12,
    fontWeight: "600",
  },
  cardHint: {
    fontSize: 11,
    color: "#9A8F87",
  },
});