import { App, TFile } from 'obsidian';
import { GoogleGeminiAdapter } from '@elo/core';
import { InputModal } from '@/Infrastructure/Presentation/Obsidian/Views/Modals/InputModal';
import { showMessage } from '@/Infrastructure/Presentation/Obsidian/Utils/Messages';

import { TranslationService } from '@elo/obsidian-plugin';

export class NaturalLanguageSearchCommand {
	constructor(
		private app: App,
		private llm: GoogleGeminiAdapter,
		private translationService: TranslationService,
	) {}

	async execute(): Promise<void> {
		new InputModal(
			this.app,
			this.translationService,
			{
				title: this.translationService.t('search.title'),
				label: this.translationService.t('search.label'),
				placeholder: this.translationService.t('search.placeholder'),
				submitText: this.translationService.t('search.submit'),
				isTextArea: true,
			},
			async (query: string) => {
				if (!query) return;
				await this.processSearch(query);
			},
		).open();
	}

	private async processSearch(userQuery: string): Promise<void> {
		showMessage(this.translationService.t('search.interpreting'));

		const prompt = `
      Actúa como un experto en Obsidian. Tu tarea es traducir una consulta de búsqueda en lenguaje natural a una "Search Query" válida de Obsidian.
      
      Reglas:
      - Usa operadores de búsqueda de Obsidian como:
        - \`file:Name\` para nombre de archivo.
        - \`path:Path\` para carpeta.
        - \`content:Text\` o simplemente \`Text\` para contenido.
        - \`tag:#tag\` para etiquetas.
        - \`line:(...)\`, \`block:(...)\`, \`section:(...)\` si aplica.
        - Fechas: NO uses fechas relativas como "ayer" o "hoy". Debes calcular la fecha absoluta en formato YYYY-MM-DD basándote en que hoy es ${new Date().toISOString().split('T')[0]}.
        - \`file:2024-01-01\` busca en el nombre, si quieres fecha de creación/modificación no hay operador nativo directo en la búsqueda global estándar para fecha de archivo (stat), PERO si el usuario pide "notas diarias" o fechas que suelen estar en el nombre, úsalo en \`file:\`.
        - **IMPORTANTE**: Cuando el usuario mencione "Campo", "Campos" o "Propiedad", se refiere a campos del Frontmatter. Usa la sintaxis de búsqueda de propiedades de Obsidian:
           - \`["nombre_campo":valor]\` para buscar un valor específico (e.g. \`["coche":ford]\`).
           - \`["nombre_campo"]\` para buscar notas que tengan ese campo definido, sin importar el valor.
           - Si pide "que no tenga el campo X", usa \`-["nombre_campo"]\`.
      - Si la consulta es compleja, combínalos con espacios (AND implícito) o OR.
      - Responde ÚNICAMENTE con la cadena de búsqueda, sin explicaciones ni markdown.

      Ejemplos:
      - "Recetas de pasta" -> "tag:#receta pasta" (si se asume tag) o "pasta"
      - "Notas de la carpeta cocina" -> "path:cocina"
      - "Notas del 2024" -> "file:2024"

      Consulta del usuario: "${userQuery}"
    `;

		const searchQuery = await this.llm.request({ prompt });

		if (!searchQuery) {
			showMessage(this.translationService.t('search.interpretError'));
			return;
		}

		console.log(
			`[NaturalLanguageSearchCommand] Original: "${userQuery}" -> Query: "${searchQuery}"`,
		);

		this.executeObsidianSearch(searchQuery.trim());
	}

	private executeObsidianSearch(query: string): void {
		// Attempt to find the global search plugin instance
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const internalPlugins = (this.app as any).internalPlugins;
		const searchPlugin = internalPlugins.getPluginById('global-search');

		if (searchPlugin && searchPlugin.instance) {
			searchPlugin.instance.openGlobalSearch(query);
		} else {
			// Fallback: try to find an open search leaf or open a new one manually
			// This is less reliable if the plugin isn't enabled, but it should be core.
			let searchLeaf = this.app.workspace.getLeavesOfType('search')[0];

			if (!searchLeaf) {
				this.app.workspace.getRightLeaf(false)?.setViewState({
					type: 'search',
					active: true,
				});
				searchLeaf = this.app.workspace.getLeavesOfType('search')[0];
			}

			if (searchLeaf) {
				const view = searchLeaf.view as any;
				// setQuery exists on the search view
				if (typeof view.setQuery === 'function') {
					view.setQuery(query);
					// Optionally trigger the search if setQuery doesn't do it
					if (typeof view.submit === 'function') {
						view.submit();
					}
				}
				this.app.workspace.revealLeaf(searchLeaf);
			} else {
				showMessage(this.translationService.t('search.openError'));
			}
		}
	}
}
