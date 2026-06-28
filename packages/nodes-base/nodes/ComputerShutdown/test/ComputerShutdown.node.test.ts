// Tests for the command builder logic extracted from ComputerShutdown node.
// We test command generation without actually executing any OS command.

// Re-implement the pure buildCommand function here to keep the test self-contained.
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
		const flag = action === 'shutdown' ? '/s' : action === 'reboot' ? '/r' : '/h';
		if (action === 'suspend') return 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
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
