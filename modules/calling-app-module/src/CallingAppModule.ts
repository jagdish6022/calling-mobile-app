import { NativeModule, requireNativeModule } from 'expo';
import { Campaign, Contact, CallLog, Settings } from './CallingAppModule.types';

declare class CallingAppModule extends NativeModule {
  // Permissions
  checkPermissions(): Promise<{ CALL_PHONE: boolean; READ_PHONE_STATE: boolean; RECORD_AUDIO: boolean }>;
  requestPermissions(): Promise<boolean>;

  // Campaign
  createCampaign(campaignName: string, delay: number, retry: number): Promise<Campaign>;
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(campaignId: number): Promise<Campaign | null>;
  deleteCampaign(campaignId: number): Promise<boolean>;
  updateCampaignStatus(campaignId: number, status: string): Promise<boolean>;
  updateCampaignAudio(campaignId: number, audioFilePath: string | null): Promise<boolean>;

  // Contact
  addContact(campaignId: number, customerName: string, phoneNumber: string): Promise<Contact>;
  deleteContact(contactId: number): Promise<boolean>;
  getContacts(campaignId: number): Promise<Contact[]>;
  importContactsCsv(uriString: string, campaignId: number): Promise<number>;

  // CallLog
  getLogs(campaignId: number): Promise<CallLog[]>;
  getAllLogs(): Promise<CallLog[]>;
  exportLogsCsv(campaignId: number): Promise<string>;

  // Settings
  getSettings(): Promise<Settings>;
  saveSettings(delay: number, retry: number, autoEndCall: boolean, ttsLanguage: string, audioVolume: number): Promise<boolean>;

  // WorkManager Control
  startCampaign(campaignId: number): Promise<boolean>;
  pauseCampaign(campaignId: number): Promise<boolean>;
  stopCampaign(campaignId: number): Promise<boolean>;
  resetCampaignContacts(campaignId: number): Promise<boolean>;
  isCampaignWorkerRunning(campaignId: number): Promise<boolean>;
  recoverUnfinishedCampaigns(): Promise<boolean>;

  // Audio Recording
  startRecording(campaignId: number): Promise<string>;
  stopRecording(): Promise<string>;
  playAudio(filePath: string): Promise<boolean>;
  stopAudio(): Promise<boolean>;
  deleteAudio(filePath: string): Promise<boolean>;
}

let moduleInstance: any;

