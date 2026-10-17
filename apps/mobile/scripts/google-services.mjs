// Gancho do EAS Build (eas-build-pre-install): copia o google-services.json do Firebase, que
// fica no EAS como variável de ambiente do tipo arquivo (GOOGLE_SERVICES_JSON), para a pasta do
// app. O arquivo não é versionado (repositório público). Sem a variável, não faz nada.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = process.env.GOOGLE_SERVICES_JSON;
const target = resolve(import.meta.dirname, '..', 'google-services.json');

if (!source) {
  console.log('GOOGLE_SERVICES_JSON não definida: build sem notificações push.');
} else if (!existsSync(source)) {
  console.error(`GOOGLE_SERVICES_JSON aponta para um arquivo inexistente: ${source}`);
  process.exit(1);
} else {
  copyFileSync(source, target);
  console.log('google-services.json copiado para o build.');
}
