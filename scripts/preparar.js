const { copyFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const raiz = join(__dirname, '..');
const pastas = ['.', 'servicos/api', 'servicos/profissionais', 'servicos/projetos', 'servicos/notificacoes'];

for (const pasta of pastas) {
  const modelo = join(raiz, pasta, '.env.example');
  const destino = join(raiz, pasta, '.env');
  if (existsSync(destino)) {
    process.stdout.write(`mantido: ${join(pasta, '.env')}\n`);
  } else {
    copyFileSync(modelo, destino);
    process.stdout.write(`criado:  ${join(pasta, '.env')}\n`);
  }
}
