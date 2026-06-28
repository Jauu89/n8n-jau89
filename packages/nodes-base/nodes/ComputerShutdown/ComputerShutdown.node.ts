import { exec } from 'child_process';
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

function execAsync(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve) => {
		const result = { stdout: '', stderr: '', exitCode: 0 };
		exec(command, (error, stdout, stderr) => {
			result.stdout = stdout.trim();
			result.stderr = stderr.trim();
			if (error) {
				result.exitCode = error.code ?? 1;
			}
			resolve(result);
		}).on('exit', (code) => {
			result.exitCode = code ?? 0;
		});
	});
}

function buildCommand(action: string, delaySeconds: number, platform: string): string {
	const isLinux = platform === 'linux';
	const isMac = platform === 'darwin';
	const isWindows = platform === 'win32';
	const delayMinutes = Math.ceil(delaySeconds / 60);

	if (action === 'cancel') {
		if (isWindows) return 'shutdown /a';
		if (isMac) return 'killall shutdown 2>/dev/null; true';
		return 'shutdown -c 2>/dev/null || true';
	}

	if (isWindows) {
		const flag =
			action === 'shutdown' ? '/s' : action === 'reboot' ? '/r' : '/h';
		const delaySecs = delaySeconds;
		if (action === 'suspend') return 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
		return `shutdown ${flag} /t ${delaySecs}`;
	}

	if (isMac) {
		if (action === 'suspend') return 'pmset sleepnow';
		const subcommand = action === 'shutdown' ? '-h' : '-r';
		if (delaySeconds === 0) return `shutdown ${subcommand} now`;
		return `shutdown ${subcommand} +${delayMinutes}`;
	}

	// Linux (systemd / sysvinit)
	if (action === 'suspend') {
		if (delaySeconds > 0) return `sleep ${delaySeconds} && systemctl suspend`;
		return 'systemctl suspend';
	}
	if (action === 'hibernate') {
		if (delaySeconds > 0) return `sleep ${delaySeconds} && systemctl hibernate`;
		return 'systemctl hibernate';
	}
	const subcommand = action === 'shutdown' ? 'poweroff' : 'reboot';
	if (delaySeconds === 0) return `shutdown -${action === 'shutdown' ? 'h' : 'r'} now`;
	return `shutdown -${action === 'shutdown' ? 'h' : 'r'} +${delayMinutes}`;
}

export class ComputerShutdown implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Computer Shutdown',
		name: 'computerShutdown',
		icon: 'fa:power-off',
		iconColor: 'red',
		group: ['transform'],
		version: 1,
		description: 'Apaga, suspende, hiberna o reinicia el ordenador que aloja n8n',
		defaults: {
			name: 'Computer Shutdown',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Acción',
				name: 'action',
				type: 'options',
				options: [
					{
						name: 'Apagar',
						value: 'shutdown',
						description: 'Apaga el ordenador completamente',
					},
					{
						name: 'Suspender',
						value: 'suspend',
						description: 'Suspende el ordenador (RAM activa)',
					},
					{
						name: 'Hibernar',
						value: 'hibernate',
						description: 'Hiberna el ordenador (guarda RAM en disco)',
					},
					{
						name: 'Reiniciar',
						value: 'reboot',
						description: 'Reinicia el ordenador',
					},
					{
						name: 'Cancelar apagado',
						value: 'cancel',
						description: 'Cancela un apagado o reinicio programado',
					},
				],
				default: 'shutdown',
				required: true,
			},
			{
				displayName: 'Retardo (segundos)',
				name: 'delaySeconds',
				type: 'number',
				default: 0,
				description:
					'Segundos antes de ejecutar la acción (0 = inmediato). En macOS/Linux se redondea al minuto más cercano para shutdown/reboot.',
				displayOptions: {
					show: {
						action: ['shutdown', 'reboot'],
					},
				},
			},
			{
				displayName: 'Plataforma',
				name: 'platform',
				type: 'options',
				options: [
					{
						name: 'Detectar automáticamente',
						value: 'auto',
					},
					{
						name: 'Linux',
						value: 'linux',
					},
					{
						name: 'macOS',
						value: 'darwin',
					},
					{
						name: 'Windows',
						value: 'win32',
					},
				],
				default: 'auto',
				description: 'Sistema operativo del ordenador a apagar',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const action = this.getNodeParameter('action', i) as string;
				const delaySeconds =
					action === 'shutdown' || action === 'reboot'
						? (this.getNodeParameter('delaySeconds', i) as number)
						: 0;
				const platformParam = this.getNodeParameter('platform', i) as string;
				const platform = platformParam === 'auto' ? process.platform : platformParam;

				const command = buildCommand(action, delaySeconds, platform);
				const result = await execAsync(command);

				if (result.exitCode !== 0 && result.stderr) {
					throw new NodeOperationError(
						this.getNode(),
						`El comando falló (código ${result.exitCode}): ${result.stderr}`,
						{ itemIndex: i },
					);
				}

				returnItems.push({
					json: {
						action,
						platform,
						delaySeconds,
						command,
						exitCode: result.exitCode,
						stdout: result.stdout,
						stderr: result.stderr,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnItems.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnItems];
	}
}
