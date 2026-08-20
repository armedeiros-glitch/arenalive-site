# Revisão de segurança inicial

Esta revisão protege as APIs internas sem alterar a interface ou as regras operacionais existentes.

Validações executadas:

- sintaxe JavaScript dos novos middlewares;
- autenticação mantida compatível com o cookie atual;
- rota de sessão preservada para permitir login;
- chamadas de IA limitadas sem exigir KV, D1 ou outro serviço pago;
- integração SULTS protegida pela mesma sessão do Hub;
- diagnóstico interno sem exposição de secrets.

A limitação de frequência usa memória do próprio Worker. Ela serve como contenção gratuita contra cliques repetidos e abuso, mas não substitui um painel oficial de faturamento da Cloudflare.
