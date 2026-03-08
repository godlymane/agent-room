import { execSync } from 'child_process';
import { logActivity } from '../db.js';

function adb(cmd: string, timeout = 10000): string {
  try {
    return execSync(`adb ${cmd}`, { encoding: 'utf-8', timeout }).trim();
  } catch (e: any) {
    return `ADB error: ${e.message}`;
  }
}

function shell(cmd: string): string {
  return adb(`shell ${cmd}`);
}

export async function handleAndroidTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'phone_screenshot': {
      // Take screenshot and get base64
      shell('screencap -p /sdcard/agent_screen.png');
      const result = adb('exec-out screencap -p | base64');
      logActivity({ type: 'action', message: 'Took phone screenshot', device: 'phone' });
      return `Screenshot captured (${result.length} bytes base64). Screen is active.`;
    }

    case 'phone_screen_text': {
      // Dump UI hierarchy and extract text
      shell('uiautomator dump /sdcard/ui_dump.xml');
      const xml = shell('cat /sdcard/ui_dump.xml');
      // Extract text attributes
      const texts: string[] = [];
      const regex = /text="([^"]+)"/g;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        if (match[1].trim()) texts.push(match[1].trim());
      }
      logActivity({ type: 'action', message: 'Read phone screen text', device: 'phone' });
      return `Screen text:\n${texts.join('\n')}`;
    }

    case 'phone_tap': {
      shell(`input tap ${input.x} ${input.y}`);
      logActivity({ type: 'action', message: `Tapped phone (${input.x}, ${input.y})`, device: 'phone' });
      return `Tapped at (${input.x}, ${input.y})`;
    }

    case 'phone_type': {
      // Escape special chars for adb
      const escaped = input.text.replace(/ /g, '%s').replace(/'/g, "\\'");
      shell(`input text "${escaped}"`);
      logActivity({ type: 'action', message: `Typed on phone: "${input.text.slice(0, 30)}"`, device: 'phone' });
      return `Typed: "${input.text}"`;
    }

    case 'phone_swipe': {
      const dir = input.direction || 'up';
      const cx = 540, cy = 1380; // center of screen
      const dist = 800;
      let x1 = cx, y1 = cy, x2 = cx, y2 = cy;
      if (dir === 'up') { y1 = cy + dist / 2; y2 = cy - dist / 2; }
      if (dir === 'down') { y1 = cy - dist / 2; y2 = cy + dist / 2; }
      if (dir === 'left') { x1 = cx + dist / 2; x2 = cx - dist / 2; }
      if (dir === 'right') { x1 = cx - dist / 2; x2 = cx + dist / 2; }
      shell(`input swipe ${x1} ${y1} ${x2} ${y2} 300`);
      logActivity({ type: 'action', message: `Swiped ${dir} on phone`, device: 'phone' });
      return `Swiped ${dir}`;
    }

    case 'phone_open_app': {
      const appMap: Record<string, string> = {
        instagram: 'com.instagram.android',
        whatsapp: 'com.whatsapp',
        twitter: 'com.twitter.android',
        chrome: 'com.android.chrome',
        youtube: 'com.google.android.youtube',
        telegram: 'org.telegram.messenger',
        gmail: 'com.google.android.gm',
        camera: 'com.oppo.camera',
        settings: 'com.android.settings',
        playstore: 'com.android.vending',
      };
      const pkg = appMap[input.app?.toLowerCase()] || input.app;
      shell(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`);
      logActivity({ type: 'action', message: `Opened ${input.app} on phone`, device: 'phone' });
      return `Opened ${input.app} (${pkg})`;
    }

    case 'phone_press': {
      const keyMap: Record<string, number> = {
        home: 3, back: 4, recent: 187, enter: 66,
        volume_up: 24, volume_down: 25, power: 26,
      };
      const keycode = keyMap[input.button?.toLowerCase()] || parseInt(input.button) || 3;
      shell(`input keyevent ${keycode}`);
      logActivity({ type: 'action', message: `Pressed ${input.button} on phone`, device: 'phone' });
      return `Pressed ${input.button}`;
    }

    case 'phone_install_apk': {
      const result = adb(`install "${input.path}"`);
      logActivity({ type: 'action', message: `Installed APK: ${input.path}`, device: 'phone' });
      return result;
    }

    case 'phone_get_notifications': {
      const result = shell('dumpsys notification --noredact');
      // Extract notification summaries
      const lines = result.split('\n');
      const notifs: string[] = [];
      for (const line of lines) {
        if (line.includes('android.title=') || line.includes('android.text=')) {
          notifs.push(line.trim());
        }
      }
      return notifs.length > 0 ? notifs.slice(0, 20).join('\n') : 'No notifications';
    }

    default:
      return `Unknown android tool: ${name}`;
  }
}
