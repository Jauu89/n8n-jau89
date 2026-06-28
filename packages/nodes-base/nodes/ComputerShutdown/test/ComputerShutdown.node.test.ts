// Unit tests for ComputerShutdown/ComputerPower node logic.
// These do not execute real OS commands or send real UDP packets.

// ── buildCommand (duplicated from node to keep tests self-contained) ──
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

// ── parseMac / buildMagicPacket (duplicated from node) ──
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
	const packet = Buffer.alloc(6 + 16 * 6);
	packet.fill(0xff, 0, 6);
	for (let i = 0; i < 16; i++) {
		macBytes.copy(packet, 6 + i * 6);
	}
	return packet;
}

// ── Tests ──

describe('ComputerShutdown – buildCommand', () => {
	describe('Linux', () => {
		it('shutdown inmediato', () => {
			expect(buildCommand('shutdown', 0, 'linux')).toBe('shutdown -h now');
		});

		it('shutdown con retardo', () => {
			expect(buildCommand('shutdown', 120, 'linux')).toBe('shutdown -h +2');
		});

		it('reboot inmediato', () => {
			expect(buildCommand('reboot', 0, 'linux')).toBe('shutdown -r now');
		});

		it('suspend sin retardo', () => {
			expect(buildCommand('suspend', 0, 'linux')).toBe('systemctl suspend');
		});

		it('suspend con retardo', () => {
			expect(buildCommand('suspend', 30, 'linux')).toBe('sleep 30 && systemctl suspend');
		});

		it('hibernate', () => {
			expect(buildCommand('hibernate', 0, 'linux')).toBe('systemctl hibernate');
		});

		it('cancel', () => {
			expect(buildCommand('cancel', 0, 'linux')).toBe('shutdown -c 2>/dev/null || true');
		});
	});

	describe('macOS', () => {
		it('shutdown inmediato', () => {
			expect(buildCommand('shutdown', 0, 'darwin')).toBe('shutdown -h now');
		});

		it('shutdown con retardo redondeado al minuto', () => {
			expect(buildCommand('shutdown', 90, 'darwin')).toBe('shutdown -h +2');
		});

		it('suspend', () => {
			expect(buildCommand('suspend', 0, 'darwin')).toBe('pmset sleepnow');
		});

		it('reboot', () => {
			expect(buildCommand('reboot', 0, 'darwin')).toBe('shutdown -r now');
		});

		it('cancel', () => {
			expect(buildCommand('cancel', 0, 'darwin')).toBe('killall shutdown 2>/dev/null; true');
		});
	});

	describe('Windows', () => {
		it('shutdown inmediato', () => {
			expect(buildCommand('shutdown', 0, 'win32')).toBe('shutdown /s /t 0');
		});

		it('shutdown con retardo en segundos', () => {
			expect(buildCommand('shutdown', 60, 'win32')).toBe('shutdown /s /t 60');
		});

		it('reboot', () => {
			expect(buildCommand('reboot', 0, 'win32')).toBe('shutdown /r /t 0');
		});

		it('suspend', () => {
			expect(buildCommand('suspend', 0, 'win32')).toBe(
				'rundll32.exe powrprof.dll,SetSuspendState 0,1,0',
			);
		});

		it('cancel', () => {
			expect(buildCommand('cancel', 0, 'win32')).toBe('shutdown /a');
		});
	});
});

describe('ComputerShutdown – Wake-on-LAN magic packet', () => {
	it('parseMac acepta formato con dos puntos', () => {
		const bytes = parseMac('AA:BB:CC:DD:EE:FF');
		expect(bytes).toEqual(Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]));
	});

	it('parseMac acepta formato con guiones', () => {
		const bytes = parseMac('AA-BB-CC-DD-EE-FF');
		expect(bytes).toEqual(Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]));
	});

	it('parseMac acepta formato sin separadores', () => {
		const bytes = parseMac('AABBCCDDEEFF');
		expect(bytes).toEqual(Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]));
	});

	it('parseMac lanza error con MAC inválida', () => {
		expect(() => parseMac('ZZ:ZZ:ZZ:ZZ:ZZ:ZZ')).toThrow('Dirección MAC inválida');
		expect(() => parseMac('AA:BB:CC')).toThrow('Dirección MAC inválida');
	});

	it('buildMagicPacket tiene 102 bytes (6 + 16×6)', () => {
		const packet = buildMagicPacket('AA:BB:CC:DD:EE:FF');
		expect(packet.length).toBe(102);
	});

	it('los primeros 6 bytes son 0xFF', () => {
		const packet = buildMagicPacket('AA:BB:CC:DD:EE:FF');
		for (let i = 0; i < 6; i++) {
			expect(packet[i]).toBe(0xff);
		}
	});

	it('la MAC se repite 16 veces a partir del byte 6', () => {
		const mac = 'AA:BB:CC:DD:EE:FF';
		const packet = buildMagicPacket(mac);
		const expected = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
		for (let i = 0; i < 16; i++) {
			const slice = packet.slice(6 + i * 6, 6 + i * 6 + 6);
			expect(slice).toEqual(expected);
		}
	});

	it('magic packet en minúsculas funciona igual', () => {
		const packet = buildMagicPacket('aa:bb:cc:dd:ee:ff');
		expect(packet.length).toBe(102);
		expect(packet[6]).toBe(0xaa);
	});
});
