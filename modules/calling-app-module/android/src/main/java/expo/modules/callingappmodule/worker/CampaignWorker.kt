package expo.modules.callingappmodule.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import expo.modules.callingappmodule.database.AppDatabase
import expo.modules.callingappmodule.database.CallLogEntity
import expo.modules.callingappmodule.database.CampaignEntity
import expo.modules.callingappmodule.database.ContactEntity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import java.util.UUID

class CampaignWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    private val db = AppDatabase.getDatabase(applicationContext)
    private val notificationManager =
        applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val telephonyManager =
        applicationContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
    private val audioManager =
        applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val telecomManager =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            applicationContext.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
        } else {
            null
        }

    private var tts: TextToSpeech? = null
    private var mediaPlayer: MediaPlayer? = null

    companion object {
        private const val CHANNEL_ID = "campaign_worker_channel"
        private const val NOTIFICATION_ID = 4242
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val campaignId = inputData.getInt("campaignId", -1)
        if (campaignId == -1) {
            return@withContext Result.failure()
        }

        // Set worker as foreground service
        setForeground(createForegroundInfo("Preparing campaign..."))

        // Update campaign status to RUNNING
        db.campaignDao().updateCampaignStatus(campaignId, "RUNNING")

        try {
            runCampaignLoop(campaignId)
        } catch (e: Exception) {
            e.printStackTrace()
            // If stopped or exception, mark campaign as PAUSED so it can be resumed
            val campaign = db.campaignDao().getCampaignById(campaignId)
            if (campaign != null && campaign.status == "RUNNING") {
                db.campaignDao().updateCampaignStatus(campaignId, "PAUSED")
            }
            return@withContext Result.failure()
        } finally {
            cleanupResources()
        }

        return@withContext Result.success()
    }

    private suspend fun runCampaignLoop(campaignId: Int) {
        while (true) {
            // Check if worker has been stopped
            if (isStopped) {
                db.campaignDao().updateCampaignStatus(campaignId, "PAUSED")
                break
            }

            // Check if campaign is still marked as RUNNING in DB (user might have paused it)
            val campaign = db.campaignDao().getCampaignById(campaignId)
            if (campaign == null || campaign.status != "RUNNING") {
                break
            }

            // Get Settings
            val settings = db.settingsDao().getSettings()
            val delaySeconds = settings?.delayBetweenCalls ?: campaign.delayBetweenCalls
            val maxRetries = settings?.retryCount ?: campaign.retryCount
            val autoEndCall = settings?.autoEndCall ?: true
            val ttsLanguage = settings?.ttsLanguage ?: "en-US"
            val audioVolume = settings?.audioVolume ?: 1.0f

            // Find next eligible contact
            // Eligible contact: status is PENDING, OR status is not COMPLETED and attempts <= maxRetries
            val contacts = db.contactDao().getContactsForCampaign(campaignId)
            val nextContact = contacts.firstOrNull {
                it.status == "PENDING" || (it.status != "COMPLETED" && it.attempts <= maxRetries)
            }

            if (nextContact == null) {
                // All contacts completed
                db.campaignDao().updateCampaignStatus(campaignId, "COMPLETED")
                showCompletedNotification(campaign.campaignName)
                break
            }

            // Update UI/Notification with progress
            val completedCount = contacts.count { it.status == "COMPLETED" }
            val progressText = "Calling ${nextContact.customerName} (${completedCount + 1}/${contacts.size})"
            setForeground(createForegroundInfo(progressText))

            // Process single contact call
            processCall(campaign, nextContact, autoEndCall, ttsLanguage, audioVolume)

            // Wait before next call
            if (!isStopped) {
                delay(delaySeconds * 1000L)
            }
        }
    }

    private suspend fun processCall(
        campaign: CampaignEntity,
        contact: ContactEntity,
        autoEndCall: Boolean,
        ttsLanguage: String,
        audioVolume: Float
    ) {
        val currentAttempt = contact.attempts + 1
        db.contactDao().updateContactStatusAndAttempts(contact.contactId, "DIALING", currentAttempt)

        val callStartTime = System.currentTimeMillis()
        var callStatus = "FAILED"
        var audioPlayed = false

        // Initialize TTS
        val ttsReady = CompletableDeferred<Boolean>()
        val mainHandler = Handler(Looper.getMainLooper())

        withContext(Dispatchers.Main) {
            tts = TextToSpeech(applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    val locale = try {
                        val parts = ttsLanguage.split("-")
                        if (parts.size > 1) Locale(parts[0], parts[1]) else Locale(ttsLanguage)
                    } catch (e: Exception) {
                        Locale.US
                    }
                    tts?.language = locale
                    ttsReady.complete(true)
                } else {
                    ttsReady.complete(false)
                }
            }
        }

        val isTtsInitialized = ttsReady.await()

        // Listen for call state transitions
        val callConnected = CompletableDeferred<Boolean>()
        val callEnded = CompletableDeferred<Unit>()

        val stateListener = object : PhoneStateListener() {
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                when (state) {
                    TelephonyManager.CALL_STATE_OFFHOOK -> {
                        // Call dialing/active
                        callConnected.complete(true)
                    }
                    TelephonyManager.CALL_STATE_IDLE -> {
                        // Call hung up
                        callConnected.complete(false) // If not already connected
                        callEnded.complete(Unit)
                    }
                }
            }
        }

        // Register listener
        withContext(Dispatchers.Main) {
            telephonyManager.listen(stateListener, PhoneStateListener.LISTEN_CALL_STATE)
        }

        try {
            // Trigger dialing
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:${contact.phoneNumber}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            applicationContext.startActivity(intent)

            // Wait for call state to become OFFHOOK (meaning call placement started)
            // Wait up to 10 seconds for user to place the call
            val offHook = withTimeoutOrNull(10000) {
                callConnected.await()
            } ?: false

            if (offHook) {
                // Call successfully initiated (off-hook)
                // Standard Android cannot detect if the other person picks up, so we wait 6 seconds
                delay(6000L)

                // Check if call is still active (hasn't went back to IDLE)
                if (!callEnded.isCompleted) {
                    // Route audio to speakerphone
                    audioManager.mode = AudioManager.MODE_IN_CALL
                    audioManager.isSpeakerphoneOn = true

                    // Speak name using TTS
                    if (isTtsInitialized && tts != null) {
                        val ttsCompleted = CompletableDeferred<Unit>()
                        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                            override fun onStart(utteranceId: String?) {}
                            override fun onDone(utteranceId: String?) {
                                ttsCompleted.complete(Unit)
                            }
                            override fun onError(utteranceId: String?) {
                                ttsCompleted.complete(Unit)
                            }
                        })
                        val utteranceId = UUID.randomUUID().toString()
                        tts?.speak("Hello ${contact.customerName}", TextToSpeech.QUEUE_FLUSH, null, utteranceId)

                        // Wait for TTS to finish (max 10s)
                        withTimeoutOrNull(10000) {
                            ttsCompleted.await()
                        }
                    }

                    // Play recorded audio
                    val audioFile = campaign.audioFilePath?.let { File(it) }
                    if (audioFile != null && audioFile.exists()) {
                        val audioCompleted = CompletableDeferred<Unit>()
                        withContext(Dispatchers.Main) {
                            mediaPlayer = MediaPlayer().apply {
                                setDataSource(audioFile.absolutePath)
                                setVolume(audioVolume, audioVolume)
                                setOnCompletionListener {
                                    audioCompleted.complete(Unit)
                                }
                                setOnErrorListener { _, _, _ ->
                                    audioCompleted.complete(Unit)
                                    true
                                }
                                prepare()
                                start()
                            }
                        }

                        // Wait for audio recording to complete
                        withTimeoutOrNull(60000) { // Max 1 minute recording
                            audioCompleted.await()
                        }
                        audioPlayed = true
                        callStatus = "COMPLETED"
                    } else {
                        // No audio file recorded, but TTS played
                        callStatus = "COMPLETED"
                    }

                    // Attempt to end call automatically if supported and enabled
                    if (autoEndCall && telecomManager != null) {
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                telecomManager.endCall()
                            }
                        } catch (e: SecurityException) {
                            e.printStackTrace()
                            // Permission issue, user must hang up manually
                        }
                    }
                } else {
                    // Call went idle before connection delay, meaning busy/rejected/failed
                    callStatus = "BUSY"
                }
            } else {
                callStatus = "FAILED"
            }

            // Wait for call to completely go back to IDLE (if not already IDLE)
            withTimeoutOrNull(15000) {
                callEnded.await()
            }

        } catch (e: Exception) {
            e.printStackTrace()
            callStatus = "FAILED"
        } finally {
            // Unregister telephony listener
            withContext(Dispatchers.Main) {
                telephonyManager.listen(stateListener, PhoneStateListener.LISTEN_NONE)
            }

            // Restore speakerphone setting
            audioManager.isSpeakerphoneOn = false
            audioManager.mode = AudioManager.MODE_NORMAL

            // Save Call Log
            val callEndTime = System.currentTimeMillis()
            val durationSeconds = ((callEndTime - callStartTime) / 1000).toInt().coerceAtLeast(0)

            // Let's refine call status based on duration if call ended prematurely
            val finalStatus = if (callStatus == "COMPLETED" && durationSeconds < 8) {
                "REJECTED"
            } else {
                callStatus
            }

            db.contactDao().updateContactStatus(contact.contactId, finalStatus)

            val log = CallLogEntity(
                campaignId = campaign.campaignId,
                contactId = contact.contactId,
                customerName = contact.customerName,
                phoneNumber = contact.phoneNumber,
                callStartTime = callStartTime,
                callEndTime = callEndTime,
                duration = durationSeconds,
                status = finalStatus,
                audioPlayed = audioPlayed
            )
            db.callLogDao().insertLog(log)

            // Shutdown TTS for this call to release resources
            withContext(Dispatchers.Main) {
                tts?.shutdown()
                tts = null
                mediaPlayer?.release()
                mediaPlayer = null
            }
        }
    }

    private fun cleanupResources() {
        tts?.shutdown()
        tts = null
        mediaPlayer?.release()
        mediaPlayer = null
    }

    private fun createForegroundInfo(text: String): ForegroundInfo {
        createNotificationChannel()

        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("Voice Broadcasting")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
            )
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Voice Broadcast Campaign Manager",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors and executes active voice broadcasting calling campaigns"
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun showCompletedNotification(campaignName: String) {
        val completedNotificationId = NOTIFICATION_ID + 1
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("Campaign Completed")
            .setContentText("Campaign '$campaignName' has finished running.")
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setAutoCancel(true)
            .build()
        notificationManager.notify(completedNotificationId, notification)
    }

    // Helper timeout builder
    private suspend fun <T> withTimeoutOrNull(timeMillis: Long, block: suspend () -> T): T? {
        return try {
            kotlinx.coroutines.withTimeout(timeMillis) {
                block()
            }
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            null
        }
    }
}
