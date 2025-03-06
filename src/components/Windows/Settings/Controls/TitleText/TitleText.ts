import { Control, IControl } from '../Control'
import TitleTextComponent from './TitleText.vue'

export class TitleText extends Control<string> {
	constructor(config: {
		name: string
		category: string
		description: string
	}) {
		super(TitleTextComponent, { ...config, key: 'N/A' })
	}

	matches(filter: string) {
		return (
			this.config.name.includes(filter) ||
			this.config.description.includes(filter)
		)
	}
}
