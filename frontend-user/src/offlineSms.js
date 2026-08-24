/**
 * Offline Emergency SMS & Outbox Utility
 * Provides zero-internet communication protocols for SOS dispatch and community chat.
 */

export const EMERGENCY_NUMBERS = {
  nationalEmergency: '112',
  ndmaHelpline: '1078',
  stateDisaster: '1070',
  ambulance: '108',
  ndrfHq: '+911124363260',
  communityGateway: '1078', // Standard government disaster SMS routing gateway
};

// Keys for local caching
const CHAT_OUTBOX_KEY = 'sentinel_offline_chat_outbox';
const SOS_OUTBOX_KEY = 'sentinel_offline_sos_outbox';

/**
 * Format SOS report into compact standardized SMS payload
 */
export function formatSosSmsPayload(report) {
  const parts = [
    'NDRF EMERGENCY SOS',
    `Name: ${report.name || 'Citizen'}`,
    `Phone: ${report.phone || 'N/A'}`,
    `Location: ${report.location}`,
    `Persons: ${report.people}`,
    `Type: ${report.emergency_type}`,
  ];

  if (report.lat && report.lng) {
    parts.push(`GPS: ${Number(report.lat).toFixed(5)},${Number(report.lng).toFixed(5)}`);
  }

  if (report.medical) {
    parts.push(`CRITICAL MEDICAL: ${report.medical_details || 'Urgent Oxygen/Ambulance Required'}`);
  }

  if (report.notes) {
    parts.push(`Notes: ${report.notes.slice(0, 80)}`);
  }

  return parts.join(' | ');
}

/**
 * Format Community Chat message into compact SMS payload
 */
export function formatChatSmsPayload(msg) {
  const parts = [
    'NDRF CITIZEN CHAT',
    `#${msg.channel || 'general'}`,
    `Tag: ${msg.tag || 'General'}`,
    `From: ${msg.user_name || 'Citizen'}`,
    `Loc: ${msg.location || 'Relief Area'}`,
    `Msg: ${msg.message}`,
  ];
  return parts.join(' | ');
}

/**
 * Generate native sms: URI for mobile browsers and desktop handlers
 */
export function createSmsUri(recipientNumber, bodyText) {
  const cleanNumber = (recipientNumber || '112').replace(/[^\d+]/g, '');
  const encodedBody = encodeURIComponent(bodyText);

  // iOS uses '&body=', Android & others use '?body='
  const isIos = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIos ? '&body=' : '?body=';

  return `sms:${cleanNumber}${separator}${encodedBody}`;
}

/**
 * Open native SMS app with pre-filled content
 */
export function triggerSmsApp(recipientNumber, bodyText) {
  const uri = createSmsUri(recipientNumber, bodyText);
  if (typeof window !== 'undefined') {
    window.location.href = uri;
  }
  return uri;
}

// ── Outbox Management (Local Persistent Queue) ───────────────────────────────

export function getOfflineChatOutbox() {
  try {
    const raw = localStorage.getItem(CHAT_OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineChatOutbox(outbox) {
  try {
    localStorage.setItem(CHAT_OUTBOX_KEY, JSON.stringify(outbox));
  } catch (e) {
    console.error('Failed to save chat outbox', e);
  }
}

export function queueOfflineChatMessage(messageData) {
  const outbox = getOfflineChatOutbox();
  const item = {
    ...messageData,
    offline_id: 'off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    queued_at: new Date().toISOString(),
    status: 'queued_for_sync',
    sms_sent: false,
  };
  outbox.push(item);
  saveOfflineChatOutbox(outbox);
  return item;
}

export function removeOfflineChatMessage(offlineId) {
  const outbox = getOfflineChatOutbox().filter(m => m.offline_id !== offlineId);
  saveOfflineChatOutbox(outbox);
}

export function markChatMessageSmsSent(offlineId) {
  const outbox = getOfflineChatOutbox().map(m => {
    if (m.offline_id === offlineId) {
      return { ...m, sms_sent: true };
    }
    return m;
  });
  saveOfflineChatOutbox(outbox);
}

/**
 * Auto-sync all queued offline messages once online connection is available
 */
export async function syncOfflineOutbox(apiClient) {
  const outbox = getOfflineChatOutbox();
  if (outbox.length === 0) return { syncedCount: 0, failedCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;
  const remaining = [];

  for (const item of outbox) {
    try {
      await apiClient.sendChatMessage({
        user_id: item.user_id,
        user_name: item.user_name,
        channel: item.channel,
        tag: item.tag,
        location: item.location,
        message: item.message + (item.sms_sent ? ' [Transmitted via Emergency SMS]' : ' [Synced from Offline Outbox]'),
      });
      syncedCount++;
    } catch (err) {
      console.warn('Sync failed for item', item.offline_id, err);
      failedCount++;
      remaining.push(item);
    }
  }

  saveOfflineChatOutbox(remaining);
  return { syncedCount, failedCount };
}
