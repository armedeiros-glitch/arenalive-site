# Caça Leads automático v1

## Objetivo

Fazer o Caça Leads descobrir candidatos sem depender de alimentação manual, preservando revisão humana e o funil oficial existente.

## Fluxo

1. execução agendada;
2. consulta a fontes configuradas;
3. normalização para `Candidate`;
4. deduplicação contra candidatos e leads;
5. anexação de evidências e origem;
6. cálculo do score Planet;
7. entrada em revisão;
8. aprovação humana;
9. promoção explícita para Leads.

## Regras

- nenhuma promoção automática;
- nenhuma coleta de dado privado;
- cada candidato precisa registrar fonte e evidência;
- execução deve possuir limites por fonte, cidade e ciclo;
- falha de uma fonte não pode invalidar os candidatos válidos das demais;
- relatórios devem mostrar encontrados, criados, duplicados, inválidos e sem contato.

## Primeira implementação

Criar uma interface de provedores e começar com uma fonte empresarial autorizada. Credenciais e limites ficam em variáveis de ambiente da Cloudflare. O domínio atual de candidatos permanece como única porta de entrada.
