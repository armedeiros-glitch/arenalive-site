# Event Bus do André OS

## API

```js
AndreOS.events.on(name, handler, options)
AndreOS.events.off(name, handler)
AndreOS.events.emit(name, detail, options)
AndreOS.events.once(name, handler, options)
```

Recursos auxiliares:

```js
AndreOS.events.latest(name)
AndreOS.events.replay(name, options)
AndreOS.events.history(options)
AndreOS.events.inspect(options)
```

## Convenção de nomes

Eventos usam:

```text
dominio.acao
```

O domínio é minúsculo. A ação usa `lowerCamelCase` quando possuir mais de uma palavra.

Exemplos válidos:

```text
system.ready
system.authenticated
navigation.viewChanged
radar.updated
focus.changed
assistant.responseFinished
marketing.ticketOpened
calendar.updated
```

Não usar nomes de arquivos, seletores, componentes visuais ou versões na identificação do evento.

## Catálogo inicial

```js
AndreOS.events.names.system.ready
AndreOS.events.names.system.authenticated
AndreOS.events.names.navigation.viewChanged
AndreOS.events.names.radar.updated
AndreOS.events.names.radar.refreshRequested
AndreOS.events.names.focus.changed
AndreOS.events.names.focus.completed
AndreOS.events.names.assistant.contextUpdated
AndreOS.events.names.assistant.responseFinished
AndreOS.events.names.marketing.internalDemandsUpdated
AndreOS.events.names.calendar.updated
AndreOS.events.names.state.changed
```

O catálogo evita strings soltas em módulos novos.

## Escutar eventos

```js
const stop = AndreOS.events.on(
  AndreOS.events.names.radar.updated,
  (snapshot) => {
    console.log(snapshot.items);
  },
  { replayLatest: true },
);

stop();
```

`replayLatest` entrega o último evento retido para consumidores que carregaram depois da publicação original.

## Escutar uma vez

```js
AndreOS.events.once(
  AndreOS.events.names.system.authenticated,
  (session) => console.log(session),
  { replayLatest: true },
);
```

## Emitir

```js
AndreOS.events.emit(
  AndreOS.events.names.focus.changed,
  { itemId: 'ticket-123' },
  { source: 'radar' },
);
```

Opções principais:

- `source`: origem técnica do evento;
- `retain`: guarda o último valor para `replayLatest`;
- `dedupeKey`: impede a repetição da mesma ocorrência;
- `bridgeLegacy`: controla a ponte temporária com eventos antigos.

## Renderizações e replay

`navigation.viewChanged` recebe um `viewId` por renderização.

O replay de compatibilidade usa esse identificador para não disparar repetidamente a mesma página caso o bootstrap seja executado mais de uma vez.

Exemplo de payload:

```js
{
  view: 'inicio',
  viewId: 'inicio:12',
  content: HTMLElement,
  replayed: false,
}
```

## Event Inspector

Ativar no console:

```js
const inspector = AndreOS.events.inspect();
```

Filtrar por domínio:

```js
AndreOS.events.inspect('radar.');
```

Consultar histórico:

```js
inspector.history({ limit: 30 });
AndreOS.events.history({ filter: 'navigation.' });
```

Parar:

```js
inspector.stop();
```

Em ambientes de preview ou local, o Runtime é identificado como desenvolvimento. O inspector só começa automaticamente quando a URL contém:

```text
?andreosDebug=1
```

## Ponte de compatibilidade

Mapeamento inicial:

| Evento canônico | Evento legado |
|---|---|
| `system.authenticated` | `pmh:access-ready` |
| `navigation.viewChanged` | `pmh:view-rendered` |
| `radar.updated` | `pmh:radar-data` |
| `radar.refreshRequested` | `pmh:active-refresh` |
| `marketing.internalDemandsUpdated` | `pmh:demands-updated` |
| `system.viewportChanged` | `aos:mobile-change` |

A ponte funciona nos dois sentidos durante a migração:

- eventos antigos são publicados no Event Bus;
- eventos canônicos continuam notificando consumidores antigos.

Novos módulos devem utilizar somente os nomes canônicos.

## Regras de payload

- preferir objetos simples;
- incluir identificadores estáveis;
- não enviar segredos ou credenciais;
- não usar elementos do DOM como estado permanente;
- eventos descrevem algo que aconteceu, não uma função a ser executada;
- comandos explícitos devem terminar com nomes como `Requested` quando necessário.
