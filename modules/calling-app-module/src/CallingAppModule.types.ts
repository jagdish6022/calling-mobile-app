export interface Campaign {
  campaignId: number;
  campaignName: string;
  audioFilePath: string;
  totalContacts: number;
  delayBetweenCalls: number;
  retryCount: number;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  createdAt: number;
}

export interface Contact {
  contactId: number;
  campaignId: number;
  customerName: string;
  phoneNumber: string;
  status: 'PENDING' | 'DIALING' | 'COMPLETED' | 'FAILED' | 'BUSY' | 'NO_ANSWER' | 'REJECTED';
  attempts: number;
}

export interface CallLog {
  logId: number;
  campaignId: number;
  contactId: number;
  customerName: string;
  phoneNumber: string;
  callStartTime: number;
  callEndTime: number;
  duration: number; // in seconds
  status: 'COMPLETED' | 'FAILED' | 'BUSY' | 'NO_ANSWER' | 'REJECTED';
  audioPlayed: boolean;
}

export interface Settings {
  delayBetweenCalls: number;
  retryCount: number;
  autoEndCall: boolean;
  ttsLanguage: string;
  audioVolume: number;
}
