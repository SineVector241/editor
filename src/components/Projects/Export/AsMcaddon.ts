import { isUsingFileSystemPolyfill } from '/@/components/FileSystem/Polyfill'
import { saveOrDownload } from '/@/components/FileSystem/saveOrDownload'
import { ZipDirectory } from '/@/components/FileSystem/Zip/ZipDirectory'
import { App } from '/@/App'
import { createNotification } from '/@/components/Notifications/create'
import { InformationWindow } from '/@/components/Windows/Common/Information/InformationWindow'
import { PackType } from '../../Data/PackType'

export async function exportAsMcaddon() {
	const app = await App.getApp()
	app.windows.loadingWindow.open()

	// Increment manifest versions if using a file system polyfill
	// This allows user to simply import the file into Minecraft even if the same pack
	// with a lower version number is already installed
	if (isUsingFileSystemPolyfill) {
		const fs = app.project.fileSystem

		for (const pack of app.project.getPacks()) {
			const packPath = PackType.getPath(pack)

			if (await fs.fileExists(`${packPath}/manifest.json`)) {
				const manifest =
					(await fs.readJSON(`${packPath}/manifest.json`)) ?? {}
				const [major, minor, patch] = <[number, number, number]>(
					manifest.header?.version
				) ?? [0, 0, 0]

				// Increment patch version
				const newVersion = [major, minor, patch + 1]

				// Write back to file
				await fs.writeJSON(
					`${packPath}/manifest.json`,
					{
						...manifest,
						header: {
							...(manifest.header ?? {}),
							version: newVersion,
						},
					},
					true
				)
			}
		}
	}

	await app.project.compilerManager.start('default', 'build')

	const zipFolder = new ZipDirectory(
		await app.project.fileSystem.getDirectoryHandle('builds/dist', {
			create: true,
		})
	)
	const savePath = `builds/${app.project.name}.mcaddon`

	try {
		await saveOrDownload(
			savePath,
			await zipFolder.package(),
			app.project.fileSystem
		)
	} catch (err) {
		console.error(err)
	}

	let projectName = app.project.name
	if (!isUsingFileSystemPolyfill) {
		const notification = createNotification({
			icon: 'mdi-export',
			color: 'success',
			textColor: 'white',
			message: 'general.successfulExport.title',
			onClick: () => {
				new InformationWindow({
					description: `[${app.locales.translate(
						'general.successfulExport.description'
					)}: "projects/${projectName}/${savePath}"]`,
				})
				notification.dispose()
			},
		})
	}

	app.windows.loadingWindow.close()
}