try {
  moduleInstance = requireNativeModule<CallingAppModule>('CallingAppModule');
} catch (e) {
  console.warn('CallingAppModule native module not found, using JS mock/fallback.');

  let campaigns: Campaign[] = [];
  let contacts: Contact[] = [];
  let callLogs: CallLog[] = [];
  let settings: Settings = {
    delayBetweenCalls: 5,
    retryCount: 3,
    autoEndCall: true,
    ttsLanguage: 'en-US',
    audioVolume: 1.0,
  };
  let isWorkerRunning: Record<number, boolean> = {};
  let currentRecordingPath = '';
  let isAudioPlaying = false;
  let campaignIdCounter = 1;
  let contactIdCounter = 1;
  let logIdCounter = 1;

  class MockCallingAppModule {
    // Permissions
    async checkPermissions() {
      return { CALL_PHONE: true, READ_PHONE_STATE: true, RECORD_AUDIO: true };
    }
    async requestPermissions() {
      return true;
    }

    // Campaign
    async createCampaign(campaignName: string, delay: number, retry: number) {
      const newCampaign: Campaign = {
        campaignId: campaignIdCounter++,
        campaignName,
        audioFilePath: '',
        totalContacts: 0,
        delayBetweenCalls: delay,
        retryCount: retry,
        status: 'DRAFT',
        createdAt: Date.now(),
      };
      campaigns.push(newCampaign);
      return newCampaign;
    }
    async getCampaigns() {
      return [...campaigns];
    }
    async getCampaign(campaignId: number) {
      return campaigns.find(c => c.campaignId === campaignId) || null;
    }
    async deleteCampaign(campaignId: number) {
      campaigns = campaigns.filter(c => c.campaignId !== campaignId);
      contacts = contacts.filter(c => c.campaignId !== campaignId);
      callLogs = callLogs.filter(c => c.campaignId !== campaignId);
      return true;
    }
    async updateCampaignStatus(campaignId: number, status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED') {
      const c = campaigns.find(c => c.campaignId === campaignId);
      if (c) {
        c.status = status;
        return true;
      }
      return false;
    }
    async updateCampaignAudio(campaignId: number, audioFilePath: string | null) {
      const c = campaigns.find(c => c.campaignId === campaignId);
      if (c) {
        c.audioFilePath = audioFilePath || '';
        return true;
      }
      return false;
    }

    // Contact
    async addContact(campaignId: number, customerName: string, phoneNumber: string) {
      const newContact: Contact = {
        contactId: contactIdCounter++,
        campaignId,
        customerName,
        phoneNumber,
        status: 'PENDING',
        attempts: 0,
      };
      contacts.push(newContact);
      const c = campaigns.find(c => c.campaignId === campaignId);
      if (c) {
        c.totalContacts = contacts.filter(co => co.campaignId === campaignId).length;
      }
      return newContact;
    }
    async deleteContact(contactId: number) {
      const contact = contacts.find(c => c.contactId === contactId);
      if (contact) {
        contacts = contacts.filter(c => c.contactId !== contactId);
        const c = campaigns.find(ca => ca.campaignId === contact.campaignId);
        if (c) {
          c.totalContacts = contacts.filter(co => co.campaignId === contact.campaignId).length;
        }
        return true;
      }
      return false;
    }
    async getContacts(campaignId: number) {
      return contacts.filter(c => c.campaignId === campaignId);
    }
    async importContactsCsv(uriString: string, campaignId: number) {
      const mockNames = ['Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince'];
      const mockPhones = ['1234567890', '9876543210', '5551234567', '4449876543'];
      let added = 0;
      for (let i = 0; i < mockNames.length; i++) {
        await this.addContact(campaignId, mockNames[i], mockPhones[i]);
        added++;
      }
      return added;
    }

    // CallLog
    async getLogs(campaignId: number) {
      return callLogs.filter(l => l.campaignId === campaignId);
    }
    async getAllLogs() {
      return [...callLogs];
    }
    async exportLogsCsv(campaignId: number) {
      return `file://mock-path-to-logs-${campaignId}.csv`;
    }

    // Settings
    async getSettings() {
      return { ...settings };
    }
    async saveSettings(delay: number, retry: number, autoEndCall: boolean, ttsLanguage: string, audioVolume: number) {
      settings = {
        delayBetweenCalls: delay,
        retryCount: retry,
        autoEndCall,
        ttsLanguage,
        audioVolume,
      };
      return true;
    }

    // WorkManager Control
    async startCampaign(campaignId: number) {
      isWorkerRunning[campaignId] = true;
      await this.updateCampaignStatus(campaignId, 'RUNNING');
      
      // Simulate calls for the campaign in background
      setTimeout(async () => {
        const campaignContacts = contacts.filter(c => c.campaignId === campaignId && c.status === 'PENDING');
        for (const contact of campaignContacts) {
          if (!isWorkerRunning[campaignId]) break;
          contact.status = 'DIALING';
          
          await new Promise(r => setTimeout(r, 1000));
          
          if (!isWorkerRunning[campaignId]) break;
          contact.status = 'COMPLETED';
          contact.attempts = 1;
          
          // Add a log
          callLogs.push({
            logId: logIdCounter++,
            campaignId,
            contactId: contact.contactId,
            customerName: contact.customerName,
            phoneNumber: contact.phoneNumber,
            callStartTime: Date.now() - 5000,
            callEndTime: Date.now(),
            duration: 5,
            status: 'COMPLETED',
            audioPlayed: true,
          });
          
          await new Promise(r => setTimeout(r, settings.delayBetweenCalls * 1000));
        }
        isWorkerRunning[campaignId] = false;
        await this.updateCampaignStatus(campaignId, 'COMPLETED');
      }, 1000);

      return true;
    }
    async pauseCampaign(campaignId: number) {
      isWorkerRunning[campaignId] = false;
      await this.updateCampaignStatus(campaignId, 'PAUSED');
      return true;
    }
    async stopCampaign(campaignId: number) {
      isWorkerRunning[campaignId] = false;
      await this.updateCampaignStatus(campaignId, 'DRAFT');
      return true;
    }
    async resetCampaignContacts(campaignId: number) {
      contacts.forEach(c => {
        if (c.campaignId === campaignId) {
          c.status = 'PENDING';
          c.attempts = 0;
        }
      });
      await this.updateCampaignStatus(campaignId, 'DRAFT');
      return true;
    }
    async isCampaignWorkerRunning(campaignId: number) {
      return !!isWorkerRunning[campaignId];
    }
    async recoverUnfinishedCampaigns() {
      return true;
    }

    // Audio Recording
    async startRecording(campaignId: number) {
      currentRecordingPath = `file://mock-audio-path-${campaignId}.m4a`;
      return currentRecordingPath;
    }
    async stopRecording() {
      const path = currentRecordingPath;
      currentRecordingPath = '';
      return path;
    }
    async playAudio(filePath: string) {
      isAudioPlaying = true;
      return true;
    }
    async stopAudio() {
      isAudioPlaying = false;
      return true;
    }
    async deleteAudio(filePath: string) {
      return true;
    }
  }

  moduleInstance = new MockCallingAppModule();
}

export default moduleInstance;
export * from './CallingAppModule.types';
