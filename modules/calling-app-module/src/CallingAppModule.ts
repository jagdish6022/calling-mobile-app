import { NativeModule, requireNativeModule } from 'expo';
import { Campaign, Contact, CallLog, Settings } from './CallingAppModule.types';

declare class CallingAppModule extends NativeModule {
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

export default requireNativeModule<CallingAppModule>('CallingAppModule');
export * from './CallingAppModule.types';
