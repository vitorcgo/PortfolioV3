# Portfolio

Portfolio pessoal de Vitor Cavalcante.

## Deploy na Vercel

1. Subir esta pasta para o GitHub.
2. Importar o repositorio na Vercel.
3. Framework Preset: `Other`.
4. Build Command: deixar vazio.
5. Output Directory: deixar vazio.

O site e estatico e usa `index.html` na raiz do repositorio.

## Convencoes

- **Imagens de projeto**: sempre `.webp`, no maximo 1600px no lado maior.
  Para converter novas capturas:
  `python -c "from PIL import Image; im=Image.open('x.png'); im.thumbnail((1600,1600)); im.save('x.webp','WEBP',quality=82,method=6)"`
- **Tema**: dark e o padrao. O modo claro so aparece se a pessoa clicar no toggle
  (fica salvo em `localStorage.theme`).
- **Curriculo**: o botao `CV` da nav baixa `images/Vitor-Gomes-Desenvolvedor-1.pdf`.
  Para atualizar, basta substituir esse arquivo (o `vercel.json` mantem cache
  curto para PDFs, entao a troca aparece rapido).
- **Projetos**: os cards ficam em `#trabalhos` e os detalhes do modal no objeto
  `PROJECTS` dentro de `index.html`. Ao adicionar/remover um projeto, atualize
  tambem o `ItemList` do JSON-LD no `<head>`.
- **three.js**: servido localmente em `vendor-three.min.js` (sem CDN externo).
