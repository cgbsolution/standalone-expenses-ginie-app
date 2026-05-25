import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPGENIE_CONFIG, guessMimeFromUri } from '../config/expgenie';

const URL_KEY = 'expense_uploaded_urls';

function toJpgFileName(name) {
  if (!name) return `image-${Date.now()}.jpg`;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.jpg`;
}

function pickUrlFromResponse(data) {
  if (!data || typeof data !== 'object') return null;
  return (
    data.url ||
    data.sasUrl ||
    data.fileUrl ||
    data.file_url ||
    data.signedUrl ||
    data.signed_url ||
    null
  );
}

export async function uploadExpenseDocument(fileUri, fileName) {
  try {
    const userEmail = (await AsyncStorage.getItem('user_email')) || '';
    const normalizedName = toJpgFileName(fileName);
    const mime = guessMimeFromUri(fileUri) === 'application/octet-stream'
      ? 'image/jpeg'
      : guessMimeFromUri(fileUri);

    if (!EXPGENIE_CONFIG.UPLOAD_ALLOWED_MIME.includes(mime)) {
      return {
        success: false,
        error: `Unsupported file type: ${mime}. Allowed: PDF, JPG, PNG.`,
      };
    }

    const form = new FormData();
    form.append('file', {
      uri: fileUri,
      name: normalizedName,
      type: mime,
    });
    form.append('user_email', userEmail);

    const response = await fetch(EXPGENIE_CONFIG.UPLOAD_URL, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const data = await response.json().catch(() => ({}));
    const url = pickUrlFromResponse(data);

    if (url) {
      await storeUploadedUrl(normalizedName, url);
    }

    return {
      success: true,
      sasUrl: url,
      url,
      fileName: normalizedName,
      raw: data,
    };
  } catch (error) {
    console.error('Expense upload error:', error);
    return { success: false, error: error.message };
  }
}

export async function storeUploadedUrl(fileName, url) {
  try {
    const existing = await AsyncStorage.getItem(URL_KEY);
    const urls = existing ? JSON.parse(existing) : {};
    urls[fileName] = {
      url,
      sasUrl: url,
      timestamp: new Date().toISOString(),
      fileName,
    };
    await AsyncStorage.setItem(URL_KEY, JSON.stringify(urls));
  } catch (error) {
    console.error('Error storing uploaded URL:', error);
  }
}

export async function getUploadedUrl(fileName) {
  try {
    const existing = await AsyncStorage.getItem(URL_KEY);
    const urls = existing ? JSON.parse(existing) : {};
    return urls[fileName]?.url || urls[fileName]?.sasUrl || null;
  } catch (error) {
    console.error('Error reading uploaded URL:', error);
    return null;
  }
}

export async function getAllUploadedUrls() {
  try {
    const existing = await AsyncStorage.getItem(URL_KEY);
    return existing ? JSON.parse(existing) : {};
  } catch (error) {
    return {};
  }
}

