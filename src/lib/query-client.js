import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Performance (13/10): ao voltar para uma tela visitada há menos de 30 s, mostra os dados
			// que já estão na memória em vez de buscar tudo de novo. Salvar/editar continua
			// atualizando na hora (as telas invalidam a consulta após cada alteração).
			staleTime: 30 * 1000,
		},
	},
});