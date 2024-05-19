import { CancellationToken, Position, editor, languages, Range } from 'monaco-editor'
import { colorCodes } from './Language'
import { ProjectManager } from '@/libs/project/ProjectManager'
import { BedrockProject } from '@/libs/project/BedrockProject'
import { Command } from '@/libs/data/bedrock/CommandData'

//@ts-ignore
window.reloadId = Math.random() // TODO: Remove

export function setupMcFunction() {
	languages.register({ id: 'mcfunction', extensions: ['.mcfunction'], aliases: ['mcfunction'] })

	languages.setLanguageConfiguration('mcfunction', {
		wordPattern: /[aA-zZ]/, // Hack to make autocompletions work within an empty selector. Hopefully there are now implicit side effects.
		comments: {
			lineComment: '#',
		},
		autoClosingPairs: [
			{
				open: '(',
				close: ')',
			},
			{
				open: '[',
				close: ']',
			},
			{
				open: '{',
				close: '}',
			},
			{
				open: '"',
				close: '"',
			},
		],
	})

	//@ts-ignore
	const id = window.reloadId // TODO: Remove

	languages.registerCompletionItemProvider('mcfunction', {
		triggerCharacters: [' ', '[', '{', '=', ',', '!', '@', '\n'],

		async provideCompletionItems(
			model: editor.ITextModel,
			position: Position,
			context: languages.CompletionContext,
			token: CancellationToken
		) {
			//@ts-ignore
			if (id !== window.reloadId) return // TODO: Remove

			if (!ProjectManager.currentProject) return
			if (!(ProjectManager.currentProject instanceof BedrockProject)) return

			const line = model.getLineContent(position.lineNumber)

			const cursor = position.column - 1

			console.log('Triggered completions')

			return await getCommandCompletions(line, cursor, 0, position)
		},
	})

	ProjectManager.updatedCurrentProject.on(() => {
		if (!ProjectManager.currentProject) return
		if (!(ProjectManager.currentProject instanceof BedrockProject)) return

		updateTokensProvider(
			ProjectManager.currentProject.commandData
				.getCommands()
				.map((command) => command.commandName)
				.filter((command, index, commands) => commands.indexOf(command) === index),
			ProjectManager.currentProject.commandData
				.getSelectorArguments()
				.map((argument) => argument.argumentName)
				.filter((argument, index, argumentArray) => argumentArray.indexOf(argument) === index)
		)
	})

	updateTokensProvider([], [])

	if (ProjectManager.currentProject && ProjectManager.currentProject instanceof BedrockProject)
		updateTokensProvider(
			ProjectManager.currentProject.commandData
				.getCommands()
				.map((command) => command.commandName)
				.filter((command, index, commands) => commands.indexOf(command) === index),
			ProjectManager.currentProject.commandData
				.getSelectorArguments()
				.map((argument) => argument.argumentName)
				.filter((argument, index, argumentArray) => argumentArray.indexOf(argument) === index)
		)
}

