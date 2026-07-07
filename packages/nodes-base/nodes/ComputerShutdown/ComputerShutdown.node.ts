import { createSocket } from 'dgram';
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
	const isMac = platform === 'darwin';
	const isWindows = platform === 'win32';
	const delayMinutes = Math.ceil(delaySeconds / 60);

	if (action === 'cancel') {
		if (isWindows) return 'shutdown /a';
		if (isMac) return 'killall shutdown 2>/dev/null; true';
		return 'shutdown -c 2>/dev/null || true';
	}

	if (isWindows) {
		if (action === 'suspend') return 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
		const flag = action === 'shutdown' ? '/s' : '/r';
		return `shutdown ${flag} /t ${delaySeconds}`;
	}

	if (isMac) {
		if (action === 'suspend') return 'pmset sleepnow';
		const subcommand = action === 'shutdown' ? '-h' : '-r';
		if (delaySeconds === 0) return `shutdown ${subcommand} now`;
		return `shutdown ${subcommand} +${delayMinutes}`;
	}

	// Linux
	if (action === 'suspend') {
		if (delaySeconds > 0) return `sleep ${delaySeconds} && systemctl suspend`;
		return 'systemctl suspend';
	}
	if (action === 'hibernate') {
		if (delaySeconds > 0) return `sleep ${delaySeconds} && systemctl hibernate`;
		return 'systemctl hibernate';
	}
	if (delaySeconds === 0) return `shutdown -${action === 'shutdown' ? 'h' : 'r'} now`;
	return `shutdown -${action === 'shutdown' ? 'h' : 'r'} +${delayMinutes}`;
}

// Normalizes MAC to 6 bytes, accepts formats: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, AABBCCDDEEFF
function parseMac(mac: string): Buffer {
	const hex = mac.replace(/[:\-\s]/g, '');
	if (!/^[0-9a-fA-F]{12}$/.test(hex)) {
		throw new Error(`Dirección MAC inválida: "${mac}". Usa el formato AA:BB:CC:DD:EE:FF`);
	}
	const bytes = Buffer.alloc(6);
	for (let i = 0; i < 6; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function buildMagicPacket(mac: string): Buffer {
	const macBytes = parseMac(mac);
	// Magic packet: 6x 0xFF followed by MAC address repeated 16 times
	const packet = Buffer.alloc(6 + 16 * 6);
	packet.fill(0xff, 0, 6);
	for (let i = 0; i < 16; i++) {
		macBytes.copy(packet, 6 + i * 6);
	}
	return packet;
}

function sendWakeOnLan(mac: string, broadcastAddress: string, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const packet = buildMagicPacket(mac);
		const socket = createSocket('udp4');
		socket.once('error', (err) => {
			socket.close();
			reject(err);
		});
		socket.bind(() => {
			socket.setBroadcast(true);
			socket.send(packet, 0, packet.length, port, broadcastAddress, (err) => {
				socket.close();
				if (err) reject(err);
				else resolve();
			});
		});
	});
}

export class ComputerShutdown implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Computer Power',
		name: 'computerShutdown',
		icon: 'fa:power-off',
		iconColor: 'red',
		group: ['transform'],
		version: 1,
		description: 'Enciende (Wake-on-LAN), apaga, suspende, hiberna o reinicia un ordenador de forma remota',
		defaults: {
			name: 'Computer Power',
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
						name: 'Encender (Wake-on-LAN)',
						value: 'wol',
						description: 'Envía un magic packet para encender el ordenador remotamente',
					},
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
				default: 'wol',
				required: true,
			},

			// ── Wake-on-LAN parameters ──
			{
				displayName: 'Dirección MAC',
				name: 'macAddress',
				type: 'string',
				default: '',
				placeholder: 'AA:BB:CC:DD:EE:FF',
				description:
					'Dirección MAC de la tarjeta de red del ordenador a encender. Acepta formato con ":", "-" o sin separadores.',
				required: true,
				displayOptions: {
					show: {
						action: ['wol'],
					},
				},
			},
			{
				displayName: 'Dirección de broadcast',
				name: 'broadcastAddress',
				type: 'string',
				default: '255.255.255.255',
				description:
					'Dirección IP de broadcast de la red local. Usa 255.255.255.255 para broadcast global o la dirección de subred (p.ej. 192.168.1.255).',
				displayOptions: {
					show: {
						action: ['wol'],
					},
				},
			},
			{
				displayName: 'Puerto UDP',
				name: 'wolPort',
				type: 'number',
				default: 9,
				description: 'Puerto UDP para el magic packet (normalmente 7 o 9)',
				displayOptions: {
					show: {
						action: ['wol'],
					},
				},
			},

			// ── Shutdown/reboot parameters ──
			{
				displayName: 'Retardo (segundos)',
				name: 'delaySeconds',
				type: 'number',
				default: 0,
				description:
					'Segundos antes de ejecutar la acción (0 = inmediato). En macOS/Linux se redondea al minuto más cercano.',
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
				description: 'Sistema operativo del ordenador',
				displayOptions: {
					hide: {
						action: ['wol'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const action = this.getNodeParameter('action', i) as string;

				if (action === 'wol') {
					const macAddress = this.getNodeParameter('macAddress', i) as string;
					const broadcastAddress = this.getNodeParameter('broadcastAddress', i) as string;
					const wolPort = this.getNodeParameter('wolPort', i) as number;

					await sendWakeOnLan(macAddress, broadcastAddress, wolPort);

					returnItems.push({
						json: {
							action: 'wol',
							macAddress,
							broadcastAddress,
							port: wolPort,
							success: true,
							message: `Magic packet enviado a ${macAddress} via ${broadcastAddress}:${wolPort}`,
						},
						pairedItem: { item: i },
					});
				} else {
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
				}
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
