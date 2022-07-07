import { ISubmenuConfig } from '/@/components/ContextMenu/showContextMenu'
import { BaseWrapper } from '../../Common/BaseWrapper'
import { CopyAction } from './Edit/Copy'
import { PasteAction } from './Edit/Paste'
import { DuplicateAction } from './Edit/Duplicate'
import { RenameAction } from './Edit/Rename'
import { DeleteAction } from './Edit/Delete'
import { DirectoryWrapper } from '../../DirectoryView/DirectoryWrapper'

interface IEditOptions {
	hideRename?: boolean
	hideDelete?: boolean
}

export const EditAction = async (
	baseWrapper: BaseWrapper<any>,
	options: IEditOptions = {}
) => {
	// Construct and return submenu
	return <ISubmenuConfig>{
		type: 'submenu',
		icon: 'mdi-file-edit-outline',
		name: 'actions.edit.name',
		description: 'actions.edit.description',

		actions: [
			CopyAction(baseWrapper),
			PasteAction(
				baseWrapper instanceof DirectoryWrapper
					? baseWrapper
					: baseWrapper.getParent()!
			),
			DuplicateAction(baseWrapper),
			options.hideRename ? null : RenameAction(baseWrapper),
			options.hideDelete ? null : DeleteAction(baseWrapper),
		],
	}
}
