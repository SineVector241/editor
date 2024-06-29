import { Window } from '../Window'
import { Ref, ref } from 'vue'
import Prompt from './Prompt.vue'

export class PromptWindow extends Window {
	public id = 'promptWindow'
	public component = Prompt

	public name: Ref<string> = ref('?')

	constructor(
		name: string,
		public label: string,
		public placeholder: string,
		public confirmCallback: (input: string) => void,
		public cancelCallback: () => void = () => {},
		public defaultValue?: string
	) {
		super()

		this.name.value = name
	}

	public confirm(input: string) {
		this.confirmCallback(input)
	}

	public cancel() {
		this.cancelCallback()
	}
}
