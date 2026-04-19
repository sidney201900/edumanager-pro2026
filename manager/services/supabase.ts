/**
 * ============================================================
 * SERVIÇO DE STORAGE — SELF-HOSTED (API HTTP)
 * ============================================================
 * Substitui @supabase/supabase-js Storage por chamadas HTTP
 * à API do EduManager Self-Hosted.
 * 
 * NENHUMA tela, componente ou design foi alterado.
 * ============================================================
 */

// Detecta se está configurado (sempre true no self-hosted)
export const isSupabaseConfigured = () => true;

export const supabase = {
  from: () => { throw new Error('Self-Hosted: Use as funções HTTP em vez de supabase.from()'); },
  storage: { from: () => { throw new Error('Self-Hosted: Use as funções de upload HTTP'); } },
  channel: () => {
    const mockChannel = {
      on: () => mockChannel,
      subscribe: (cb: any) => { if(cb) cb('SUBSCRIBED'); return mockChannel; }
    };
    return mockChannel;
  },
  removeChannel: () => {},
};

/**
 * Upload de foto de perfil (usuário admin)
 */
export const uploadProfilePicture = async (userId: string, file: File): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('userId', userId);

    const response = await fetch('/api/upload/student-photo', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload falhou');
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Erro ao fazer upload de foto de perfil:', error);
    return null;
  }
};

/**
 * Upload de logo da escola
 */
export const uploadLogo = async (file: File): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch('/api/upload/logo', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload falhou');
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Erro ao fazer upload de logo:', error);
    return null;
  }
};

/**
 * Upload de imagem de prova
 */
export const uploadExamImage = async (file: File): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch('/api/upload/student-photo', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload falhou');
    const data = await response.json();
    return data.url;
  } catch (error: any) {
    console.error('Erro ao fazer upload de imagem de prova:', error);
    throw error;
  }
};

/**
 * Upload de foto de aluno (converte base64 para File e faz upload)
 */
export const uploadStudentPhoto = async (photoData: string): Promise<string | null> => {
  // Se já é uma URL, retorna diretamente
  if (!photoData || photoData.startsWith('http')) {
    return photoData || null;
  }

  // Se não é base64, retorna null
  if (!photoData.startsWith('data:image')) {
    return null;
  }

  try {
    // Converter base64 para Blob
    const [header, base64Data] = photoData.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mimeType = mimeMatch[1];

    const byteString = atob(base64Data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });

    // Criar FormData e enviar
    const formData = new FormData();
    const ext = mimeType.split('/')[1] || 'webp';
    formData.append('photo', blob, `student-photo.${ext}`);

    const response = await fetch('/api/upload/student-photo', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload falhou');
    const data = await response.json();
    return data.url;
  } catch (error: any) {
    console.error('Erro ao fazer upload de foto do aluno:', error);
    return null;
  }
};
