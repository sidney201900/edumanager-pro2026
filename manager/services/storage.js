/**
 * ============================================================
 * SERVIÇO DE STORAGE — MinIO S3-Compatible (Self-Hosted)
 * Substitui todas as chamadas supabase.storage do sistema
 * ============================================================
 */
import { S3Client, PutObjectCommand, GetObjectCommand, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const MINIO_PORT = process.env.MINIO_PORT || '9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'MiniO2026!Seguro';
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';

// Cliente S3 apontando para o MinIO interno
const s3Client = new S3Client({
  endpoint: `http://${MINIO_ENDPOINT}:${MINIO_PORT}`,
  region: 'us-east-1', // MinIO ignora, mas o SDK exige
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Obrigatório para MinIO
});

/**
 * Upload de arquivo para o MinIO
 * @param {string} bucket - Nome do bucket (ex: 'logos', 'fotos-alunos', 'carnes')
 * @param {string} fileName - Nome do arquivo (ex: 'logo_123.webp')
 * @param {Buffer} fileBuffer - Conteúdo do arquivo
 * @param {string} contentType - MIME type (ex: 'image/webp')
 * @returns {string} URL pública do arquivo
 */
export async function uploadFile(bucket, fileName, fileBuffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileName,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Retorna a URL pública (MinIO com política de download anônimo)
  return `${MINIO_PUBLIC_URL}/${bucket}/${fileName}`;
}

/**
 * Gera a URL pública de um arquivo existente
 */
export function getPublicUrl(bucket, fileName) {
  return `${MINIO_PUBLIC_URL}/${bucket}/${fileName}`;
}

/**
 * Upload de logo da escola
 */
export async function uploadLogo(fileBuffer, contentType) {
  const ext = contentType.includes('webp') ? 'webp' : 'png';
  const fileName = `logo_${Date.now()}.${ext}`;
  return uploadFile('logos', fileName, fileBuffer, contentType);
}

/**
 * Upload de foto de aluno
 */
export async function uploadStudentPhoto(fileBuffer, contentType) {
  const ext = contentType.includes('webp') ? 'webp' : contentType.split('/')[1] || 'jpg';
  const fileName = `student_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  return uploadFile('fotos-alunos', fileName, fileBuffer, contentType);
}

/**
 * Upload de carnê PDF
 */
export async function uploadCarne(fileName, pdfBuffer) {
  return uploadFile('carnes', fileName, pdfBuffer, 'application/pdf');
}

/**
 * Upload de imagem de prova
 */
export async function uploadExamImage(fileBuffer, contentType) {
  const ext = contentType.split('/')[1] || 'webp';
  const fileName = `exam_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  return uploadFile('exames', fileName, fileBuffer, contentType);
}

/**
 * Upload de atestado/justificativa
 */
export async function uploadAtestado(fileBuffer, contentType) {
  const ext = contentType.split('/')[1] || 'jpg';
  const fileName = `atestado_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  return uploadFile('atestados', fileName, fileBuffer, contentType);
}

export async function getMinioStats() {
  try {
    const data = await s3Client.send(new ListBucketsCommand({}));
    const buckets = data.Buckets || [];
    let totalSize = 0;
    let totalItems = 0;
    
    const bucketsInfo = await Promise.all(buckets.map(async (bucket) => {
      let bucketSize = 0;
      let bucketItems = 0;
      try {
        const objects = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket.Name }));
        if (objects.Contents) {
          bucketItems = objects.Contents.length;
          bucketSize = objects.Contents.reduce((acc, curr) => acc + (curr.Size || 0), 0);
        }
      } catch (e) {} // Ignorar buckets inacessíveis
      
      totalSize += bucketSize;
      totalItems += bucketItems;
      
      return {
        name: bucket.Name,
        items: bucketItems,
        sizeMB: (bucketSize / (1024 * 1024)).toFixed(2)
      };
    }));

    return {
      bucketCount: buckets.length,
      totalItems,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      buckets: bucketsInfo
    };
  } catch (error) {
    console.error('Erro ao buscar stats do MinIO:', error);
    return { error: true, message: error.message };
  }
}

export { s3Client };
