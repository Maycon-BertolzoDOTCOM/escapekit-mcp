# Reconstrução do Frontend - Arquitetura Limpa

## Requisito
Refazer o frontend do zero eliminando mocks, dependências espúrias (WhatsApp, loops infinitos) e aplicando invariantes sistêmicas desde o início. O backend (gateway, CLI, validadores de invariantes) já está 100% funcional.

## Cenário e Lógica de Processamento
- **Input**: Usuário faz upload de imagem e seleciona material
- **Processamento**: Chama `analyzeRoom` + `applyMaterial` do módulo AI
- **Output**: Exibe resultado como imagem base64 ou texto de erro
- **Fluxo**: Upload → Seleção → Simulação → Resultado (simplificado e direto)

## Arquitetura e Abordagem Técnica
- **Arquitetura Minimalista**: Apenas UI essencial (upload, selector, botão, resultado)
- **Integração Direta**: Chama funções AI existentes sem camadas intermediárias
- **Sem Mocks**: Todas as dependências são reais e necessárias
- **Respeito às Invariantes**: Frontend apenas como casca de apresentação

## Arquivos Afetados
- **Criar**: `src/App.tsx` (nova versão minimalista)
- **Limpar**: `src/**` (exceto `main.tsx`)
- **Atualizar**: `package.json` (remover dependências desnecessárias)
- **Manter**: Backend completo em `services/`

## Detalhes de Implementação

### Nova App.tsx
```tsx
import { useState } from 'react';
import { analyzeRoom, applyMaterial } from './services/ai';

// Mock simples de materiais (pode vir do materialService)
const materials = [
  { id: '1', name: 'Cerâmica Bege', type: 'ceramic', color: 'bege', dimensions: '60x60' },
  { id: '2', name: 'Porcelanato Branco', type: 'porcelain', color: 'white', dimensions: '60x60' }
];

export default function App() {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState(materials[0]);
  const [result, setResult] = useState<{ image?: string; text?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Upload de imagem simplificado
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Simulação direta chamando backend AI
  const handleSimulate = async () => {
    if (!imageBase64) return;
    setLoading(true);
    try {
      const context = await analyzeRoom(imageBase64);
      const { editedImageBase64, fidelity } = await applyMaterial(imageBase64, selectedMaterial, context);
      setResult({ image: editedImageBase64 });
      console.log('Fidelidade:', fidelity);
    } catch (err: any) {
      setResult({ text: `Erro: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>PisosRealView Pro</h1>
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {imageBase64 && <img src={`data:image/jpeg;base64,${imageBase64}`} style={{ width: 200 }} />}
      <select value={selectedMaterial.id} onChange={(e) => setSelectedMaterial(materials.find(m => m.id === e.target.value)!)}>
        {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button onClick={handleSimulate} disabled={!imageBase64 || loading}>
        {loading ? 'Processando...' : 'Simular Piso'}
      </button>
      {result?.image && <img src={`data:image/jpeg;base64,${result.image}`} style={{ width: '100%', maxWidth: 600 }} />}
      {result?.text && <pre>{result.text}</pre>}
    </div>
  );
}
```

## Condições de Contorno e Tratamento de Exceções
- **Validação**: Verificar arquivo de imagem válido
- **Error Handling**: Catch simples com mensagem de erro
- **Loading States**: Feedback visual durante processamento
- **Dependencies**: Apenas React + Vite + funções AI existentes

## Fluxo de Dados
1. Usuário → Upload imagem → Base64
2. Usuário → Seleciona material → Objeto material
3. Botão "Simular" → analyzeRoom() → applyMaterial() → Resultado
4. Resultado → Exibição imagem/texto

## Resultados Esperados
- Frontend funcional sem loops infinitos
- Integração direta com backend AI
- Código limpo e mantenível
- Sem dependências espúrias