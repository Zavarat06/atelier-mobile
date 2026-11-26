const DRIVE_UPLOAD_URL = process.env.EXPO_PUBLIC_DRIVE_UPLOAD_URL?.trim();

export interface DriveUploadResult {
  driveFileId: string;
  driveViewUrl: string;
  webViewLink?: string;
}

export async function uploadPhotoToDrive(params: {
  base64: string;
  fileName: string;
  mimeType?: string;
}): Promise<DriveUploadResult> {
  if (!DRIVE_UPLOAD_URL) {
    throw new Error(
      "EXPO_PUBLIC_DRIVE_UPLOAD_URL está vazia. Confira o .env e rode npx expo start -c."
    );
  }

  let response = await fetch(DRIVE_UPLOAD_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({
      base64: params.base64,
      fileName: params.fileName,
      mimeType: params.mimeType || "image/jpeg",
    }),
  });

  // O Google Apps Script responde 302 para script.googleusercontent.com onde fica o JSON final
  if (
    (response.status === 301 ||
      response.status === 302 ||
      response.status === 307 ||
      response.status === 308) &&
    response.headers.get("location")
  ) {
    const redirectUrl = response.headers.get("location")!;
    response = await fetch(redirectUrl, {
      method: "GET",
    });
  }

  const rawText = await response.text();

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    const titleMatch = rawText.match(/<title>(.*?)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1] : rawText.slice(0, 140);
    throw new Error(
      `O Google retornou HTML em vez de JSON (${pageTitle}). Verifique se a conta é @gmail.com pessoal e se "Quem tem acesso" está como "Qualquer pessoa".`
    );
  }

  if (!data.success) {
    throw new Error(data.error || "Falha ao enviar foto para o Google Drive.");
  }

  return {
    driveFileId: data.driveFileId,
    driveViewUrl: data.driveViewUrl,
    webViewLink: data.webViewLink,
  };
}