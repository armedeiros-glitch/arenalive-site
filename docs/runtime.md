# AndreOS Runtime

## Propósito

O Runtime é o núcleo técnico do André OS.

Ele oferece interfaces públicas para que módulos novos compartilhem eventos e estado sem depender do DOM ou conhecer a implementação uns dos outros.

Arquivo inicial:

```text
planet-hub/assets/andre-os-runtime-core-v1.js
```

O script é carregado antes do shell, autenticação e módulos do Hub.

## API pública v1

```js
AndreOS.runtime
AndreOS.events
AndreOS.state
```

Informações do Runtime:

```js
AndreOS.runtime.version
AndreOS.runtime.startedAt
AndreOS.runtime.isDevelopment
```

## Responsabilidades

O Runtime v1 é responsável por:

- disponibilizar o namespace global oficial;
- registrar e distribuir eventos canônicos;
- manter histórico curto de eventos para diagnóstico;
- oferecer replay controlado de eventos retidos;
- conectar temporariamente eventos legados ao Event Bus;
- disponibilizar a interface inicial do State Manager;
- impedir duplicações quando o produtor fornece uma chave de deduplicação.

## O que o Runtime não faz

O Runtime não deve:

- conhecer regras de prioridade do Radar;
- classificar chamados;
- calcular campanhas, finanças ou inaugurações;
- chamar APIs específicas de módulos;
- substituir o SULTS, banco, KV ou armazenamento local;
- renderizar páginas ou componentes;
- decidir a aparência da interface.

## State Manager v1

O State Manager está pronto para novos estados globais, mas os estados antigos não serão migrados em bloco.

### Registrar uma fatia

```js
AndreOS.state.registerSlice('navigation', {
  view: 'inicio',
});
```

### Ler e alterar

```js
AndreOS.state.get('navigation.view');
AndreOS.state.set('navigation.view', 'chamados');
AndreOS.state.update('navigation', (current) => ({
  ...current,
  view: 'calendario',
}));
```

### Observar

```js
const unsubscribe = AndreOS.state.subscribe(
  'navigation',
  (change) => console.log(change),
  { immediate: true },
);

unsubscribe();
```

### Contrato

- nomes de fatias usam `lowerCamelCase`;
- valores são clonados ao entrar e sair do State Manager;
- alterações emitem `state.changed`;
- registro emite `state.sliceRegistered`;
- o State Manager não persiste dados nesta versão;
- estado de componente que não é compartilhado deve continuar local.

## Compatibilidade legada

O Runtime reconhece temporariamente alguns eventos existentes e os publica com nomes canônicos.

Essa ponte permite migração gradual sem interromper módulos antigos.

Novos módulos não devem emitir eventos `pmh:*` ou `andre-os:*` diretamente.

## Ordem de adoção

1. novos módulos usam `AndreOS.events` e `AndreOS.state` desde o início;
2. produtores centrais migram para eventos canônicos;
3. consumidores antigos são migrados por fluxo funcional;
4. a ponte legada só é removida quando não houver consumidores;
5. Context, Navigation, Notifications e AI Gateway entram em sprints próprias.

## Roadmap

### Runtime v1

- namespace;
- Event Bus;
- convenção de eventos;
- inspector;
- State Manager inicial;
- ponte legada;
- documentação.

### Runtime v2

- Context Engine;
- Navigation Manager;
- Notification Center.

### Runtime v3

- Knowledge Packs;
- AI Gateway;
- registro de capacidades.

### Runtime v4

- scheduler;
- automações;
- sistema de plugins.
