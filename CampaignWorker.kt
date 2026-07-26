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
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.telecom.TelecomManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.content.pm.PackageManager
import android.Manifest
import androidx.annotation.RequiresApi
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
            if (isStopped) {
                db.campaignDao().updateCampaignStatus(campaignId, "PAUSED")
                break
            }

            val campaign = db.campaignDao().getCampaignById(campaignId)
            if (campaign == null || campaign.status != "RUNNING") {
                break
            }

            val settings = db.settingsDao().getSettings()
            val delaySeconds = settings?.delayBetweenCalls ?: campaign.delayBetweenCalls
            val maxRetries = settings?.retryCount ?: campaign.retryCount
            val autoEndCall = settings?.autoEndCall ?: true
            val ttsLanguage = settings?.ttsLanguage ?: "en-US"
            val audioVolume = settings?.audioVolume ?: 1.0f

            val contacts = db.contactDao().getContactsForCampaign(campaignId)
            val nextContact = contacts.firstOrNull {
                it.status == "PENDING" || (it.status != "COMPLETED" && it.attempts <= maxRetries)
            }

            if (nextContact == null) {
                db.campaignDao().updateCampaignStatus(campaignId, "COMPLETED")
                showCompletedNotification(campaign.campaignName)
                break
            }

            val completedCount = contacts.count { it.status == "COMPLETED" }
            val progressText = "Calling ${nextContact.customerName} (${completedCount + 1}/${contacts.size})"
            setForeground(createForegroundInfo(progressText))

            processCall(campaign, nextContact, autoEndCall, ttsLanguage, audioVolume)

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

        // Track call state — use TelephonyCallback on API 31+, PhoneStateListener on older
        val callConnected = CompletableDeferred<Boolean>()
        val callEnded = CompletableDeferred<Unit>()

        // The unregister lambda is set inside the version branches below
        val unregisterCallListener: suspend () -> Unit

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val callback = makeTelephonyCallback(callConnected, callEnded)
            withContext(Dispatchers.Main) {
                telephonyManager.registerTelephonyCallback(applicationContext.mainExecutor, callback)
            }
            unregisterCallListener = {
                withContext(Dispatchers.Main) {
                    telephonyManager.unregisterTelephonyCallback(callback)
                }
            }
        } else {
            val listener = makePhoneStateListener(callConnected, callEnded)
            withContext(Dispatchers.Main) {
                @Suppress("DEPRECATION")
                telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            }
            unregisterCallListener = {
                withContext(Dispatchers.Main) {
                    @Suppress("DEPRECATION")
                    telephonyManager.listen(listener, PhoneStateListener.LISTEN_NONE)
                }
            }
        }

        try {
            // Trigger dialing
            val dialableNumber = contact.phoneNumber.filter { it.isDigit() || it == '+' }.toString()
            var callPlaced = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && telecomManager != null) {
                try {
                    val hasReadPhoneState = applicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
                    val hasCallPhone = applicationContext.checkSelfPermission(Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED

                    if (hasReadPhoneState && hasCallPhone) {
                        val accounts = telecomManager.getCallCapablePhoneAccounts()
                        if (!accounts.isNullOrEmpty()) {
                            val uri = Uri.fromParts("tel", dialableNumber, null)
                            val extras = Bundle().apply {
                                putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, accounts[0])
                            }
                            telecomManager.placeCall(uri, extras)
                            callPlaced = true
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            if (!callPlaced) {
                // Fallback to Intent.ACTION_CALL
                val intent = Intent(Intent.ACTION_CALL).apply {
                    data = Uri.parse("tel:$dialableNumber")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                applicationContext.startActivity(intent)
            }

            // Wait up to 10 seconds for the call to become active (OFFHOOK)
            val offHook = withTimeoutOrNull(10000) {
                callConnected.await()
            } ?: false

            if (offHook) {
                // Call is active — wait 6 s for recipient to answer before playing audio
                delay(6000L)

                if (!callEnded.isCompleted) {
                    audioManager.mode = AudioManager.MODE_IN_CALL
                    audioManager.isSpeakerphoneOn = true

                    // Greet by name via TTS
                    if (isTtsInitialized && tts != null) {
                        val ttsCompleted = CompletableDeferred<Unit>()
                        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                            override fun onStart(utteranceId: String?) {}
                            override fun onDone(utteranceId: String?) { ttsCompleted.complete(Unit) }
                            override fun onError(utteranceId: String?) { ttsCompleted.complete(Unit) }
                        })
                        tts?.speak("Hello ${contact.customerName}", TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
                        withTimeoutOrNull(10000) { ttsCompleted.await() }
                    }

                    // Play recorded audio
                    val audioFile = campaign.audioFilePath?.let { File(it) }
                    if (audioFile != null && audioFile.exists()) {
                        val audioCompleted = CompletableDeferred<Unit>()
                        withContext(Dispatchers.Main) {
                            mediaPlayer = MediaPlayer().apply {
                                setDataSource(audioFile.absolutePath)
                                setVolume(audioVolume, audioVolume)
                                setOnCompletionListener { audioCompleted.complete(Unit) }
                                setOnErrorListener { _, _, _ -> audioCompleted.complete(Unit); true }
                                prepare()
                                start()
                            }
                        }
                        withTimeoutOrNull(60000) { audioCompleted.await() }
                        audioPlayed = true
                        callStatus = "COMPLETED"
                    } else {
                        // No audio file but TTS played — still counts as delivered
                        callStatus = "COMPLETED"
                    }

                    // Auto-end call if enabled
                    if (autoEndCall && telecomManager != null) {
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                telecomManager.endCall()
                            }
                        } catch (e: SecurityException) {
                            e.printStackTrace()
                        }
                    }
                } else {
                    // Call ended before audio could play (busy/rejected)
                    callStatus = "BUSY"
                }
            } else {
                callStatus = "FAILED"
            }

            // Wait for call to return to IDLE
            withTimeoutOrNull(15000) { callEnded.await() }

        } catch (e: Exception) {
            e.printStackTrace()
            callStatus = "FAILED"
        } finally {
            // Unregister telephony listener/callback
            unregisterCallListener()

            // Restore audio state
            audioManager.isSpeakerphoneOn = false
            audioManager.mode = AudioManager.MODE_NORMAL

            // Save call log
            val callEndTime = System.currentTimeMillis()
            val durationSeconds = ((callEndTime - callStartTime) / 1000).toInt().coerceAtLeast(0)

            val finalStatus = if (callStatus == "COMPLETED" && durationSeconds < 8) "REJECTED" else callStatus

            db.contactDao().updateContactStatus(contact.contactId, finalStatus)

            db.callLogDao().insertLog(
                CallLogEntity(
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
            )

            // Release TTS and media player for this call
            withContext(Dispatchers.Main) {
                tts?.shutdown()
                tts = null
                mediaPlayer?.release()
                mediaPlayer = null
            }
        }
    }

    /**
     * Creates a TelephonyCallback for Android 12+ (API 31+).
     * Updates [callConnected] and [callEnded] based on call state changes.
     */
    @RequiresApi(Build.VERSION_CODES.S)
    private fun makeTelephonyCallback(
        callConnected: CompletableDeferred<Boolean>,
        callEnded: CompletableDeferred<Unit>
    ) = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
        override fun onCallStateChanged(state: Int) {
            when (state) {
                TelephonyManager.CALL_STATE_OFFHOOK -> callConnected.complete(true)
                TelephonyManager.CALL_STATE_IDLE -> {
                    callConnected.complete(false) // No-op if already completed to true
                    callEnded.complete(Unit)
                }
            }
        }
    }

    /**
     * Creates a legacy PhoneStateListener for Android < 12 (API < 31).
     */
    @Suppress("DEPRECATION")
    private fun makePhoneStateListener(
        callConnected: CompletableDeferred<Boolean>,
        callEnded: CompletableDeferred<Unit>
    ) = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            when (state) {
                TelephonyManager.CALL_STATE_OFFHOOK -> callConnected.complete(true)
                TelephonyManager.CALL_STATE_IDLE -> {
                    callConnected.complete(false)
                    callEnded.complete(Unit)
                }
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

        // Use DATA_SYNC foreground service type — PHONE_CALL type requires the app to be
        // a registered Telecom connection service, which this app is not.
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
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
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setContentTitle("Campaign Completed")
            .setContentText("Campaign '$campaignName' has finished running.")
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setAutoCancel(true)
            .build()
        notificationManager.notify(NOTIFICATION_ID + 1, notification)
    }

    private suspend fun <T> withTimeoutOrNull(timeMillis: Long, block: suspend () -> T): T? {
        return try {
            kotlinx.coroutines.withTimeout(timeMillis) { block() }
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            null
        }
    }
}
