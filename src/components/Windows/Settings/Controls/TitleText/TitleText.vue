<template>
	<!-- Margin or line to separate from other settings will definitely make it look nicer (maybe go for the same style as github README titles?) -->
	<div class="mt-10">
		<!-- Not decided on, fully. Although larger text that stands out looks fairly good. -->
		<h3 class="text-xl text-white font-medium">{{ t(config.name) }}</h3>
		<span class="ml-4 text-normal">{{ t(config.description) }}</span>
	</div>
</template>

<script>
import { TranslationMixin } from '/@/components/Mixins/TranslationMixin.ts'

export default {
	props: {
		config: Object,
		value: [String],
	},
	mixins: [TranslationMixin],
}
</script>
