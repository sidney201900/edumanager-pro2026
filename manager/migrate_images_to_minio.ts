import * as fs from 'fs/promises';
import * as path from 'path';
import * as Minio from 'minio';
import { fileURLToPath } from 'url';

// Ignora o erro de certificado SSL (Self-Signed) durante a migração local
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURAÇÕES DO MINIO
// Substitua com as credenciais do seu Portainer/MinIO local
// ============================================================================
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'storageedu.microtecinformaticacurso.com.br';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '443');
const MINIO_USE_SSL = process.env.MINIO_USE_SSL !== 'false';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'MiniO2026!Seguro';
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `https://${MINIO_ENDPOINT}`;

const minioClient = new Minio.Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
});

// ============================================================================
// FUNÇÃO AUXILIAR DE UPLOAD
// ============================================================================
async function uploadBase64ToMinio(base64String: string, bucketName: string, fileNamePrefix: string): Promise<string> {
    if (!base64String || !base64String.startsWith('data:image')) {
        return base64String; // Retorna como está se não for Base64 válido
    }

    // Extrai o MIME Type e os dados puros da string (Ex: data:image/jpeg;base64,...)
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return base64String;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const extension = mimeType.split('/')[1] || 'jpeg'; // Pega a extensão (jpeg, png, webp)
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `${fileNamePrefix}-${Date.now()}.${extension}`;

    // Garante que o Bucket existe no MinIO
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
        await minioClient.makeBucket(bucketName, 'us-east-1');
        console.log(`🪣  Bucket criado: ${bucketName}`);
    }

    // Faz o upload do Buffer
    await minioClient.putObject(bucketName, fileName, buffer, buffer.length, {
        'Content-Type': mimeType,
    });

    // Retorna a URL pública gerada
    return `${MINIO_PUBLIC_URL}/${bucketName}/${fileName}`;
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE MIGRAÇÃO
// ============================================================================
async function runMigration() {
    console.log('🚀 Iniciando extração e migração de Base64 para MinIO...\n');

    const inputFilePath = path.join(__dirname, 'backup_supabase_2026-04-19.json');
    const outputFilePath = path.join(__dirname, 'backup_supabase_2026-04-19_migrado.json');

    try {
        // 1. Ler arquivo JSON
        console.log('📦 Lendo arquivo de backup...');
        const rawData = await fs.readFile(inputFilePath, 'utf-8');
        const db = JSON.parse(rawData);

        // 2. Migrar Logo da Escola (Tabela 'profile')
        if (db.profile && db.profile.logo && db.profile.logo.startsWith('data:image')) {
            console.log('🏢 Processando Logo da Escola...');
            db.profile.logo = await uploadBase64ToMinio(db.profile.logo, 'escola', 'logo');
        }

        // 3. Migrar Fotos dos Alunos (Tabela 'students')
        if (db.students && Array.isArray(db.students)) {
            console.log(`🎓 Processando fotos de ${db.students.length} alunos...`);
            for (let i = 0; i < db.students.length; i++) {
                const student = db.students[i];
                if (student.photo && student.photo.startsWith('data:image')) {
                    student.photo = await uploadBase64ToMinio(student.photo, 'alunos', `aluno-${student.id}`);
                }
            }
        }

        // 4. Migrar Fotos e Atestados da Frequência (Tabela 'attendance')
        if (db.attendance && Array.isArray(db.attendance)) {
            console.log(`📅 Processando ${db.attendance.length} registros de frequência...`);
            for (let i = 0; i < db.attendance.length; i++) {
                const record = db.attendance[i];

                // 4.1 Foto de biometria/presença
                if (record.photo && record.photo.startsWith('data:image')) {
                    record.photo = await uploadBase64ToMinio(record.photo, 'presenca', `presenca-${record.studentId}`);
                }

                // 4.2 Atestados médicos (Dentro do JSON stringificado em 'justification')
                if (record.justification) {
                    try {
                        const justObj = JSON.parse(record.justification);
                        if (justObj.arquivo_base64 && justObj.arquivo_base64.startsWith('data:image')) {
                            // Upload da imagem do atestado
                            const newUrl = await uploadBase64ToMinio(
                                justObj.arquivo_base64,
                                'atestados',
                                `atestado-${record.studentId}`
                            );

                            // Substitui o Base64 pela URL limpa e recria a string JSON
                            justObj.arquivo_base64 = newUrl;
                            record.justification = JSON.stringify(justObj);
                            console.log(`   ✅ Atestado migrado para aluno: ${record.studentId}`);
                        }
                    } catch (e) {
                        // Ignora se 'justification' não for um JSON válido
                    }
                }
            }
        }

        // 5. Salvar o novo banco de dados limpo
        console.log('\n💾 Salvando novo backup JSON migrado...');
        await fs.writeFile(outputFilePath, JSON.stringify(db, null, 2), 'utf-8');

        console.log(`\n✅ MIGO CONCLUÍDA COM SUCESSO!`);
        console.log(`✅ Arquivo gerado em: ${outputFilePath}`);
        console.log(`⚠️ IMPORTANTE: Suas senhas e matrículas não foram alteradas.`);

    } catch (error) {
        console.error('❌ Ocorreu um erro durante a migração:', error);
    }
}

runMigration();