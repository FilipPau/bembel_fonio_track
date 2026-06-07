import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SettingsTab {
  id: string;
  name: string;
}

interface GeneralSettings {
  appName: string;
  appDescription: string;
  timezone: string;
  language: string;
}

interface SecuritySettings {
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  sessionTimeout: number;
  enable2FA: boolean;
}

interface NotificationSettings {
  email: {
    newUsers: boolean;
    systemAlerts: boolean;
    backupCompletion: boolean;
  };
  inApp: {
    showBadges: boolean;
    autoDismiss: boolean;
  };
}

interface SystemSettings {
  cacheDuration: number;
  debugMode: boolean;
  maintenanceMode: boolean;
  autoBackup: boolean;
}

interface AppSettings {
  general: GeneralSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
  system: SystemSettings;
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  // Settings tabs
  settingsTabs = signal<SettingsTab[]>([
    { id: 'general', name: 'General' },
    { id: 'security', name: 'Security' },
    { id: 'notifications', name: 'Notifications' },
    { id: 'system', name: 'System' },
  ]);

  // Active tab
  activeTab = signal<string>('general');

  // Saving state
  saving = signal<boolean>(false);

  // Message state
  message = signal<string>('');
  messageType = signal<'success' | 'error'>('success');

  // Settings data
  settings = signal<AppSettings>({
    general: {
      appName: 'appointment-manager Admin',
      appDescription: 'A modern admin dashboard for managing your application',
      timezone: 'UTC',
      language: 'en',
    },
    security: {
      minPasswordLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      sessionTimeout: 30,
      enable2FA: false,
    },
    notifications: {
      email: {
        newUsers: true,
        systemAlerts: true,
        backupCompletion: false,
      },
      inApp: {
        showBadges: true,
        autoDismiss: true,
      },
    },
    system: {
      cacheDuration: 2,
      debugMode: false,
      maintenanceMode: false,
      autoBackup: true,
    },
  });

  // Set active tab
  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
  }

  // Save settings
  async saveSettings(): Promise<void> {
    this.saving.set(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // TODO: Implement actual settings save logic
      console.log('Saving settings:', this.settings());

      this.showMessage('Settings saved successfully!', 'success');
    } catch (error) {
      this.showMessage('Failed to save settings. Please try again.', 'error');
    } finally {
      this.saving.set(false);
    }
  }

  // Reset to defaults
  resetToDefaults(): void {
    if (
      confirm(
        'Are you sure you want to reset all settings to defaults? This action cannot be undone.',
      )
    ) {
      this.settings.set({
        general: {
          appName: 'appointment-manager Admin',
          appDescription:
            'A modern admin dashboard for managing your application',
          timezone: 'UTC',
          language: 'en',
        },
        security: {
          minPasswordLength: 8,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialChars: false,
          sessionTimeout: 30,
          enable2FA: false,
        },
        notifications: {
          email: {
            newUsers: true,
            systemAlerts: true,
            backupCompletion: false,
          },
          inApp: {
            showBadges: true,
            autoDismiss: true,
          },
        },
        system: {
          cacheDuration: 2,
          debugMode: false,
          maintenanceMode: false,
          autoBackup: true,
        },
      });

      this.showMessage('Settings reset to defaults!', 'success');
    }
  }

  // Show message
  private showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set(text);
    this.messageType.set(type);

    // Auto-hide message after 3 seconds
    setTimeout(() => {
      this.message.set('');
    }, 3000);
  }
}