function updateTokensProvider(commands: string[], selectorArguments: string[]) {
	languages.setMonarchTokensProvider('mcfunction', {
		brackets: [
			{
				open: '(',
				close: ')',
				token: 'delimiter.parenthesis',
			},
			{
				open: '[',
				close: ']',
				token: 'delimiter.square',
			},
			{
				open: '{',
				close: '}',
				token: 'delimiter.curly',
			},
		],
		keywords: commands,
		selectors: ['@a', '@e', '@p', '@r', '@s', '@initiator'],
		targetSelectorArguments: selectorArguments,

		tokenizer: {
			root: [
				[/#.*/, 'comment'],

				[
					/\{/,
					{
						token: 'delimiter.bracket',
						bracket: '@open',
						next: '@embeddedJson',
					},
				],
				[
					/\[/,
					{
						token: 'delimiter.bracket',
						next: '@targetSelectorArguments',
						bracket: '@open',
					},
				],
				{ include: '@common' },
				...colorCodes,
				[
					/[a-z_][\w\/]*/,
					{
						cases: {
							'@keywords': 'keyword',
							'@default': 'identifier',
						},
					},
				],
				[
					/(@[a-z]+)/,
					{
						cases: {
							'@selectors': 'type.identifier',
							'@default': 'identifier',
						},
					},
				],
			],

			common: [
				[/(\\)?"[^"]*"|'[^']*'/, 'string'],
				[/\=|\,|\!|%=|\*=|\+=|-=|\/=|<|=|>|<>/, 'definition'],
				[/true|false/, 'number'],
				[/-?([0-9]+(\.[0-9]+)?)|((\~|\^)-?([0-9]+(\.[0-9]+)?)?)/, 'number'],
			],

			embeddedJson: [
				[/\{/, 'delimiter.bracket', '@embeddedJson'],
				[/\}/, 'delimiter.bracket', '@pop'],
				{ include: '@common' },
			],
			targetSelectorArguments: [
				[/\]/, { token: '@brackets', bracket: '@close', next: '@pop' }],
				[
					/{/,
					{
						token: '@brackets',
						bracket: '@open',
						next: '@targetSelectorScore',
					},
				],
				[
					/[a-z_][\w\/]*/,
					{
						cases: {
							'@targetSelectorArguments': 'variable',
							'@default': 'identifier',
						},
					},
				],
				{ include: '@common' },
			],
			targetSelectorScore: [
				[/}/, { token: '@brackets', bracket: '@close', next: '@pop' }],
				{ include: '@common' },
			],
		},
	})
}

async function getCommandCompletions(
	line: string,
	cursor: number,
	tokenCursor: number,
	position: Position
): Promise<{ suggestions: any[] } | undefined> {
	if (!ProjectManager.currentProject || !(ProjectManager.currentProject instanceof BedrockProject)) return undefined

	const commandData = ProjectManager.currentProject.commandData

	tokenCursor = skipSpaces(line, tokenCursor)
	const token = getNextWord(line, tokenCursor)

	if (cursor < tokenCursor || (cursor == tokenCursor && !token))
		return {
			suggestions: commandData
				.getCommands()
				.filter(
					(command, index, commands) =>
						commands.findIndex((otherCommand) => command.commandName === otherCommand.commandName) === index
				)
				.map((command) => ({
					label: command.commandName,
					insertText: command.commandName,
					kind: languages.CompletionItemKind.Keyword,
					detail: command.description,
					range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
				})),
		}

	if (token && cursor <= token.start + token.word.length) {
		return {
			suggestions: commandData
				.getCommands()
				.filter(
					(command, index, commands) =>
						commands.findIndex((otherCommand) => command.commandName === otherCommand.commandName) === index
				)
				.filter((command) => command.commandName.startsWith(token.word))
				.map((command) => ({
					label: command.commandName,
					insertText: command.commandName,
					kind: languages.CompletionItemKind.Keyword,
					detail: command.description,
					range: new Range(
						position.lineNumber,
						token.start + 1,
						position.lineNumber,
						token.start + token.word.length + 1
					),
				})),
		}
	}

	if (!token) return undefined

	tokenCursor = token.start + token.word.length

	let possibleVariations: Command[] = commandData
		.getCommands()
		.filter((variation) => variation.commandName === token.word)
		.map((variation) => ({
			commandName: variation.commandName,
			description: variation.description,
			arguments: variation.arguments.flatMap((argument) => {
				if (argument.type === '$coordinates') {
					return [1, 2, 3].map(() => ({
						...argument,
						type: 'coordinate',
					}))
				}

				//TODO: Lookup the custom type in the data

				return [argument]
			}),
		}))

	return await getArgumentCompletions(line, cursor, tokenCursor, position, possibleVariations, 0, token.word)
}

async function getArgumentCompletions(
	line: string,
	cursor: number,
	tokenCursor: number,
	position: Position,
	variations: Command[],
	argumentIndex: number,
	command: string
): Promise<{ suggestions: any[] } | undefined> {
	if (!ProjectManager.currentProject || !(ProjectManager.currentProject instanceof BedrockProject)) return undefined

	const commandData = ProjectManager.currentProject.commandData

	variations = variations.flatMap((variation) => {
		if (variation.arguments[argumentIndex]?.allowMultiple) {
			const modifiedArguments = JSON.parse(JSON.stringify(variation.arguments))
			modifiedArguments.splice(argumentIndex, 0, JSON.parse(JSON.stringify(variation.arguments[argumentIndex])))

			return [
				variation,
				{
					...variation,
					arguments: modifiedArguments,
				},
			]
		}

		return [variation]
	})

	variations = variations.flatMap((variation) => {
		if (variation.arguments[argumentIndex]?.type === 'subcommand') {
			return commandData
				.getSubcommands()
				.find((commandData) => commandData.commandName === command)!
				.commands.map((subcommand) => {
					const args = JSON.parse(JSON.stringify(variation.arguments))
					args.splice(
						argumentIndex,
						1,
						{
							argumentName: 'subcommand',
							type: 'string',
							additionalData: {
								values: [subcommand.commandName],
							},
						},
						...subcommand.arguments
					)

					return {
						...variation,
						arguments: args,
					}
				})
		}

		return [variation]
	})

	const basicVariations = variations.filter((variation) => variation.arguments[argumentIndex].type !== 'selector')
	const selectorVariations = variations.filter((variation) => variation.arguments[argumentIndex].type === 'selector')
	const commandVariations = variations.filter((variation) => variation.arguments[argumentIndex].type === 'command')
	const blockStateVariations = variations.filter(
		(variation) => variation.arguments[argumentIndex].type === 'blockState'
	)

	const basicCompletions =
		basicVariations.length === 0
			? undefined
			: await getBasicCompletions(line, cursor, tokenCursor, position, basicVariations, argumentIndex, command)

	const selectorCompletions =
		selectorVariations.length === 0
			? undefined
			: await getSelectorCompletions(
					line,
					cursor,
					tokenCursor,
					position,
					selectorVariations,
					argumentIndex,
					command
			  )

	const commandCompletions =
		commandVariations.length === 0 ? undefined : await getCommandCompletions(line, cursor, tokenCursor, position)

	const blockStateCompletions =
		selectorVariations.length === 0
			? undefined
			: await getBlockStateCompletions(
					line,
					cursor,
					tokenCursor,
					position,
					blockStateVariations,
					argumentIndex,
					command
			  )

	if (
		basicCompletions === undefined &&
		selectorCompletions === undefined &&
		commandCompletions === undefined &&
		blockStateCompletions === undefined
	)
		return undefined

	const completions: any = {
		suggestions: [],
	}

	if (basicCompletions !== undefined)
		completions.suggestions = completions.suggestions.concat(basicCompletions.suggestions)

	if (selectorCompletions !== undefined)
		completions.suggestions = completions.suggestions.concat(selectorCompletions.suggestions)

	if (commandCompletions !== undefined)
		completions.suggestions = completions.suggestions.concat(commandCompletions.suggestions)

	if (blockStateCompletions !== undefined)
		completions.suggestions = completions.suggestions.concat(blockStateCompletions.suggestions)

	completions.suggestions = completions.suggestions.filter(
		(suggestion: any, index: any, suggestions: any) =>
			suggestions.findIndex((otherSuggestion: any) => suggestion.label === otherSuggestion.label) === index
	)

	return completions
}

async function getBasicCompletions(
	line: string,
	cursor: number,
	tokenCursor: number,
	position: Position,
	variations: Command[],
	argumentIndex: number,
	command: string
): Promise<{ suggestions: any[] } | undefined> {
	if (!ProjectManager.currentProject || !(ProjectManager.currentProject instanceof BedrockProject)) return undefined

	tokenCursor = skipSpaces(line, tokenCursor)
	const token = getNextWord(line, tokenCursor)

	if (cursor < tokenCursor || (cursor == tokenCursor && !token)) {
		const suggestions: any[] = []

		for (const variation of variations) {
			const argumentType = variation.arguments[argumentIndex]

			if (argumentType.type === 'string') {
				if (argumentType.additionalData?.values) {
					for (const value of argumentType.additionalData!.values as string[]) {
						suggestions.push({
							label: value,
							insertText: value,
							kind: languages.CompletionItemKind.Keyword,
							range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
						})
					}
				}

				if (argumentType.additionalData?.schemaReference) {
					const schema = ProjectManager.currentProject.schemaData.getAndResolve(
						argumentType.additionalData.schemaReference
					)

					const completions = ProjectManager.currentProject.schemaData.getAutocompletions(schema)

					for (const value of completions) {
						suggestions.push({
							label: value,
							insertText: value,
							kind: languages.CompletionItemKind.Keyword,
							range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
						})
					}
				}
			}

			if (argumentType.type === 'boolean') {
				for (const value of ['true', 'false']) {
					suggestions.push({
						label: value,
						insertText: value,
						kind: languages.CompletionItemKind.Keyword,
						range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
					})
				}
			}
		}

		return {
			suggestions,
		}
	}

	if (token && cursor <= token.start + token.word.length) {
		const suggestions: any[] = []

		for (const variation of variations) {
			const argumentType = variation.arguments[argumentIndex]

			if (argumentType.type === 'string') {
				if (argumentType.additionalData?.values) {
					for (const value of argumentType.additionalData!.values as string[]) {
						if (token && !value.startsWith(token.word)) continue

						suggestions.push({
							label: value,
							insertText: value,
							kind: languages.CompletionItemKind.Keyword,
							range: new Range(
								position.lineNumber,
								token.start + 1,
								position.lineNumber,
								token.start + token.word.length + 1
							),
						})
					}
				}

				if (argumentType.additionalData?.schemaReference) {
					const schema = ProjectManager.currentProject.schemaData.getAndResolve(
						argumentType.additionalData.schemaReference
					)

					const completions = ProjectManager.currentProject.schemaData.getAutocompletions(schema)

					for (const value of completions) {
						if (token && !value.startsWith(token.word)) continue

						suggestions.push({
							label: value,
							insertText: value,
							kind: languages.CompletionItemKind.Keyword,
							range: new Range(
								position.lineNumber,
								token.start + 1,
								position.lineNumber,
								token.start + token.word.length + 1
							),
						})
					}
				}
			}

			if (argumentType.type === 'boolean') {
				for (const value of ['true', 'false']) {
					if (token && !value.startsWith(token.word)) continue

					suggestions.push({
						label: value,
						insertText: value,
						kind: languages.CompletionItemKind.Keyword,
						range: new Range(
							position.lineNumber,
							token.start + 1,
							position.lineNumber,
							token.start + token.word.length + 1
						),
					})
				}
			}
		}

		return {
			suggestions,
		}
	}

	if (!token) return undefined

	tokenCursor = token.start + token.word.length

	variations = variations.filter(
		(variation) =>
			matchArgument(token, variation.arguments[argumentIndex]) && variation.arguments.length > argumentIndex + 1
	)

	if (variations.length === 0) return undefined

	return await getArgumentCompletions(line, cursor, tokenCursor, position, variations, argumentIndex + 1, command)
}

function getBasicSelectorPart(word: string): string {
	if (word[0] !== '@') return ''

	if (word.length === 1) return word[0]

	for (let index = 1; index < word.length; index++) {
		if (!/[a-z]/.test(word[index])) return word.substring(0, index)
	}

	return word
}

async function getSelectorCompletions(
	line: string,
	cursor: number,
	tokenCursor: number,
	position: Position,
	variations: Command[],
	argumentIndex: number,
	command: string
): Promise<{ suggestions: any[] } | undefined> {
	if (!ProjectManager.currentProject || !(ProjectManager.currentProject instanceof BedrockProject)) return undefined

	tokenCursor = skipSpaces(line, tokenCursor)
	const token = getNextSelector(line, tokenCursor)

	if (cursor < tokenCursor || (cursor == tokenCursor && !token)) {
		return {
			suggestions: ['p', 'r', 'a', 'e', 's', 'initiator'].map((selector) => ({
				label: '@' + selector,
				insertText: '@' + selector,
				kind: languages.CompletionItemKind.Keyword,
				range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
			})),
		}
	}

	if (token && cursor <= token.start + token.word.length) {
		let basicSelector = getBasicSelectorPart(token.word)

		if (cursor <= token.start + basicSelector.length) {
			const suggestions: any[] = []

			for (const selector of ['p', 'r', 'a', 'e', 's', 'initiator']) {
				if (token && !('@' + selector).startsWith(token.word)) continue

				suggestions.push({
					label: '@' + selector,
					insertText: '@' + selector,
					kind: languages.CompletionItemKind.Keyword,
					range: new Range(
						position.lineNumber,
						token.start + 1,
						position.lineNumber,
						token.start + token.word.length + 1
					),
				})
			}

			return {
				suggestions,
			}
		}

		tokenCursor = token.start + basicSelector.length

		if (line[tokenCursor] !== '[') return undefined

		tokenCursor++

		if (cursor === token.start + token.word.length && line[tokenCursor] === ']') return undefined

		return await getSelectorArgumentCompletions(line, cursor, tokenCursor, position)
	}

	if (!token) return undefined

	tokenCursor = token.start + token.word.length

	variations = variations.filter(
		(variation) =>
			matchArgument(token, variation.arguments[argumentIndex]) && variation.arguments.length > argumentIndex + 1
	)

	if (variations.length === 0) return undefined

	return await getArgumentCompletions(line, cursor, tokenCursor, position, variations, argumentIndex + 1, command)
}

async function getSelectorArgumentCompletions(
	line: string,
	cursor: number,
	tokenCursor: number,
	position: Position
): Promise<{ suggestions: any[] } | undefined> {
	if (!ProjectManager.currentProject || !(ProjectManager.currentProject instanceof BedrockProject)) return undefined

	tokenCursor = skipSpaces(line, tokenCursor)
	let token = getNextSelectorArgumentWord(line, tokenCursor)

	if (cursor < tokenCursor || (cursor == tokenCursor && !token))
		return {
			suggestions: ProjectManager.currentProject.commandData.getSelectorArguments().map((argument) => ({
				label: argument.argumentName,
				insertText: argument.argumentName,
				kind: languages.CompletionItemKind.Keyword,
				range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
			})),
		}

	if (token && cursor <= token.start + token.word.length)
		return {
			suggestions: ProjectManager.currentProject.commandData.getSelectorArguments().map((argument) => ({
				label: argument.argumentName,
				insertText: argument.argumentName,
				kind: languages.CompletionItemKind.Keyword,
				range: new Range(
					position.lineNumber,
					token!.start + 1,
					position.lineNumber,
					token!.start + token!.word.length + 1
				),
			})),
		}

	if (!token) return undefined

	const argumentData = ProjectManager.currentProject.commandData
		.getSelectorArguments()
		.find((data) => data.argumentName === token!.word)

	tokenCursor = token.start + token.word.length

	tokenCursor = skipSpaces(line, tokenCursor)
	token = getNextSelectorOperatorWord(line, tokenCursor)

	if (cursor <= tokenCursor) {
		return {
			suggestions: ['=', '=!'].map((operator) => ({
				label: operator,
				insertText: operator,
				kind: languages.CompletionItemKind.Operator,
				range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
			})),
		}
	}

	if (!token) return undefined

	tokenCursor = token.start + token.word.length

	tokenCursor = skipSpaces(line, tokenCursor)
	token = getNextSelectorValueWord(line, tokenCursor)

	if (cursor < tokenCursor || (cursor == tokenCursor && !token)) {
		if (!argumentData) return undefined

		if (argumentData.type === 'string') {
			if (argumentData.additionalData?.values)
				return {
					suggestions: argumentData.additionalData.values.map((value) => ({
						label: value,
						insertText: value,
						kind: languages.CompletionItemKind.Keyword,
						range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
					})),
				}

			if (argumentData.additionalData?.schemaReference) {
				const schema = ProjectManager.currentProject.schemaData.getAndResolve(
					argumentData.additionalData.schemaReference
				)

				const completions = ProjectManager.currentProject.schemaData.getAutocompletions(schema)

				return {
					suggestions: completions.map((value) => ({
						label: value,
						insertText: value,
						kind: languages.CompletionItemKind.Keyword,
						range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
					})),
				}
			}
		}

		if (argumentData.type === 'boolean') {
			return {
				suggestions: ['true', 'false'].map((value) => ({
					label: value,
					insertText: value,
					kind: languages.CompletionItemKind.Keyword,
					range: new Range(position.lineNumber, cursor + 1, position.lineNumber, cursor + 1),
				})),
			}
		}

		return undefined
	}

	if (token && cursor <= token.start + token.word.length) {
		if (!argumentData) return undefined

		if (argumentData.type === 'string') {
			if (argumentData.additionalData && argumentData.additionalData.values)
				return {
					suggestions: argumentData.additionalData.values.map((value) => ({
						label: value,
						insertText: value,
						kind: languages.CompletionItemKind.Keyword,
						range: new Range(
							position.lineNumber,
							token.start + 1,
							position.lineNumber,
							token.start + token.word.length + 1
						),
					})),
				}

			if (argumentData.additionalData?.schemaReference) {
				const schema = ProjectManager.currentProject.schemaData.getAndResolve(
					argumentData.additionalData.schemaReference
				)

				const completions = ProjectManager.currentProject.schemaData.getAutocompletions(schema)

				return {
					suggestions: completions.map((value) => ({
						label: value,
						insertText: value,
						kind: languages.CompletionItemKind.Keyword,
						range: new Range(
							position.lineNumber,
							token.start + 1,
							position.lineNumber,
							token.start + token.word.length + 1
						),
					})),
				}
			}
		}

		if (argumentData.type === 'boolean') {
			return {
				suggestions: ['true', 'false'].map((value) => ({
					label: value,
					insertText: value,
					kind: languages.CompletionItemKind.Keyword,
					range: new Range(
						position.lineNumber,
						token.start + 1,
						position.lineNumber,
						token.start + token.word.length + 1
					),
				})),
			}
		}

		return undefined
	}

	if (token === null) return undefined

	tokenCursor = token.start + token.word.length

	tokenCursor = skipSpaces(line, tokenCursor)
	if (line[tokenCursor] !== ',') return undefined

	tokenCursor++

	return await getSelectorArgumentCompletions(line, cursor, tokenCursor, position)
}

async function getBlockStateCompletions(
	line: string,
	cursor: number,
	tokenCursor: number,
	position: Position,
	variations: Command[],
	argumentIndex: number,
	command: string
): Promise<{ suggestions: any[] } | undefined> {
	if (!ProjectManager.currentProject || !(ProjectManager.currentProject instanceof BedrockProject)) return undefined

	tokenCursor = skipSpaces(line, tokenCursor)
	const token = getNextBlockState(line, tokenCursor)

	if (cursor < tokenCursor || (cursor == tokenCursor && !token)) {
		return undefined
	}

	if (token && cursor <= token.start + token.word.length) {
		return undefined
	}

	if (!token) return undefined

	tokenCursor = token.start + token.word.length

	variations = variations.filter(
		(variation) =>
			matchArgument(token, variation.arguments[argumentIndex]) && variation.arguments.length > argumentIndex + 1
	)

	if (variations.length === 0) return undefined

	return await getArgumentCompletions(line, cursor, tokenCursor, position, variations, argumentIndex + 1, command)
}

interface Token {
	word: string
	start: number
}

function matchArgument(argument: Token, type: any): boolean {
	if (type === undefined) return false

	if (type.type === 'string') {
		if (type.additionalData?.values && !type.additionalData.values.includes(argument.word)) return false

		return true
	}

	if (type.type === 'boolean' && /^(true|false)$/) return true

	//TODO: make selector matching more robust?
	if (type.type === 'selector' && /^@(a|e|r|s|p|(initiator))/.test(argument.word)) return true

	if (type.type === 'coordinate' && /^[~^]?(-?(([0-9]*\.[0-9]+)|[0-9]+))?$/.test(argument.word)) return true

	return false
}

function skipSpaces(line: string, cursor: number): number {
	let startCharacter = cursor

	while (line[startCharacter] === ' ') startCharacter++

	return startCharacter
}

function getNextWord(line: string, cursor: number): Token | null {
	if (line[cursor] === '"') {
		let closingIndex = -1

		for (let index = cursor + 1; index < line.length; index++) {
			if (line[index] !== '"') continue

			if (line[index - 1] === '\\') continue

			closingIndex = index + 1
		}

		if (closingIndex === -1) closingIndex = line.length

		return {
			word: line.substring(cursor, closingIndex),
			start: cursor,
		}
	}

	let spaceIndex = line.substring(cursor).indexOf(' ') + cursor
	if (spaceIndex === cursor - 1) spaceIndex = line.length

	if (spaceIndex <= cursor) return null

	return {
		word: line.substring(cursor, spaceIndex),
		start: cursor,
	}
}

function getNextSelector(line: string, cursor: number): Token | null {
	if (line[cursor] !== '@') return null

	let endCharacter = cursor + 2

	while (/^[a-z]+$/.test(line.slice(cursor + 1, endCharacter)) && endCharacter <= line.length) {
		endCharacter++
	}

	endCharacter--

	if (endCharacter === cursor + 1)
		return {
			word: '@',
			start: cursor,
		}

	if (line[endCharacter] !== '[')
		return {
			word: line.substring(cursor, endCharacter),
			start: cursor,
		}

	endCharacter++

	let openBracketCount = 1
	let withinString = false

	for (; endCharacter < line.length; endCharacter++) {
		if (line[endCharacter] === '"') {
			if (!withinString) {
				withinString = true
			} else if (line[endCharacter - 1] !== '\\') {
				withinString = false
			}
		}

		if (withinString) continue

		if (line[endCharacter] === '[') {
			openBracketCount++
		} else if (line[endCharacter] === ']') {
			openBracketCount--

			if (openBracketCount === 0) {
				endCharacter++

				break
			}
		}
	}

	return {
		word: line.substring(cursor, endCharacter),
		start: cursor,
	}
}

function getNextSelectorArgumentWord(line: string, cursor: number): Token | null {
	let endCharacter = cursor + 1

	while (/^[a-z]+$/.test(line.slice(cursor, endCharacter)) && endCharacter <= line.length) {
		endCharacter++
	}

	endCharacter--

	if (endCharacter === cursor) return null

	return {
		word: line.substring(cursor, endCharacter),
		start: cursor,
	}
}

function getNextSelectorOperatorWord(line: string, cursor: number): Token | null {
	if (line[cursor] + line[cursor + 1] === '=!') {
		return {
			word: '=!',
			start: cursor,
		}
	}

	if (line[cursor] === '=') {
		return {
			word: '=',
			start: cursor,
		}
	}

	return null
}

function getNextSelectorValueWord(line: string, cursor: number): Token | null {
	if (line[cursor] === '"') {
		let closingIndex = -1

		for (let index = cursor + 1; index < line.length; index++) {
			if (line[index] !== '"') continue

			if (line[index - 1] === '\\') continue

			closingIndex = index + 1
		}

		if (closingIndex === -1) closingIndex = line.length

		return {
			word: line.substring(cursor, closingIndex),
			start: cursor,
		}
	}

	const match = line.substring(cursor).match(/^[a-z_:A-Z0-9]+/)

	if (match === null) return null

	return {
		word: line.substring(cursor, cursor + match[0].length),
		start: cursor,
	}

	//TODO: Handle scores
}

function getNextBlockState(line: string, cursor: number): Token | null {
	if (line[cursor] !== '[') return null

	let endCharacter = cursor + 1

	let openBracketCount = 1
	let withinString = false

	for (; endCharacter < line.length; endCharacter++) {
		if (line[endCharacter] === '"') {
			if (!withinString) {
				withinString = true
			} else if (line[endCharacter - 1] !== '\\') {
				withinString = false
			}
		}

		if (withinString) continue

		if (line[endCharacter] === '[') {
			openBracketCount++
		} else if (line[endCharacter] === ']') {
			openBracketCount--

			if (openBracketCount === 0) {
				endCharacter++

				break
			}
		}
	}

	return {
		word: line.substring(cursor, endCharacter),
		start: cursor,
	}
}

function getNextSelectorBlockStateWord(line: string, cursor: number): Token | null {
	if (line[cursor] === '"') {
		let closingIndex = -1

		for (let index = cursor + 1; index < line.length; index++) {
			if (line[index] !== '"') continue

			if (line[index - 1] === '\\') continue

			closingIndex = index + 1
		}

		if (closingIndex === -1) closingIndex = line.length

		return {
			word: line.substring(cursor, closingIndex),
			start: cursor,
		}
	}

	let endCharacter = cursor + 1

	while (/^[0-9]+$/.test(line.slice(cursor, endCharacter)) && endCharacter <= line.length) {
		endCharacter++
	}

	endCharacter--

	if (endCharacter === cursor) return null

	return {
		word: line.substring(cursor, endCharacter),
		start: cursor,
	}
}
